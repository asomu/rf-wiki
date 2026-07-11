import { useMemo, useState } from 'react';
import {
  createDeterministicQpskRecord,
  type DeterministicQpskRecord,
} from '@/lib/rf';

export interface LinkedSignalLabState {
  readonly record: DeterministicQpskRecord;
  readonly rbwKhz: number;
  readonly frequencyOffsetKhz: number;
  readonly commonPhaseDegrees: number;
  readonly markerSymbolIndex: number;
  readonly setRbwKhz: (value: number) => void;
  readonly setFrequencyOffsetKhz: (value: number) => void;
  readonly setCommonPhaseDegrees: (value: number) => void;
  readonly setMarkerSymbolIndex: (value: number) => void;
}

export const linkedSignalDefaults = Object.freeze({
  sampleRateHz: 1_024_000,
  symbolCount: 32,
  samplesPerSymbol: 16,
  noiseRms: 0.008,
  seed: 89600,
});

export function useLinkedSignalState(): LinkedSignalLabState {
  const [rbwKhz, setRbwKhz] = useState(100);
  const [frequencyOffsetKhz, setFrequencyOffsetKhz] = useState(0);
  const [commonPhaseDegrees, setCommonPhaseDegrees] = useState(30);
  const [markerSymbolIndex, setMarkerSymbolIndex] = useState(4);
  const record = useMemo(() => createDeterministicQpskRecord({
    ...linkedSignalDefaults,
    frequencyOffsetHz: frequencyOffsetKhz * 1_000,
    commonPhaseDegrees,
  }), [commonPhaseDegrees, frequencyOffsetKhz]);

  return {
    record,
    rbwKhz,
    frequencyOffsetKhz,
    commonPhaseDegrees,
    markerSymbolIndex,
    setRbwKhz,
    setFrequencyOffsetKhz,
    setCommonPhaseDegrees,
    setMarkerSymbolIndex,
  };
}
