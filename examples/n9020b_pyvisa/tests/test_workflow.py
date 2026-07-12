from __future__ import annotations

import unittest

from examples.n9020b_pyvisa.driver import N9020B, ScpiError
from examples.n9020b_pyvisa.transport import FakeTransport
from examples.n9020b_pyvisa.workflow import (
    PowerSuiteRequest,
    SaInputSafetyEnvelope,
    SpectrumRequest,
    dry_run_input_envelope,
    run_powersuite_measurement,
    run_safe_spectrum,
)


class InputSafetyTests(unittest.TestCase):
    def test_signed_path_papr_uncertainty_and_guard_are_all_included(self) -> None:
        estimate = dry_run_input_envelope().evaluate(
            input_attenuation_db=40,
            reference_level_dbm=0,
        )
        self.assertAlmostEqual(estimate.connector_average_worst_dbm, -36)
        self.assertAlmostEqual(estimate.connector_peak_worst_dbm, -28)
        self.assertAlmostEqual(estimate.mixer_peak_worst_dbm, -68)

    def test_connector_average_peak_dc_and_mixer_violations_are_rejected(self) -> None:
        base = dict(
            source_max_average_dbm=0.0,
            path_gain_db=-10.0,
            waveform_papr_db=8.0,
            connector_average_limit_dbm=-10.0,
            connector_peak_limit_dbm=0.0,
            dc_volts=0.0,
        )
        with self.assertRaisesRegex(ValueError, "connector average"):
            SaInputSafetyEnvelope(**base).evaluate(input_attenuation_db=40, reference_level_dbm=10)

        peak = dict(base)
        peak.update(path_gain_db=-30.0, connector_average_limit_dbm=-20.0, connector_peak_limit_dbm=-20.0)
        with self.assertRaisesRegex(ValueError, "connector peak"):
            SaInputSafetyEnvelope(**peak).evaluate(input_attenuation_db=40, reference_level_dbm=10)

        dc = dict(base)
        dc.update(path_gain_db=-40.0, connector_average_limit_dbm=-20.0, connector_peak_limit_dbm=-10.0, dc_volts=0.3)
        with self.assertRaisesRegex(ValueError, "±0.2 V"):
            SaInputSafetyEnvelope(**dc).evaluate(input_attenuation_db=40, reference_level_dbm=10)

        mixer = SaInputSafetyEnvelope(
            source_max_average_dbm=0,
            path_gain_db=-4,
            waveform_papr_db=0,
            connector_average_limit_dbm=0,
            connector_peak_limit_dbm=0,
            dc_volts=0,
            uncertainty_db=0,
            guard_margin_db=0,
        )
        with self.assertRaisesRegex(ValueError, "mixer peak"):
            mixer.evaluate(input_attenuation_db=5, reference_level_dbm=0)

    def test_damage_limit_is_never_accepted_as_a_working_limit(self) -> None:
        envelope = SaInputSafetyEnvelope(
            source_max_average_dbm=-40,
            path_gain_db=0,
            waveform_papr_db=0,
            connector_average_limit_dbm=30,
            connector_peak_limit_dbm=30,
            dc_volts=0,
        )
        with self.assertRaisesRegex(ValueError, "damage limit"):
            envelope.evaluate(input_attenuation_db=40, reference_level_dbm=0)


class WorkflowTests(unittest.TestCase):
    def test_swept_sa_real_order_is_fixed_and_cleanup_starts_with_abort(self) -> None:
        transport = FakeTransport()
        result = run_safe_spectrum(
            N9020B(transport),
            SpectrumRequest(points=101),
            acquire=True,
            safety_envelope=dry_run_input_envelope(),
        )
        self.assertIsNotNone(result)
        commands = [item.command for item in transport.history]
        expected_prefix = [
            "*IDN?",
            "*OPT?",
            "ABOR",
            "*CLS",
            "CONF:SAN:NDEF",
            "INIT:CONT OFF",
            "POW:ATT:AUTO OFF",
            "POW:ATT 40DB",
            "POW:GAIN OFF",
        ]
        self.assertEqual(commands[: len(expected_prefix)], expected_prefix)
        close_index = commands.index("transport closed")
        last_trace_index = commands.index("CALC:MARK1:Y?")
        cleanup_commands = commands[last_trace_index + 1 : close_index]
        self.assertEqual(cleanup_commands[1], "ABOR")  # first item is final SYST:ERR?
        self.assertIn("INIT:CONT OFF", cleanup_commands)
        self.assertIn("POW:GAIN OFF", cleanup_commands)

    def test_missing_envelope_blocks_acquisition_but_still_cleans_up(self) -> None:
        transport = FakeTransport()
        with self.assertRaisesRegex(PermissionError, "safety envelope"):
            run_safe_spectrum(
                N9020B(transport), SpectrumRequest(), acquire=True, safety_envelope=None
            )
        commands = [item.command for item in transport.history]
        self.assertNotIn("INIT:IMM", commands)
        self.assertTrue(transport.closed)
        self.assertIn("ABOR", commands)

    def test_timeout_during_configuration_still_restores_safe_state_and_closes(self) -> None:
        transport = FakeTransport(fail_on="SWE:POIN 1001")
        with self.assertRaises(TimeoutError):
            run_safe_spectrum(
                N9020B(transport),
                SpectrumRequest(),
                acquire=False,
                safety_envelope=dry_run_input_envelope(),
            )
        commands = [item.command for item in transport.history]
        self.assertTrue(transport.closed)
        cleanup_abort = max(index for index, command in enumerate(commands) if command == "ABOR")
        self.assertEqual(
            commands[cleanup_abort : cleanup_abort + 5],
            ["ABOR", "INIT:CONT OFF", "POW:ATT:AUTO OFF", "POW:ATT 40DB", "POW:GAIN OFF"],
        )

    def test_nonzero_configuration_error_blocks_initiation(self) -> None:
        transport = FakeTransport(
            response_sequences={"SYST:ERR?": ['-222,"Data out of range"', '+0,"No error"']}
        )
        with self.assertRaises(ScpiError):
            run_safe_spectrum(
                N9020B(transport),
                SpectrumRequest(),
                acquire=True,
                safety_envelope=dry_run_input_envelope(),
            )
        commands = [item.command for item in transport.history]
        self.assertNotIn("INIT:IMM", commands)
        self.assertTrue(transport.closed)

    def test_powersuite_supports_init_fetch_and_read_paths(self) -> None:
        fetch_transport = FakeTransport()
        fetched = run_powersuite_measurement(
            N9020B(fetch_transport),
            PowerSuiteRequest(measurement="ACP", use_read=False),
            acquire=True,
            safety_envelope=dry_run_input_envelope(),
        )
        self.assertEqual(fetched.measurement, "ACP")  # type: ignore[union-attr]
        fetch_commands = [item.command for item in fetch_transport.history]
        self.assertLess(fetch_commands.index("INIT:IMM"), fetch_commands.index("FETC:ACP?"))

        read_transport = FakeTransport()
        read = run_powersuite_measurement(
            N9020B(read_transport),
            PowerSuiteRequest(measurement="OBW", use_read=True),
            acquire=True,
            safety_envelope=dry_run_input_envelope(),
        )
        self.assertEqual(read.measurement, "OBW")  # type: ignore[union-attr]
        read_commands = [item.command for item in read_transport.history]
        self.assertIn("READ:OBW?", read_commands)


if __name__ == "__main__":
    unittest.main()
