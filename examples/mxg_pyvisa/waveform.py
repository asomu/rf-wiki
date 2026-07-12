"""Dependency-free I/Q generation and IEEE 488.2 binary block encoding."""

import math
import struct
from typing import Iterable, List, Sequence


MIN_N5182B_WAVEFORM_SAMPLES = 60


def _validate_normalized(value: float, label: str) -> None:
    if not math.isfinite(value):
        raise ValueError("{} must be finite".format(label))
    if value < -1.0 or value > 1.0:
        raise ValueError("{} must be in the normalized range [-1, 1]".format(label))


def quantize_normalized_int16(value: float) -> int:
    """Map normalized DAC data to signed 16-bit two's-complement values."""

    _validate_normalized(value, "I/Q value")
    if value < 0:
        return int(round(value * 32768.0))
    return int(round(value * 32767.0))


def encode_iq_int16(samples: Iterable[complex], byte_order: str = "big") -> bytes:
    """Encode I0,Q0,I1,Q1... as interleaved signed 16-bit integers."""

    if byte_order not in {"big", "little"}:
        raise ValueError("byte_order must be 'big' or 'little'")

    prefix = ">" if byte_order == "big" else "<"
    payload = bytearray()
    count = 0
    for count, sample in enumerate(samples, start=1):
        i_value = float(sample.real)
        q_value = float(sample.imag)
        _validate_normalized(i_value, "I[{}]".format(count - 1))
        _validate_normalized(q_value, "Q[{}]".format(count - 1))
        payload.extend(
            struct.pack(
                prefix + "hh",
                quantize_normalized_int16(i_value),
                quantize_normalized_int16(q_value),
            )
        )

    if count == 0:
        raise ValueError("at least one I/Q sample is required")
    return bytes(payload)


def ieee4882_definite_block(payload: bytes) -> bytes:
    """Prefix payload with #<digit-count><byte-count> for SCPI binary transfer."""

    if not payload:
        raise ValueError("binary block payload must not be empty")
    byte_count = str(len(payload)).encode("ascii")
    if len(byte_count) > 9:
        raise ValueError("payload is too large for an IEEE 488.2 definite block")
    return b"#" + str(len(byte_count)).encode("ascii") + byte_count + payload


def generate_iq_tone(
    sample_count: int,
    sample_rate_hz: float,
    tone_offset_hz: float,
    amplitude: float,
) -> List[complex]:
    """Generate a periodic complex baseband tone for the learning example."""

    if sample_count < MIN_N5182B_WAVEFORM_SAMPLES:
        raise ValueError(
            "sample_count must be at least {} for N5182B waveform playback".format(
                MIN_N5182B_WAVEFORM_SAMPLES
            )
        )
    if not math.isfinite(sample_rate_hz) or sample_rate_hz <= 0:
        raise ValueError("sample_rate_hz must be positive and finite")
    if not math.isfinite(tone_offset_hz):
        raise ValueError("tone_offset_hz must be finite")
    if abs(tone_offset_hz) >= sample_rate_hz / 2:
        raise ValueError("tone_offset_hz must remain inside the Nyquist interval")
    if not math.isfinite(amplitude) or amplitude <= 0 or amplitude > 1:
        raise ValueError("amplitude must be in (0, 1]")

    return [
        amplitude
        * complex(
            math.cos(2.0 * math.pi * tone_offset_hz * index / sample_rate_hz),
            math.sin(2.0 * math.pi * tone_offset_hz * index / sample_rate_hz),
        )
        for index in range(sample_count)
    ]


def waveform_rms(samples: Sequence[complex]) -> float:
    if not samples:
        raise ValueError("at least one I/Q sample is required")
    return math.sqrt(sum(abs(sample) ** 2 for sample in samples) / len(samples))
