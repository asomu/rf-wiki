import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from examples.mxg_pyvisa.cli import build_parser, main, validate_args
from examples.mxg_pyvisa.driver import CleanupReport
from examples.mxg_pyvisa.workflow import SessionSafetyError


class CliSafetyTests(unittest.TestCase):
    def test_default_is_dry_run_with_rf_off(self) -> None:
        args = build_parser().parse_args([])
        self.assertFalse(args.execute)
        self.assertFalse(args.rf_on)
        self.assertEqual(args.resource, "MXG")

    def test_rf_on_requires_execute(self) -> None:
        args = build_parser().parse_args(["--rf-on"])
        with self.assertRaisesRegex(ValueError, "requires --execute"):
            validate_args(args)

    def test_unknown_rf_state_is_nonzero_and_prominent(self) -> None:
        cleanup_error = SessionSafetyError(
            CleanupReport("unknown", ("OUTP? verification: timeout",))
        )
        stdout = io.StringIO()
        stderr = io.StringIO()
        with patch(
            "examples.mxg_pyvisa.cli.run_session", side_effect=cleanup_error
        ), redirect_stdout(stdout), redirect_stderr(stderr):
            result = main([])

        self.assertEqual(result, 1)
        self.assertIn("RF STATE UNKNOWN", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
