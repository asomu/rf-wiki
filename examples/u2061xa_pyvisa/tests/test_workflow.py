import unittest

from examples.u2061xa_pyvisa.driver import CleanupError
from examples.u2061xa_pyvisa.transport import DryRunTransport
from examples.u2061xa_pyvisa.workflow import (
    MeasurementConfig,
    StimulusLease,
    calculate_pa_power,
    run_average_measurement,
)


class WorkflowTests(unittest.TestCase):
    def test_dry_run_does_not_require_physical_confirmation(self):
        transport = DryRunTransport(measurement_dbm=-18.25)
        result = run_average_measurement(
            transport,
            MeasurementConfig(require_physical_confirmation=False),
        )
        self.assertAlmostEqual(result.power_dbm, -18.25)
        self.assertIn("dry-run", result.stimulus_ready_evidence)
        self.assertIn("released", result.stimulus_release_evidence)
        self.assertTrue(result.abort_report.ok)
        self.assertTrue(transport.closed)

    def test_real_workflow_contract_requires_sg_rf_off_confirmation(self):
        transport = DryRunTransport()
        with self.assertRaises(RuntimeError):
            run_average_measurement(
                transport,
                MeasurementConfig(require_physical_confirmation=True),
            )
        self.assertTrue(transport.closed)
        self.assertIn("ABOR", [item.command for item in transport.history])

    def test_real_workflow_requires_a_post_zero_stimulus_gate(self):
        transport = DryRunTransport()
        with self.assertRaisesRegex(RuntimeError, "post-zero"):
            run_average_measurement(
                transport,
                MeasurementConfig(
                    require_physical_confirmation=True,
                    sg_rf_off_confirmed=True,
                ),
            )
        commands = [item.command for item in transport.history]
        self.assertIn("CAL:ALL?", commands)
        self.assertNotIn("READ?", commands)
        self.assertTrue(transport.closed)

    def test_stimulus_gate_runs_after_zero_and_before_measurement(self):
        transport = DryRunTransport(measurement_dbm=-21.0)

        def verified_station_gate():
            commands = [item.command for item in transport.history]
            self.assertIn("CAL:ALL?", commands)
            self.assertNotIn("READ?", commands)
            return StimulusLease(
                evidence="SG -30 dBm query-back; path guard PASS",
                release=lambda: "SG RF OFF query-back",
            )

        result = run_average_measurement(
            transport,
            MeasurementConfig(
                require_physical_confirmation=True,
                sg_rf_off_confirmed=True,
            ),
            stimulus_ready_gate=verified_station_gate,
        )
        self.assertEqual(result.stimulus_ready_evidence, "SG -30 dBm query-back; path guard PASS")
        self.assertEqual(result.stimulus_release_evidence, "SG RF OFF query-back")
        commands = [item.command for item in transport.history]
        self.assertLess(commands.index("CAL:ALL?"), commands.index("READ?"))

    def test_stimulus_release_runs_before_sensor_abort(self):
        transport = DryRunTransport()

        def station_gate():
            def release():
                transport.history.append(type(transport.history[0])("STATION", "SG RF OFF"))
                return "SG OFF"

            return StimulusLease("SG ON query-back", release)

        run_average_measurement(
            transport,
            MeasurementConfig(require_physical_confirmation=False),
            stimulus_ready_gate=station_gate,
        )
        commands = [item.command for item in transport.history]
        self.assertLess(commands.index("SG RF OFF"), commands.index("ABOR"))

    def test_missing_stimulus_release_evidence_is_cleanup_failure(self):
        transport = DryRunTransport()
        with self.assertRaisesRegex(CleanupError, "stimulus release"):
            run_average_measurement(
                transport,
                MeasurementConfig(require_physical_confirmation=False),
                stimulus_ready_gate=lambda: StimulusLease("SG ready", lambda: ""),
            )
        self.assertTrue(transport.closed)

    def test_bus_workflow_issues_bus_event_between_init_and_fetch(self):
        transport = DryRunTransport()
        result = run_average_measurement(
            transport,
            MeasurementConfig(trigger_source="BUS", require_physical_confirmation=False),
        )
        self.assertAlmostEqual(result.power_dbm, -20.0)
        commands = [item.command for item in transport.history]
        self.assertLess(commands.index("INIT"), commands.index("*TRG"))
        self.assertLess(commands.index("*TRG"), commands.index("FETC?"))

    def test_hold_is_rejected_and_released_by_abort(self):
        transport = DryRunTransport()
        with self.assertRaisesRegex(ValueError, "HOLD cannot complete"):
            run_average_measurement(
                transport,
                MeasurementConfig(trigger_source="HOLD", require_physical_confirmation=False),
            )
        self.assertIn("ABOR", [item.command for item in transport.history])
        self.assertTrue(transport.closed)

    def test_abort_failure_is_never_reported_as_success(self):
        class AbortFailureTransport(DryRunTransport):
            def write(self, command):
                if command.strip().upper() == "ABOR":
                    raise RuntimeError("USB link lost")
                super().write(command)

        transport = AbortFailureTransport()
        with self.assertRaisesRegex(CleanupError, "ABOR"):
            run_average_measurement(
                transport,
                MeasurementConfig(require_physical_confirmation=False),
            )
        self.assertTrue(transport.closed)

    def test_pa_math_uses_linear_rf_power(self):
        result = calculate_pa_power(-10, 20, 0, 40, 28, 0.5)
        self.assertAlmostEqual(result.pin_dbm, 10)
        self.assertAlmostEqual(result.pout_dbm, 40)
        self.assertAlmostEqual(result.gain_db, 30)
        self.assertAlmostEqual(result.dc_power_w, 14)
        self.assertAlmostEqual(result.pae_percent, 71.357142857, places=6)


if __name__ == "__main__":
    unittest.main()
