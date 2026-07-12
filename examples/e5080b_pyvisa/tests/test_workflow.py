from __future__ import annotations

import unittest

from examples.e5080b_pyvisa.driver import E5080B, InstrumentErrorQueueError, OutputStateUnknownError
from examples.e5080b_pyvisa.transport import FakeTransport
from examples.e5080b_pyvisa.workflow import EnaPowerSafetyEnvelope, SweepRequest, run_safe_sweep


SAFE_ENVELOPE = EnaPowerSafetyEnvelope(
    dut_input_limit_dbm=-10,
    receiver_input_limit_dbm=0,
    maximum_dut_gain_db=20,
)


class WorkflowTest(unittest.TestCase):
    def test_safe_sweep_keeps_rf_off_without_consent(self) -> None:
        transport = FakeTransport()
        run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=False)
        writes = [message for operation, message in transport.transcript if operation == "write"]
        self.assertEqual(writes[0], "OUTP OFF")
        self.assertNotIn("OUTP ON", writes)
        self.assertEqual(writes[-1], "OUTP OFF")

    def test_timeout_still_attempts_output_off_before_close(self) -> None:
        transport = FakeTransport(fail_on="SENS1:SWE:POIN 201")
        with self.assertRaises(TimeoutError):
            run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=False)
        self.assertIn(("write", "OUTP OFF"), transport.transcript)
        close_index = transport.transcript.index(("close", ""))
        off_indices = [index for index, item in enumerate(transport.transcript) if item == ("write", "OUTP OFF")]
        self.assertLess(off_indices[-1], close_index)

    def test_rf_on_is_between_verified_setup_and_final_off(self) -> None:
        transport = FakeTransport()
        run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=True, safety_envelope=SAFE_ENVELOPE)
        writes = [message for operation, message in transport.transcript if operation == "write"]
        self.assertIn("OUTP ON", writes)
        self.assertEqual(writes[-1], "OUTP OFF")

    def test_nonzero_configuration_error_blocks_rf_enable(self) -> None:
        transport = FakeTransport(response_sequences={
            "SYST:ERR?": ['-222,"Data out of range"', '+0,"No error"'],
        })
        with self.assertRaises(InstrumentErrorQueueError):
            run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=True, safety_envelope=SAFE_ENVELOPE)
        writes = [message for operation, message in transport.transcript if operation == "write"]
        self.assertNotIn("OUTP ON", writes)
        self.assertEqual(writes[-1], "OUTP OFF")

    def test_cleanup_requires_confirmed_output_off_state(self) -> None:
        transport = FakeTransport(response_sequences={"OUTP?": ["0", "1"]})
        with self.assertRaises(OutputStateUnknownError):
            run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=False)
        self.assertEqual(transport.transcript[-1], ("close", ""))

    def test_rf_enable_requires_explicit_dut_and_receiver_envelope(self) -> None:
        transport = FakeTransport()
        with self.assertRaisesRegex(PermissionError, "power safety envelope"):
            run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=True)
        self.assertNotIn(("write", "OUTP ON"), transport.transcript)

    def test_receiver_or_dut_limit_violation_blocks_rf_enable(self) -> None:
        unsafe = EnaPowerSafetyEnvelope(
            dut_input_limit_dbm=-35,
            receiver_input_limit_dbm=-20,
            maximum_dut_gain_db=20,
        )
        transport = FakeTransport()
        with self.assertRaisesRegex(ValueError, "DUT input"):
            run_safe_sweep(E5080B(transport), SweepRequest(), enable_rf=True, safety_envelope=unsafe)
        self.assertNotIn(("write", "OUTP ON"), transport.transcript)


if __name__ == "__main__":
    unittest.main()
