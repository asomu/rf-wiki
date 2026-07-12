from __future__ import annotations

import struct
import unittest

from examples.e5080b_pyvisa.driver import E5080B, UnexpectedInstrumentError
from examples.e5080b_pyvisa.transport import FakeTransport


class DriverTest(unittest.TestCase):
    def test_identity_requires_e5080b(self) -> None:
        good = E5080B(FakeTransport())
        self.assertIn("E5080B", good.identify()[0])

        bad_transport = FakeTransport(responses={"*IDN?": "Keysight Technologies,E5081A,SN,FW", "*OPT?": ""})
        with self.assertRaises(UnexpectedInstrumentError):
            E5080B(bad_transport).identify()

    def test_rf_on_requires_explicit_consent(self) -> None:
        transport = FakeTransport()
        driver = E5080B(transport)
        with self.assertRaises(PermissionError):
            driver.output_on(consent=False)
        self.assertNotIn(("write", "OUTP ON"), transport.transcript)

    def test_profile_configuration_requires_verified_2k0_option(self) -> None:
        driver = E5080B(FakeTransport())
        with self.assertRaises(UnexpectedInstrumentError):
            driver.configure_sweep(
                start_hz=1e9,
                stop_hz=20e9,
                points=201,
                if_bandwidth_hz=1e3,
                power_dbm=-30,
            )

        wrong_option = FakeTransport()
        wrong_option.responses["*OPT?"] = "4K0"
        with self.assertRaises(UnexpectedInstrumentError):
            E5080B(wrong_option).identify()

    def test_reverse_sparameters_require_separate_rf_consent(self) -> None:
        transport = FakeTransport()
        driver = E5080B(transport)
        driver.identify()
        driver.configure_sweep(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
            parameter="S12",
        )
        driver.set_power_limit(-20)
        driver.verify_configuration(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
            power_limit_dbm=-20,
        )
        with self.assertRaises(PermissionError):
            driver.output_on(consent=True)
        driver.output_on(consent=True, reverse_drive_consent=True)
        self.assertIn(("write", "OUTP ON"), transport.transcript)
        self.assertEqual(transport.transcript[-1], ("query", "OUTP?"))

    def test_rf_on_requires_full_configuration_query_back(self) -> None:
        transport = FakeTransport()
        driver = E5080B(transport)
        driver.identify()
        driver.configure_sweep(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
        )
        with self.assertRaisesRegex(PermissionError, "query-back"):
            driver.output_on(consent=True)
        self.assertNotIn(("write", "OUTP ON"), transport.transcript)

    def test_query_back_allows_instrument_format_rounding_but_not_material_coercion(self) -> None:
        transport = FakeTransport()
        driver = E5080B(transport)
        driver.identify()
        driver.set_power_limit(-20)
        driver.configure_sweep(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
        )
        transport.responses["SENS1:FREQ:STAR?"] = "1000000000.5"
        transport.responses["SOUR1:POW1?"] = "-29.9995"
        driver.verify_configuration(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
            power_limit_dbm=-20,
        )

        transport.responses["SENS1:FREQ:STAR?"] = "1000001000"
        with self.assertRaisesRegex(RuntimeError, "start_hz"):
            driver.verify_configuration(
                start_hz=1e9,
                stop_hz=6e9,
                points=201,
                if_bandwidth_hz=1e3,
                power_dbm=-30,
                power_limit_dbm=-20,
            )

    def test_real32_complex_decode_checks_length_and_endian(self) -> None:
        payload = struct.pack("<4f", 1.0, -2.0, 0.5, 0.25)
        self.assertEqual(E5080B.decode_real32_sdata(payload, points=2), (1 - 2j, 0.5 + 0.25j))
        block = b"#2" + str(len(payload)).encode("ascii") + payload
        self.assertEqual(E5080B.decode_real32_block(block, points=2), (1 - 2j, 0.5 + 0.25j))
        with self.assertRaises(ValueError):
            E5080B.decode_real32_sdata(payload[:-1], points=2)
        with self.assertRaises(ValueError):
            E5080B.unwrap_definite_length_block(block[:-1])

    def test_ascii_sdata_requires_two_scalars_per_frequency(self) -> None:
        transport = FakeTransport()
        transport.responses.update({
            "CALC1:PAR:MNUM?": "7",
            "CALC1:MEAS7:X:VAL?": "1,2",
            "CALC1:MEAS7:DATA:SDAT?": "1,0,0.5",
        })
        driver = E5080B(transport)
        driver.identify()
        driver.configure_sweep(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
            parameter="S21",
        )
        driver.set_and_verify_ascii_data_format()
        driver.verify_correction("TrainingCalSet")
        with self.assertRaises(ValueError):
            driver.read_ascii_sdata()
        self.assertIn(("write", "CALC1:PAR:SEL 'RF_WIKI_S21'"), transport.transcript)
        self.assertIn(("query", "CALC1:PAR:MNUM?"), transport.transcript)
        self.assertIn(("query", "CALC1:MEAS7:DATA:SDAT?"), transport.transcript)

    def test_corrected_label_requires_correction_and_expected_calset(self) -> None:
        transport = FakeTransport()
        driver = E5080B(transport)
        driver.identify()
        driver.configure_sweep(
            start_hz=1e9,
            stop_hz=6e9,
            points=201,
            if_bandwidth_hz=1e3,
            power_dbm=-30,
        )
        driver.set_and_verify_ascii_data_format()
        transport.responses["SENS1:CORR:STAT?"] = "0"
        with self.assertRaisesRegex(RuntimeError, "Correction is OFF"):
            driver.verify_correction("TrainingCalSet")
        transport.responses["SENS1:CORR:STAT?"] = "1"
        with self.assertRaisesRegex(RuntimeError, "Expected CalSet"):
            driver.verify_correction("ProductionCalSet")


if __name__ == "__main__":
    unittest.main()
