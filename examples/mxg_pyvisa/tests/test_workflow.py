import unittest

from examples.mxg_pyvisa.driver import (
    CapabilityError,
    ModelMismatchError,
    ScpiError,
)
from examples.mxg_pyvisa.workflow import RunConfig, SessionSafetyError, run_session
from examples.mxg_pyvisa.tests.fakes import FakeTransport


class FrequencyCoercingTransport(FakeTransport):
    def write(self, command: str) -> None:
        super().write(command)
        if command.startswith("SOUR:FREQ:CW "):
            self.responses["SOUR:FREQ:CW?"] = "999000000"


class PowerCoercingTransport(FakeTransport):
    def write(self, command: str) -> None:
        super().write(command)
        if command.startswith("SOUR:POW:LEV:IMM:AMPL "):
            self.responses["SOUR:POW:LEV:IMM:AMPL?"] = "-29.5"


class RuntimeScaleCoercingTransport(FakeTransport):
    def write(self, command: str) -> None:
        super().write(command)
        if command.startswith("SOUR:RAD:ARB:RSC "):
            self.responses["SOUR:RAD:ARB:RSC?"] = "65"


class ArbStateCoercingTransport(FakeTransport):
    def write(self, command: str) -> None:
        super().write(command)
        if command == "SOUR:RAD:ARB:STAT ON":
            self.responses["SOUR:RAD:ARB:STAT?"] = "0"


class UnexpectedOutputStateTransport(FakeTransport):
    def __init__(self) -> None:
        super().__init__()
        self.inject_unexpected_on = True

    def query(self, command: str) -> str:
        if command == "OUTP?" and self.inject_unexpected_on:
            self.inject_unexpected_on = False
            self.queries.append(command)
            self.history.append("QUERY {}".format(command))
            return "1"
        return super().query(command)


class CleanupFailureTransport(FakeTransport):
    def __init__(self, close_fails: bool = False) -> None:
        super().__init__()
        self.outp_off_attempts = 0
        self.close_fails = close_fails

    def write(self, command: str) -> None:
        if command.strip().upper() == "OUTP OFF":
            self.outp_off_attempts += 1
            if self.outp_off_attempts >= 3:
                raise OSError("simulated cable loss during final RF OFF")
        super().write(command)

    def close(self) -> None:
        self.closed = True
        self.history.append("CLOSE attempted")
        if self.close_fails:
            raise OSError("simulated VISA close failure")


class FakeTransportWorkflowTests(unittest.TestCase):
    def test_cw_defaults_never_enable_rf_and_always_close(self) -> None:
        transport = FakeTransport()
        result = run_session(transport, RunConfig(), sleep_fn=lambda _: None)

        self.assertEqual(result.identity.model, "N5182B")
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertEqual(transport.writes[-3:], [
            "OUTP OFF",
            "OUTP:MOD OFF",
            "SOUR:RAD:ARB:STAT OFF",
        ])
        self.assertIn("SOUR:FREQ:CW?", transport.queries)
        self.assertIn("SOUR:POW:LEV:IMM:AMPL?", transport.queries)
        self.assertGreaterEqual(transport.queries.count("OUTP?"), 2)
        self.assertTrue(transport.closed)

    def test_rf_on_requires_config_permission_and_is_cleaned_up(self) -> None:
        transport = FakeTransport()
        held = []
        config = RunConfig(rf_on=True, hold_seconds=0.25)
        result = run_session(transport, config, sleep_fn=held.append)

        self.assertTrue(result.rf_was_enabled)
        self.assertIn("OUTP ON", transport.writes)
        self.assertEqual(held, [0.25])
        self.assertEqual(transport.writes[-3], "OUTP OFF")
        self.assertTrue(transport.closed)

    def test_model_mismatch_stops_before_configuration(self) -> None:
        transport = FakeTransport(
            idn="Keysight Technologies,N5186A,MY00000002,A.15.00"
        )
        with self.assertRaises(ModelMismatchError):
            run_session(transport, RunConfig(), sleep_fn=lambda _: None)

        self.assertNotIn("OUTP ON", transport.writes)
        self.assertFalse(any(command.startswith("SOUR:FREQ") for command in transport.writes))
        self.assertEqual(transport.writes[-1], "OUTP OFF")
        self.assertFalse(any(command.startswith("SOUR:RAD") for command in transport.writes))
        self.assertTrue(transport.closed)

    def test_waveform_upload_uses_definite_binary_block(self) -> None:
        transport = FakeTransport(options="506,656")
        config = RunConfig(
            mode="waveform",
            sample_count=512,
            sample_rate_hz=100_000_000.0,
            tone_offset_hz=976_562.5,
        )
        run_session(transport, config, sleep_fn=lambda _: None)

        self.assertEqual(len(transport.raw_writes), 1)
        raw = transport.raw_writes[0]
        self.assertTrue(raw.startswith(b'MMEM:DATA "WFM1:RF_WIKI_IQ",#'))
        self.assertIn("SOUR:RAD:ARB:SCL:RATE 100000000HZ", transport.writes)
        self.assertIn('SOUR:RAD:ARB:WAV "WFM1:RF_WIKI_IQ"', transport.writes)
        self.assertIn("SOUR:RAD:ARB:STAT ON", transport.writes)
        self.assertIn("SOUR:RAD:ARB:WAV?", transport.queries)
        self.assertIn("SOUR:RAD:ARB:SCL:RATE?", transport.queries)
        self.assertIn("SOUR:RAD:ARB:RSC?", transport.queries)
        self.assertIn("SOUR:RAD:ARB:STAT?", transport.queries)
        self.assertIn("OUTP:MOD?", transport.queries)
        self.assertNotIn("OUTP ON", transport.writes)

    def test_waveform_requires_arb_option(self) -> None:
        transport = FakeTransport(options="506")
        with self.assertRaises(CapabilityError):
            run_session(
                transport,
                RunConfig(mode="waveform", sample_count=512),
                sleep_fn=lambda _: None,
            )
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_option_657_without_required_656_is_rejected(self) -> None:
        transport = FakeTransport(options="506,657")
        with self.assertRaisesRegex(CapabilityError, "657 without its required Option 656"):
            run_session(
                transport,
                RunConfig(mode="waveform", sample_count=60),
                sleep_fn=lambda _: None,
            )
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_option_657_with_656_allows_200_msa_per_second(self) -> None:
        transport = FakeTransport(options="506,656,657")
        run_session(
            transport,
            RunConfig(
                mode="waveform",
                sample_count=60,
                sample_rate_hz=200_000_000.0,
            ),
            sleep_fn=lambda _: None,
        )
        self.assertIn("SOUR:RAD:ARB:SCL:RATE 200000000HZ", transport.writes)
        self.assertTrue(transport.closed)

    def test_option_656_rejects_sample_rate_above_100_msa_per_second(self) -> None:
        transport = FakeTransport(options="506,656")
        with self.assertRaisesRegex(CapabilityError, "exceeds"):
            run_session(
                transport,
                RunConfig(
                    mode="waveform",
                    sample_count=512,
                    sample_rate_hz=100_000_001.0,
                ),
                sleep_fn=lambda _: None,
            )
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_option_503_rejects_frequency_above_3_ghz(self) -> None:
        transport = FakeTransport(options="503,656")
        with self.assertRaisesRegex(ValueError, "installed option"):
            run_session(
                transport,
                RunConfig(frequency_hz=3_500_000_000.0),
                sleep_fn=lambda _: None,
            )
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_scpi_error_queue_is_drained_and_rf_is_off(self) -> None:
        transport = FakeTransport(
            error_responses=['-222,"Data out of range"', '+0,"No error"']
        )
        with self.assertRaises(ScpiError) as raised:
            run_session(transport, RunConfig(), sleep_fn=lambda _: None)
        self.assertIn("-222", str(raised.exception))
        self.assertEqual(transport.queries.count("SYST:ERR?"), 3)
        self.assertEqual(transport.writes[-3], "OUTP OFF")
        self.assertTrue(transport.closed)

    def test_all_30_preexisting_errors_are_logged_after_plus_zero_termination(self) -> None:
        preexisting = ['-100,"Old command error"'] * 30 + ['+0,"No error"']
        transport = FakeTransport(preexisting_error_responses=preexisting)
        events = []

        result = run_session(
            transport,
            RunConfig(),
            sleep_fn=lambda _: None,
            event_sink=events.append,
        )

        self.assertEqual(len(result.preexisting_errors), 30)
        self.assertEqual(len(events), 30)
        cls_index = transport.history.index("WRITE *CLS")
        self.assertEqual(
            transport.history[:cls_index].count("QUERY SYST:ERR?"), 31
        )

    def test_preexisting_error_drain_aborts_when_plus_zero_is_not_confirmed(self) -> None:
        transport = FakeTransport(
            preexisting_error_responses=['-100,"Old command error"'] * 31
        )

        with self.assertRaisesRegex(ScpiError, r"did not terminate with \+0 within 31"):
            run_session(transport, RunConfig(), sleep_fn=lambda _: None)

        self.assertEqual(transport.queries.count("SYST:ERR?"), 31)
        self.assertNotIn("*CLS", transport.writes)
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_frequency_query_back_rejects_instrument_coercion(self) -> None:
        transport = FrequencyCoercingTransport()
        with self.assertRaisesRegex(ScpiError, "frequency expected"):
            run_session(transport, RunConfig(), sleep_fn=lambda _: None)
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_power_query_back_rejects_instrument_coercion(self) -> None:
        transport = PowerCoercingTransport()
        with self.assertRaisesRegex(ScpiError, "power expected"):
            run_session(transport, RunConfig(), sleep_fn=lambda _: None)
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_configuration_rejects_unexpected_rf_on_state(self) -> None:
        transport = UnexpectedOutputStateTransport()
        with self.assertRaisesRegex(ScpiError, "expected OFF"):
            run_session(transport, RunConfig(), sleep_fn=lambda _: None)
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_waveform_query_back_rejects_runtime_scale_mismatch(self) -> None:
        transport = RuntimeScaleCoercingTransport()
        with self.assertRaisesRegex(ScpiError, "runtime scaling expected"):
            run_session(
                transport,
                RunConfig(mode="waveform", sample_count=60),
                sleep_fn=lambda _: None,
            )
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_waveform_query_back_rejects_arb_state_mismatch(self) -> None:
        transport = ArbStateCoercingTransport()
        with self.assertRaisesRegex(ScpiError, "ARB expected ON"):
            run_session(
                transport,
                RunConfig(mode="waveform", sample_count=60),
                sleep_fn=lambda _: None,
            )
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_cleanup_failure_returns_unknown_rf_state_instead_of_success(self) -> None:
        transport = CleanupFailureTransport()
        with self.assertRaises(SessionSafetyError) as raised:
            run_session(
                transport,
                RunConfig(rf_on=True, hold_seconds=0),
                sleep_fn=lambda _: None,
            )

        self.assertEqual(raised.exception.rf_state, "unknown")
        self.assertIsNone(raised.exception.primary_error)
        self.assertEqual(transport.responses["OUTP?"], "1")
        self.assertTrue(transport.closed)

    def test_primary_error_is_preserved_with_cleanup_and_close_failures(self) -> None:
        transport = CleanupFailureTransport(close_fails=True)
        primary = RuntimeError("measurement callback failed")

        def fail_during_hold(_: float) -> None:
            raise primary

        with self.assertRaises(SessionSafetyError) as raised:
            run_session(
                transport,
                RunConfig(rf_on=True, hold_seconds=0),
                sleep_fn=fail_during_hold,
            )

        error = raised.exception
        self.assertIs(error.primary_error, primary)
        self.assertIs(error.__cause__, primary)
        self.assertIsInstance(error.close_error, OSError)
        self.assertEqual(error.rf_state, "unknown")
        self.assertIn("transport close failure", str(error))
        self.assertIn("primary failure preserved", str(error))


if __name__ == "__main__":
    unittest.main()
