"""Host-side forward-wave gain/PAE estimate; opens no instrument."""

from .workflow import calculate_pa_power


def main() -> int:
    result = calculate_pa_power(
        input_sensor_dbm=-10.0,
        input_correction_db=20.0,
        output_sensor_dbm=0.0,
        output_correction_db=40.0,
        supply_voltage_v=28.0,
        supply_current_a=0.5,
    )
    print("Convention: {}".format(result.power_convention))
    print("Pin={:.2f} dBm".format(result.pin_dbm))
    print("Pout={:.2f} dBm".format(result.pout_dbm))
    print("Gain={:.2f} dB".format(result.gain_db))
    print("Pdc={:.2f} W".format(result.dc_power_w))
    print("PAE={:.2f}%".format(result.pae_percent))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
