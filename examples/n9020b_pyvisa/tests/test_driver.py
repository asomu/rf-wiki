from __future__ import annotations

import unittest

from examples.n9020b_pyvisa.driver import (
    N9020B,
    N9020BError,
    ProfileMismatchError,
    ScpiError,
)
from examples.n9020b_pyvisa.transport import FakeTransport


class DriverTests(unittest.TestCase):
    def test_identity_requires_exact_model_firmware_and_options(self) -> None:
        identity = N9020B(FakeTransport()).identify()
        self.assertEqual(identity.model, "N9020B")
        self.assertEqual(identity.firmware, "A.43.49")
        self.assertTrue({"526", "B1X", "MPB", "P26"}.issubset(identity.options))

        wrong_model = N9020B(
            FakeTransport(idn="Keysight Technologies,N9030B,DEMO,A.43.49")
        )
        with self.assertRaises(ProfileMismatchError):
            wrong_model.identify()

        wrong_firmware = N9020B(
            FakeTransport(idn="Keysight Technologies,N9020B,DEMO,A.43.48")
        )
        with self.assertRaisesRegex(ProfileMismatchError, "pinned to firmware A.43.49"):
            wrong_firmware.identify()

        missing_option = N9020B(FakeTransport(options="526,B1X,P26"))
        with self.assertRaisesRegex(ProfileMismatchError, "MPB"):
            missing_option.identify()

    def test_safe_baseline_uses_attenuation_and_preamp_query_back(self) -> None:
        transport = FakeTransport()
        analyzer = N9020B(transport)
        analyzer.identify()
        analyzer.set_single_acquisition()
        analyzer.set_input_protection(40.0)
        analyzer.verify_safe_baseline(40.0)
        commands = [item.command for item in transport.history]
        self.assertIn("INIT:CONT OFF", commands)
        self.assertIn("POW:ATT:AUTO OFF", commands)
        self.assertIn("POW:ATT 40DB", commands)
        self.assertIn("POW:GAIN OFF", commands)
        self.assertIn("POW:GAIN?", commands)

    def test_safe_baseline_rejects_coerced_attenuation(self) -> None:
        transport = FakeTransport(response_sequences={"POW:ATT?": ["20"]})
        analyzer = N9020B(transport)
        analyzer.set_single_acquisition()
        analyzer.set_input_protection(40.0)
        with self.assertRaisesRegex(ScpiError, "POW:ATT"):
            analyzer.verify_safe_baseline(40.0)

    def test_trace_requires_verified_configuration_and_completed_acquisition(self) -> None:
        transport = FakeTransport()
        analyzer = N9020B(transport)
        analyzer.identify()
        analyzer.select_default_swept_sa()
        analyzer.set_single_acquisition()
        analyzer.set_input_protection(40.0)
        analyzer.configure_spectrum(
            center_hz=3.5e9,
            span_hz=100e6,
            reference_level_dbm=0,
            rbw_hz=100e3,
            vbw_hz=300e3,
            points=101,
            detector="NORM",
            trigger_source="IMM",
        )
        analyzer.verify_spectrum_configuration(
            center_hz=3.5e9,
            span_hz=100e6,
            reference_level_dbm=0,
            rbw_hz=100e3,
            vbw_hz=300e3,
            points=101,
            detector="NORM",
            trigger_source="IMM",
        )
        with self.assertRaisesRegex(RuntimeError, "before a completed acquisition"):
            analyzer.read_trace(center_hz=3.5e9, span_hz=100e6, points=101)
        analyzer.initiate_and_wait()
        trace = analyzer.read_trace(center_hz=3.5e9, span_hz=100e6, points=101)
        self.assertEqual(len(trace.levels_dbm), 101)
        self.assertAlmostEqual(trace.marker_frequency_hz, 3.5e9, delta=1e6)
        commands = [item.command for item in transport.history]
        self.assertIn("TRAC? TRACE1", commands)
        self.assertIn("CALC:MARK1:STAT ON", commands)
        self.assertIn("CALC:MARK1:MAX", commands)

    def test_trace_count_must_match_sweep_points(self) -> None:
        transport = FakeTransport(response_sequences={"TRAC? TRACE1": ["-20,-21"]})
        analyzer = N9020B(transport)
        analyzer.identify()
        analyzer.select_default_swept_sa()
        analyzer.configure_spectrum(
            center_hz=3.5e9,
            span_hz=10e6,
            reference_level_dbm=0,
            rbw_hz=100e3,
            vbw_hz=300e3,
            points=3,
            detector="NORM",
            trigger_source="IMM",
        )
        analyzer.verify_spectrum_configuration(
            center_hz=3.5e9,
            span_hz=10e6,
            reference_level_dbm=0,
            rbw_hz=100e3,
            vbw_hz=300e3,
            points=3,
            detector="NORM",
            trigger_source="IMM",
        )
        analyzer.initiate_and_wait()
        with self.assertRaisesRegex(N9020BError, "returned 2 points"):
            analyzer.read_trace(center_hz=3.5e9, span_hz=10e6, points=3)

    def test_powersuite_read_and_fetch_have_distinct_acquisition_semantics(self) -> None:
        read_transport = FakeTransport()
        read_analyzer = N9020B(read_transport)
        read_analyzer.identify()
        read_analyzer.configure_powersuite("ACP", center_hz=3.5e9, reference_level_dbm=0)
        read_analyzer.set_single_acquisition()
        read_analyzer.set_input_protection(40)
        read_analyzer.verify_powersuite_configuration(center_hz=3.5e9, reference_level_dbm=0)
        self.assertEqual(read_analyzer.read_powersuite().measurement, "ACP")
        self.assertIn(("QUERY", "READ:ACP?"), [(item.kind, item.command) for item in read_transport.history])

        fetch_transport = FakeTransport()
        fetch_analyzer = N9020B(fetch_transport)
        fetch_analyzer.identify()
        fetch_analyzer.configure_powersuite("CHP", center_hz=3.5e9, reference_level_dbm=0)
        fetch_analyzer.set_single_acquisition()
        fetch_analyzer.set_input_protection(40)
        fetch_analyzer.verify_powersuite_configuration(center_hz=3.5e9, reference_level_dbm=0)
        with self.assertRaisesRegex(RuntimeError, "before a completed acquisition"):
            fetch_analyzer.fetch_powersuite()
        fetch_analyzer.initiate_and_wait()
        self.assertEqual(fetch_analyzer.fetch_powersuite().measurement, "CHP")

    def test_error_queue_drain_is_bounded(self) -> None:
        transport = FakeTransport(
            response_sequences={"SYST:ERR?": ['-113,"Undefined header"'] * 32}
        )
        with self.assertRaisesRegex(ScpiError, "did not terminate"):
            N9020B(transport).drain_errors()


if __name__ == "__main__":
    unittest.main()
