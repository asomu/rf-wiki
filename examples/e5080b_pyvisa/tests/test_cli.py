from __future__ import annotations

import unittest

from examples.e5080b_pyvisa import acquire_sparameters, cli, pa_gain_sweep


class CliSafetyTest(unittest.TestCase):
    def test_generic_s12_execution_requires_reverse_drive_consent(self) -> None:
        with self.assertRaisesRegex(SystemExit, "reverse-drive"):
            cli.main(["--execute", "--rf-on", "--parameter", "S12"])

    def test_acquisition_s22_execution_requires_reverse_drive_consent(self) -> None:
        with self.assertRaisesRegex(SystemExit, "reverse-drive"):
            acquire_sparameters.main([
                "--execute", "--rf-on", "--parameter", "S22", "--expected-calset", "CalSet1",
            ])

    def test_physical_corrected_trace_requires_expected_calset(self) -> None:
        with self.assertRaisesRegex(SystemExit, "expected-calset"):
            acquire_sparameters.main(["--execute", "--rf-on", "--parameter", "S21"])

    def test_physical_sweep_requires_station_power_limits_before_visa_open(self) -> None:
        with self.assertRaisesRegex(SystemExit, "dut-input-limit"):
            cli.main(["--execute", "--rf-on"])

    def test_pa_sweep_rejects_receiver_overdrive_before_visa_open(self) -> None:
        with self.assertRaisesRegex(SystemExit, "receiver input"):
            pa_gain_sweep.main([
                "--execute", "--rf-on",
                "--dut-input-limit-dbm", "-10",
                "--receiver-input-limit-dbm", "-15",
                "--maximum-dut-gain-db", "20",
            ])


if __name__ == "__main__":
    unittest.main()
