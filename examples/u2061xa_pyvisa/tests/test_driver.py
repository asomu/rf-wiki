import unittest

from examples.u2061xa_pyvisa.driver import (
    ERROR_DRAIN_MAX_QUERIES,
    ModelMismatchError,
    ScpiError,
    U2061Controller,
)
from examples.u2061xa_pyvisa.transport import DryRunTransport


class ErrorTransport(DryRunTransport):
    def __init__(self, errors):
        super().__init__()
        self._errors = list(errors)


class DriverTests(unittest.TestCase):
    def test_identifies_only_u2061xa(self):
        controller = U2061Controller(DryRunTransport())
        self.assertEqual(controller.identify().model, "U2061XA")

        wrong = U2061Controller(
            DryRunTransport(idn="Keysight Technologies,U2051XA,DEMO,A.03.16")
        )
        with self.assertRaises(ModelMismatchError):
            wrong.identify()

    def test_identify_requires_the_pinned_firmware_baseline(self):
        controller = U2061Controller(
            DryRunTransport(idn="Keysight Technologies,U2061XA,DEMO,A.03.15")
        )
        with self.assertRaisesRegex(ModelMismatchError, "pinned to U2061XA firmware A.03.16"):
            controller.identify()
        self.assertIsNone(controller.identity)

    def test_error_drain_is_bounded_and_requires_zero(self):
        errors = ['-113,"Undefined header"'] * ERROR_DRAIN_MAX_QUERIES
        with self.assertRaises(ScpiError):
            U2061Controller(ErrorTransport(errors)).drain_errors()

    def test_average_config_query_back(self):
        transport = DryRunTransport()
        controller = U2061Controller(transport)
        controller.identify()
        controller.configure_average(3.5e9, 20e-6)
        commands = [item.command for item in transport.history]
        self.assertIn("SENS:DET:FUNC AVER", commands)
        self.assertIn("SENS:SWE:APER 2e-05S", commands)
        self.assertIn("SENS:SWE:APER?", commands)

    def test_aperture_minimum_depends_on_frequency(self):
        controller = U2061Controller(DryRunTransport())
        with self.assertRaises(ValueError):
            controller.configure_average(100e6, 20e-6)

    def test_bus_trigger_requires_init_and_completes_fetch(self):
        transport = DryRunTransport(measurement_dbm=-17.5)
        controller = U2061Controller(transport)
        controller.configure_trigger("BUS")
        with self.assertRaises(RuntimeError):
            controller.fetch_dbm()
        controller.arm()
        controller.send_bus_trigger()
        self.assertAlmostEqual(controller.fetch_dbm(), -17.5)
        commands = [item.command for item in transport.history]
        self.assertLess(commands.index("INIT"), commands.index("*TRG"))
        self.assertLess(commands.index("*TRG"), len(commands) - 1 - commands[::-1].index("FETC?"))

    def test_unarmed_bus_trigger_is_reported_in_error_queue(self):
        transport = DryRunTransport()
        transport.write("TRIG:SOUR BUS")
        transport.write("*TRG")
        self.assertEqual(transport.query("SYST:ERR?"), '-211,"Trigger ignored"')

    def test_hold_can_only_be_released_by_an_explicit_immediate_event(self):
        transport = DryRunTransport()
        controller = U2061Controller(transport)
        controller.configure_trigger("HOLD")
        controller.arm()
        with self.assertRaises(RuntimeError):
            controller.fetch_dbm()
        controller.send_immediate_trigger()
        self.assertAlmostEqual(controller.fetch_dbm(), -20.0)

    def test_continuous_query_back_is_independent_of_arm_state(self):
        transport = DryRunTransport()
        controller = U2061Controller(transport)
        controller.configure_trigger("BUS")
        controller.arm()
        self.assertEqual(transport.query("INIT:CONT?"), "0")


if __name__ == "__main__":
    unittest.main()
