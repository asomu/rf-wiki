from __future__ import annotations

import io
import unittest
from contextlib import redirect_stdout

from examples.n9020b_pyvisa import cli, iq_capture


class CliTests(unittest.TestCase):
    def test_execute_requires_connector_envelope_before_visa_open(self) -> None:
        with self.assertRaisesRegex(SystemExit, "connector safety envelope"):
            cli.main(["--execute"])

    def test_acquire_flag_without_execute_is_rejected(self) -> None:
        with self.assertRaisesRegex(SystemExit, "only needed with --execute"):
            cli.main(["--acquire"])

    def test_default_run_is_dry_and_includes_trace_and_cleanup(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(cli.main([]), 0)
        rendered = output.getvalue()
        self.assertIn("DRY RUN", rendered)
        self.assertIn("TRAC? TRACE1", rendered)
        self.assertIn("ABOR does not remove RF or DC", rendered)

    def test_iq_sizing_relation_and_execution_boundary(self) -> None:
        sizing = iq_capture.calculate_iq_sizing(100e6, 1_000_000)
        self.assertAlmostEqual(sizing.sample_rate_hz, 125e6)
        self.assertAlmostEqual(sizing.duration_seconds, 0.008)
        self.assertAlmostEqual(sizing.bin_spacing_hz, 125.0)
        with self.assertRaisesRegex(SystemExit, "intentionally unsupported"):
            iq_capture.main(["--execute"])


if __name__ == "__main__":
    unittest.main()
