import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from examples.mxg_pyvisa.driver import MxgController, MxgN5182B
from examples.mxg_pyvisa.identify_and_options import main as identify_main
from examples.mxg_pyvisa.pa_stimulus_sweep import (
    DutPlaneBudget,
    PaSweepConfig,
    main as pa_sweep_main,
    make_sweep_points,
    run_pa_sweep,
)
from examples.mxg_pyvisa.safe_cw_output import main as safe_cw_main
from examples.mxg_pyvisa.tests.fakes import FakeTransport
from examples.mxg_pyvisa.upload_iq_waveform import main as waveform_main


class RunnableExampleTests(unittest.TestCase):
    def run_quietly(self, function, argv):
        stdout = io.StringIO()
        stderr = io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            result = function(argv)
        return result, stdout.getvalue(), stderr.getvalue()

    def test_public_adapter_name_is_available(self) -> None:
        self.assertIs(MxgN5182B, MxgController)

    def test_identify_example_defaults_to_offline_dry_run(self) -> None:
        result, stdout, _ = self.run_quietly(identify_main, [])
        self.assertEqual(result, 0)
        self.assertIn("DRY RUN", stdout)
        self.assertIn("Verified N5182B", stdout)
        self.assertNotIn("OUTP ON", stdout)

    def test_safe_cw_example_defaults_to_dry_run(self) -> None:
        result, stdout, _ = self.run_quietly(safe_cw_main, [])
        self.assertEqual(result, 0)
        self.assertIn("DRY RUN", stdout)
        self.assertNotIn("OUTP ON", stdout)

    def test_waveform_example_accepts_61_samples_without_rf_permission(self) -> None:
        result, stdout, _ = self.run_quietly(
            waveform_main,
            [
                "--sample-count",
                "61",
                "--sample-rate-hz",
                "1000000",
                "--tone-offset-hz",
                "1000",
            ],
        )
        self.assertEqual(result, 0)
        self.assertIn("WRITE_RAW", stdout)
        self.assertNotIn("WRITE     OUTP ON", stdout)

    def test_focused_output_examples_keep_rf_on_gate(self) -> None:
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            safe_cw_main(["--rf-on"])
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            waveform_main(["--rf-on"])

    def test_dut_plane_budget_accounts_for_loss_uncertainty_guard_and_papr(self) -> None:
        budget = DutPlaneBudget(
            max_average_input_dbm=-10.0,
            max_peak_input_dbm=0.0,
            path_gain_db=0.0,
            path_loss_db=2.0,
            uncertainty_db=0.5,
            guard_db=3.0,
            waveform_papr_db=10.0,
        )
        self.assertAlmostEqual(budget.setpoint_ceiling_dbm(False), -11.5)
        self.assertAlmostEqual(budget.setpoint_ceiling_dbm(True), -11.5)
        self.assertAlmostEqual(budget.budgeted_dut_average_dbm(-20.0), -18.5)
        self.assertAlmostEqual(budget.budgeted_dut_peak_dbm(-20.0, True), -8.5)

    def test_pa_sweep_rejects_unsafe_setpoint_before_rf_on(self) -> None:
        transport = FakeTransport()
        budget = DutPlaneBudget(-10.0, 0.0, 0.0, 2.0, 0.5, 3.0, 10.0)
        config = PaSweepConfig(
            mode="cw",
            frequency_hz=1_000_000_000.0,
            points_dbm=(-20.0, -10.0),
            rf_on=True,
            hold_seconds=0,
        )
        with self.assertRaisesRegex(ValueError, "DUT-plane budget ceiling"):
            run_pa_sweep(transport, config, budget, sleep_fn=lambda _: None)
        self.assertNotIn("OUTP ON", transport.writes)
        self.assertTrue(transport.closed)

    def test_pa_sweep_rejects_duty_cycle_before_opening_visa(self) -> None:
        with patch(
            "examples.mxg_pyvisa.pa_stimulus_sweep.VisaTransport.open"
        ) as open_transport, redirect_stderr(io.StringIO()), self.assertRaises(
            SystemExit
        ):
            pa_sweep_main(
                [
                    "--execute",
                    "--stimulus-duty-cycle-percent",
                    "50",
                    "--max-duty-cycle-percent",
                    "10",
                ]
            )
        open_transport.assert_not_called()

    def test_pa_sweep_turns_rf_off_between_permitted_points(self) -> None:
        transport = FakeTransport()
        budget = DutPlaneBudget(-10.0, 0.0, 0.0, 2.0, 0.5, 3.0, 10.0)
        held = []
        config = PaSweepConfig(
            mode="cw",
            frequency_hz=1_000_000_000.0,
            points_dbm=(-30.0, -20.0),
            rf_on=True,
            hold_seconds=0.1,
        )
        result = run_pa_sweep(transport, config, budget, sleep_fn=held.append)

        self.assertEqual(len(result.points), 2)
        self.assertEqual(held, [0.1, 0.9, 0.1, 0.9])
        self.assertEqual(transport.writes.count("OUTP ON"), 2)
        self.assertEqual(transport.responses["OUTP?"], "0")
        self.assertTrue(transport.closed)

    def test_pa_sweep_cli_defaults_to_dry_run(self) -> None:
        result, stdout, _ = self.run_quietly(
            pa_sweep_main,
            ["--start-dbm", "-30", "--stop-dbm", "-26", "--step-db", "2"],
        )
        self.assertEqual(result, 0)
        self.assertIn("DUT-plane ceiling", stdout)
        self.assertIn("declared duty 10.000% <= 10.000%", stdout)
        self.assertNotIn("WRITE     OUTP ON", stdout)

    def test_sweep_point_builder_never_exceeds_stop(self) -> None:
        self.assertEqual(make_sweep_points(-30.0, -25.0, 2.0), (-30.0, -28.0, -26.0))


if __name__ == "__main__":
    unittest.main()
