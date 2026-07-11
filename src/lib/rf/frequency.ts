const SPEED_OF_LIGHT_MM_PER_NS = 299.792458;

export interface FrequencyLinkState {
  readonly frequencyGHz: number;
  readonly periodNs: number;
  readonly wavelengthMm: number;
  readonly electricalLengthDegrees: number;
  readonly wrappedPhaseDegrees: number;
  readonly wrappedPhaseRadians: number;
}

/** One-way phase of a lossless cable represented by a scalar velocity factor. */
export function frequencyLinkState(
  frequencyGHz: number,
  cableLengthCm: number,
  velocityFactor: number,
): FrequencyLinkState {
  if (!Number.isFinite(frequencyGHz) || frequencyGHz <= 0) {
    throw new RangeError('Frequency must be finite and positive');
  }
  if (!Number.isFinite(cableLengthCm) || cableLengthCm < 0) {
    throw new RangeError('Cable length must be finite and non-negative');
  }
  if (!Number.isFinite(velocityFactor) || velocityFactor <= 0 || velocityFactor > 1) {
    throw new RangeError('Velocity factor must lie in (0, 1]');
  }

  const periodNs = 1 / frequencyGHz;
  const wavelengthMm = (SPEED_OF_LIGHT_MM_PER_NS * velocityFactor) / frequencyGHz;
  const electricalLengthDegrees = -360 * ((cableLengthCm * 10) / wavelengthMm);
  const wrappedPhaseDegrees = ((electricalLengthDegrees % 360) + 360) % 360;
  return {
    frequencyGHz,
    periodNs,
    wavelengthMm,
    electricalLengthDegrees,
    wrappedPhaseDegrees,
    wrappedPhaseRadians: (wrappedPhaseDegrees * Math.PI) / 180,
  };
}

export function cosineWaveformByCycles(
  frequencyGHz: number,
  cycles = 3,
  sampleCount = 181,
): readonly { x: number; y: number }[] {
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('Waveform sample count must be an integer of at least two');
  }
  if (!Number.isFinite(cycles) || cycles <= 0) {
    throw new RangeError('Waveform cycle count must be finite and positive');
  }
  const { periodNs } = frequencyLinkState(frequencyGHz, 0, 1);
  return Array.from({ length: sampleCount }, (_, index) => {
    const timeNs = (index / (sampleCount - 1)) * cycles * periodNs;
    return { x: timeNs, y: Math.cos(2 * Math.PI * frequencyGHz * timeNs) };
  });
}

export function cosineWaveformByDuration(
  frequencyGHz: number,
  durationNs: number,
  sampleCount = 301,
): readonly { x: number; y: number }[] {
  if (!Number.isFinite(frequencyGHz) || frequencyGHz <= 0) {
    throw new RangeError('Frequency must be finite and positive');
  }
  if (!Number.isFinite(durationNs) || durationNs <= 0) {
    throw new RangeError('Duration must be finite and positive');
  }
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('Waveform sample count must be an integer of at least two');
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const timeNs = (index / (sampleCount - 1)) * durationNs;
    return { x: timeNs, y: Math.cos(2 * Math.PI * frequencyGHz * timeNs) };
  });
}
