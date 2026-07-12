import struct
import unittest

from examples.mxg_pyvisa.waveform import (
    encode_iq_int16,
    generate_iq_tone,
    ieee4882_definite_block,
    waveform_rms,
)


class WaveformEncodingTests(unittest.TestCase):
    def test_big_endian_interleaves_i_then_q(self) -> None:
        encoded = encode_iq_int16([complex(1.0, -1.0), complex(0.0, 0.5)])
        self.assertEqual(encoded, struct.pack(">hhhh", 32767, -32768, 0, 16384))

    def test_little_endian_encoding(self) -> None:
        encoded = encode_iq_int16([complex(-0.5, 0.25)], byte_order="little")
        self.assertEqual(encoded, struct.pack("<hh", -16384, 8192))

    def test_rejects_out_of_range_iq(self) -> None:
        with self.assertRaisesRegex(ValueError, "normalized range"):
            encode_iq_int16([complex(1.01, 0.0)])

    def test_ieee4882_block_contains_exact_byte_count(self) -> None:
        self.assertEqual(ieee4882_definite_block(b"1234567890"), b"#2101234567890")

    def test_periodic_tone_and_rms(self) -> None:
        samples = generate_iq_tone(512, 512_000.0, 1_000.0, 0.5)
        self.assertEqual(len(samples), 512)
        self.assertAlmostEqual(waveform_rms(samples), 0.5, places=12)

    def test_n5182b_minimum_is_60_samples_without_a_quantum(self) -> None:
        self.assertEqual(
            len(generate_iq_tone(60, 1_000_000.0, 1_000.0, 0.5)), 60
        )
        self.assertEqual(
            len(generate_iq_tone(61, 1_000_000.0, 1_000.0, 0.5)), 61
        )
        with self.assertRaisesRegex(ValueError, "at least 60"):
            generate_iq_tone(59, 1_000_000.0, 1_000.0, 0.5)


if __name__ == "__main__":
    unittest.main()
