from __future__ import annotations

import unittest
from unittest.mock import patch

from examples.n6705c_pyvisa.cli import run
from examples.n6705c_pyvisa.driver import N6705cN6752a, SafeBiasConfig
from examples.n6705c_pyvisa.transport import DryRunTransport


class DriverTests(unittest.TestCase):
    def setUp(self) -> None:
        self.transport = DryRunTransport()
        self.driver = N6705cN6752a(self.transport)

    def test_identity_configure_query_back_and_cleanup(self) -> None:
        config = SafeBiasConfig()
        self.driver.identify_and_verify_scope()
        self.driver.output_off()
        self.driver.configure(config)
        self.driver.query_back(config)
        self.driver.cleanup()
        writes = [message for direction, message in self.transport.transcript if direction == "write"]
        self.assertEqual(writes[0], "OUTP OFF,(@1)")
        self.assertEqual(writes[-3], "OUTP OFF,(@1)")
        self.assertNotIn("OUTP ON,(@1)", writes)

    def test_scope_requires_pinned_firmware(self) -> None:
        class WrongFirmwareTransport(DryRunTransport):
            def query(self, message: str) -> str:
                if message.strip().upper() == "*IDN?":
                    return "KEYSIGHT TECHNOLOGIES,N6705C,MY00000000,E.02.08.0000"
                return super().query(message)

        with self.assertRaisesRegex(RuntimeError, "unverified N6705C firmware"):
            N6705cN6752a(WrongFirmwareTransport()).identify_and_verify_scope()

    def test_ocp_and_explicit_permit_are_required_before_output_on(self) -> None:
        config = SafeBiasConfig()
        with self.assertRaisesRegex(RuntimeError, "verified before output ON"):
            self.driver.enable_output(permit=True)
        self.driver.identify_and_verify_scope()
        self.driver.output_off()
        self.driver.configure(config)
        self.driver.query_back(config)
        with self.assertRaisesRegex(RuntimeError, "explicit output permit"):
            self.driver.enable_output()
        self.driver.enable_output(permit=True)
        self.assertIn(
            "OUTP ON,(@1)",
            [message for direction, message in self.transport.transcript if direction == "write"],
        )

    def test_query_back_fails_when_ocp_is_not_confirmed(self) -> None:
        class OcpOffTransport(DryRunTransport):
            def query(self, message: str) -> str:
                if message.strip().upper() == "CURR:PROT:STAT? (@1)":
                    return "0"
                return super().query(message)

        driver = N6705cN6752a(OcpOffTransport())
        config = SafeBiasConfig()
        driver.identify_and_verify_scope()
        driver.output_off()
        driver.configure(config)
        with self.assertRaisesRegex(RuntimeError, "OCP query-back"):
            driver.query_back(config)

    def test_conservative_power_envelope_rejects_invalid_pair(self) -> None:
        with self.assertRaises(ValueError):
            SafeBiasConfig(voltage_v=50, current_limit_a=10, ovp_v=52).validate()

    def test_list_limits(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "verified identity"):
            self.driver.load_voltage_list([5], [0.05])

        config = SafeBiasConfig()
        self.driver.identify_and_verify_scope()
        self.driver.output_off()
        self.driver.configure(config)
        self.driver.query_back(config)
        self.driver.load_voltage_list([5, 12, 28], [0.05, 0.1, 0.5])
        writes = [message for direction, message in self.transport.transcript if direction == "write"]
        self.assertNotIn("INIT:TRAN (@1)", writes)
        self.assertNotIn("OUTP ON,(@1)", writes)
        queries = [message for direction, message in self.transport.transcript if direction == "query"]
        self.assertIn("LIST:VOLT? (@1)", queries)
        self.assertIn("LIST:DWEL? (@1)", queries)
        with self.assertRaises(ValueError):
            self.driver.load_voltage_list([51], [0.1])
        with self.assertRaisesRegex(RuntimeError, "LIST query-back"):
            self.driver.arm_voltage_list()
        self.driver.load_voltage_list([5, 12, 28], [0.05, 0.1, 0.5])

        self.driver.arm_voltage_list()
        with self.assertRaisesRegex(RuntimeError, "explicit LIST trigger permit"):
            self.driver.trigger_voltage_list()
        with self.assertRaisesRegex(RuntimeError, "output must be explicitly enabled"):
            self.driver.trigger_voltage_list(permit=True)
        self.driver.enable_output(permit=True)
        voltage, _, _ = self.driver.trigger_voltage_list(permit=True)
        self.assertEqual(voltage, 5.0)
        with self.assertRaisesRegex(RuntimeError, "must be armed"):
            self.driver.trigger_voltage_list(permit=True)

        writes = [message for direction, message in self.transport.transcript if direction == "write"]
        self.assertIn("INIT:TRAN (@1)", writes)

    def test_list_validates_every_point_against_ovp_and_100_w_envelope(self) -> None:
        config = SafeBiasConfig(voltage_v=28, current_limit_a=2.1, ovp_v=52)
        self.driver.identify_and_verify_scope()
        self.driver.output_off()
        self.driver.configure(config)
        self.driver.query_back(config)
        with self.assertRaisesRegex(ValueError, "point 1.*100 W envelope"):
            self.driver.load_voltage_list([28, 50], [0.1, 0.1])

        lower_ovp = SafeBiasConfig(voltage_v=20, current_limit_a=1, ovp_v=30)
        self.driver.configure(lower_ovp)
        self.driver.query_back(lower_ovp)
        with self.assertRaisesRegex(ValueError, "point 1.*meets or exceeds configured OVP"):
            self.driver.load_voltage_list([20, 31], [0.1, 0.1])
        with self.assertRaisesRegex(ValueError, "point 1.*meets or exceeds configured OVP"):
            self.driver.load_voltage_list([20, 30], [0.1, 0.1])

    def test_list_query_back_mismatch_prevents_arm(self) -> None:
        class ListMismatchTransport(DryRunTransport):
            def query(self, message: str) -> str:
                if message.strip().upper() == "LIST:VOLT? (@1)":
                    return "5,13"
                return super().query(message)

        driver = N6705cN6752a(ListMismatchTransport())
        config = SafeBiasConfig()
        driver.identify_and_verify_scope()
        driver.output_off()
        driver.configure(config)
        driver.query_back(config)
        with self.assertRaisesRegex(RuntimeError, "point 1 query-back mismatch"):
            driver.load_voltage_list([5, 12], [0.1, 0.1])
        with self.assertRaisesRegex(RuntimeError, "LIST query-back"):
            driver.arm_voltage_list()

    def test_error_drain_is_bounded_and_terminates(self) -> None:
        self.assertEqual(self.driver.drain_errors(), ['+0,"No error"'])

    def test_assert_no_errors_rejects_nonzero_records_before_terminator(self) -> None:
        class ErrorTransport(DryRunTransport):
            errors = ['-222,"Data out of range"', '+0,"No error"']

            def query(self, message: str) -> str:
                if message.strip().upper() == "SYST:ERR?":
                    return self.errors.pop(0)
                return super().query(message)

        with self.assertRaisesRegex(RuntimeError, "configuration reported instrument errors"):
            N6705cN6752a(ErrorTransport()).assert_no_errors("configuration")

    def test_unexpected_cc_and_protection_off_fail_closed(self) -> None:
        class StateTransport(DryRunTransport):
            status = "2"
            output = "1"

            def query(self, message: str) -> str:
                normalized = message.strip().upper()
                if normalized == "OUTP? (@1)":
                    return self.output
                if normalized == "STAT:OPER:COND? (@1)":
                    return self.status
                if normalized == "MEAS:VOLT? (@1)":
                    return "12"
                if normalized == "MEAS:CURR? (@1)":
                    return "1"
                return super().query(message)

        transport = StateTransport()
        driver = N6705cN6752a(transport)
        with self.assertRaisesRegex(RuntimeError, "unexpected CC"):
            driver.assert_expected_cv()
        transport.output = "0"
        transport.status = "4"
        with self.assertRaisesRegex(RuntimeError, "protection-disabled"):
            driver.assert_expected_cv()


class CliSafetyGateTests(unittest.TestCase):
    def test_default_dry_run_never_constructs_real_transport(self) -> None:
        with patch("examples.n6705c_pyvisa.cli.VisaTransport") as real_transport:
            self.assertEqual(run([]), 0)
            real_transport.assert_not_called()

    def test_output_permission_without_execute_is_rejected(self) -> None:
        with self.assertRaises(SystemExit):
            run(["--output-on"])

    def test_execute_without_output_permission_never_writes_output_on(self) -> None:
        transport = DryRunTransport()
        with patch("examples.n6705c_pyvisa.cli.VisaTransport", return_value=transport):
            self.assertEqual(run(["--execute"]), 0)
        writes = [message for direction, message in transport.transcript if direction == "write"]
        self.assertNotIn("OUTP ON,(@1)", writes)

    def test_timeout_still_attempts_off_then_both_abort_commands(self) -> None:
        class TimeoutTransport(DryRunTransport):
            def write(self, message: str) -> None:
                super().write(message)
                if message.startswith("VOLT "):
                    raise TimeoutError("simulated VISA timeout")

        transport = TimeoutTransport()
        with patch("examples.n6705c_pyvisa.cli.VisaTransport", return_value=transport):
            self.assertEqual(run(["--execute"]), 1)
        writes = [message for direction, message in transport.transcript if direction == "write"]
        voltage_index = next(index for index, message in enumerate(writes) if message.startswith("VOLT "))
        self.assertEqual(writes[voltage_index + 1:voltage_index + 4], [
            "OUTP OFF,(@1)",
            "ABOR:TRAN (@1)",
            "ABOR:ACQ (@1)",
        ])

    def test_configuration_error_blocks_output_enable(self) -> None:
        class ErrorTransport(DryRunTransport):
            errors = ['-222,"Data out of range"', '+0,"No error"', '+0,"No error"']

            def query(self, message: str) -> str:
                if message.strip().upper() == "SYST:ERR?":
                    return self.errors.pop(0) if self.errors else '+0,"No error"'
                return super().query(message)

        transport = ErrorTransport()
        with patch("examples.n6705c_pyvisa.cli.VisaTransport", return_value=transport):
            self.assertEqual(run(["--execute", "--output-on"]), 1)
        writes = [message for direction, message in transport.transcript if direction == "write"]
        self.assertNotIn("OUTP ON,(@1)", writes)


if __name__ == "__main__":
    unittest.main()
