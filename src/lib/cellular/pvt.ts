export type PvtViolationRegion =
  | 'pre-burst'
  | 'ramp-up'
  | 'early-settling'
  | 'plateau'
  | 'ramp-down'
  | 'post-burst';

export type PvtBoundaryKind = 'upper' | 'lower';
export type PvtPrediction = 'pass' | 'ramp-up' | 'plateau' | 'ramp-down' | 'off-region';

export interface PvtParameters {
  rampUpUs: number;
  rampDownUs: number;
  timingOffsetUs: number;
  overshootDb: number;
  settlingUs: number;
  ringingDb: number;
  noiseFloorDbc: number;
  seed: number;
}

export interface PvtParameterDefinition {
  key: Exclude<keyof PvtParameters, 'seed'>;
  label: string;
  shortLabel: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  explanation: string;
}

export interface PvtMaskPoint {
  timeUs: number;
  upperDbc: number;
  lowerDbc: number | null;
}

export interface PvtTracePoint {
  timeUs: number;
  powerDbc: number;
  upperMaskDbc: number;
  lowerMaskDbc: number | null;
  marginDb: number;
}

export interface PvtViolation {
  startUs: number;
  endUs: number;
  worstMarginDb: number;
  boundary: PvtBoundaryKind;
  region: PvtViolationRegion;
}

export interface PvtEvaluation {
  pass: boolean;
  worstMarginDb: number;
  worstTimeUs: number;
  firstViolationTimeUs: number | null;
  violations: PvtViolation[];
  possibleCauses: string[];
}

export interface PvtSimulationResult {
  trace: PvtTracePoint[];
  evaluation: PvtEvaluation;
}

export interface PvtSimulationProfile {
  id: string;
  name: string;
  context: string;
  educationalOnly: true;
  source: string;
  assumptions: string[];
  burstStartUs: number;
  burstEndUs: number;
  chartStartUs: number;
  chartEndUs: number;
  mask: PvtMaskPoint[];
}

export interface PvtScenario {
  id: string;
  title: string;
  shortTitle: string;
  cue: string;
  parameters: PvtParameters;
  expectedDiagnosis: string;
  evidence: string;
  explanation: string;
  expectedTrace: {
    pass: boolean;
    firstRegion: PvtViolationRegion | null;
    firstBoundary: PvtBoundaryKind | null;
    worstRegion: PvtViolationRegion | null;
    worstBoundary: PvtBoundaryKind | null;
    minimumViolationGroups: number;
  };
}

export const PVT_DEFAULT_PARAMETERS: PvtParameters = {
  rampUpUs: 20,
  rampDownUs: 20,
  timingOffsetUs: 0,
  overshootDb: 0.35,
  settlingUs: 12,
  ringingDb: 0.15,
  noiseFloorDbc: -62,
  seed: 23,
};

export const PVT_PARAMETER_DEFINITIONS: readonly PvtParameterDefinition[] = [
  {
    key: 'rampUpUs',
    label: 'Ramp-up time',
    shortLabel: 'RAMP ↑',
    unit: 'µs',
    min: 10,
    max: 32,
    step: 1,
    explanation: 'PA가 off level에서 nominal power에 도달하는 시간',
  },
  {
    key: 'rampDownUs',
    label: 'Ramp-down time',
    shortLabel: 'RAMP ↓',
    unit: 'µs',
    min: 10,
    max: 32,
    step: 1,
    explanation: 'Nominal power에서 off level로 내려가는 시간',
  },
  {
    key: 'timingOffsetUs',
    label: 'Timing offset',
    shortLabel: 'OFFSET',
    unit: 'µs',
    min: -10,
    max: 10,
    step: 1,
    explanation: '전체 burst가 기준 시간에서 이동한 정도',
  },
  {
    key: 'overshootDb',
    label: 'Turn-on overshoot',
    shortLabel: 'OVER',
    unit: 'dB',
    min: 0,
    max: 4,
    step: 0.1,
    explanation: 'Ramp 직후 nominal power를 초과하는 peak',
  },
  {
    key: 'settlingUs',
    label: 'Settling constant',
    shortLabel: 'SETTLE',
    unit: 'µs',
    min: 4,
    max: 48,
    step: 1,
    explanation: 'Overshoot와 ringing이 감소하는 시간 상수',
  },
  {
    key: 'ringingDb',
    label: 'Ringing amplitude',
    shortLabel: 'RING',
    unit: 'dB',
    min: 0,
    max: 3,
    step: 0.1,
    explanation: 'Turn-on 이후 반복되는 감쇠 진동의 크기',
  },
  {
    key: 'noiseFloorDbc',
    label: 'Off-region floor',
    shortLabel: 'FLOOR',
    unit: 'dBc',
    min: -72,
    max: -22,
    step: 1,
    explanation: 'Burst 바깥에서 보이는 leakage와 noise floor',
  },
] as const;

export const PVT_EDUCATIONAL_PROFILE: PvtSimulationProfile = {
  id: 'dcs1800-ms-gmsk-normal-educational-v1',
  name: 'DCS 1800 · MS uplink · GMSK normal burst',
  context: '교육용 상대 전력 모델 · nominal plateau 0 dBc 기준',
  educationalOnly: true,
  source: '3GPP TS 45.002 / 45.004 / 45.005 / 51.010-1 source family',
  assumptions: [
    'Useful burst window is normalized to 0…542.8 µs.',
    'Mask corners are an educational corridor, not official conformance limits.',
    'Power is referenced to the nominal plateau amplitude before transient terms.',
  ],
  burstStartUs: 0,
  burstEndUs: 542.8,
  chartStartUs: -32,
  chartEndUs: 574.8,
  mask: [
    { timeUs: -32, upperDbc: -30, lowerDbc: null },
    { timeUs: -20, upperDbc: -30, lowerDbc: null },
    { timeUs: -18, upperDbc: -29, lowerDbc: null },
    { timeUs: -16, upperDbc: -17, lowerDbc: null },
    { timeUs: -14, upperDbc: -11, lowerDbc: -44 },
    { timeUs: -12, upperDbc: -7, lowerDbc: -36 },
    { timeUs: -10, upperDbc: -4, lowerDbc: -30 },
    { timeUs: -8, upperDbc: -2, lowerDbc: -18 },
    { timeUs: -6, upperDbc: 0, lowerDbc: -12 },
    { timeUs: -4, upperDbc: 1, lowerDbc: -8 },
    { timeUs: 0, upperDbc: 1, lowerDbc: -6 },
    { timeUs: 8, upperDbc: 1, lowerDbc: -1 },
    { timeUs: 534.8, upperDbc: 1, lowerDbc: -1 },
    { timeUs: 542.8, upperDbc: 1, lowerDbc: -6 },
    { timeUs: 546.8, upperDbc: 1, lowerDbc: -8 },
    { timeUs: 548.8, upperDbc: 0, lowerDbc: -12 },
    { timeUs: 550.8, upperDbc: -2, lowerDbc: -18 },
    { timeUs: 552.8, upperDbc: -4, lowerDbc: -30 },
    { timeUs: 554.8, upperDbc: -7, lowerDbc: -36 },
    { timeUs: 556.8, upperDbc: -11, lowerDbc: -44 },
    { timeUs: 558.8, upperDbc: -17, lowerDbc: null },
    { timeUs: 560.8, upperDbc: -29, lowerDbc: null },
    { timeUs: 562.8, upperDbc: -30, lowerDbc: null },
    { timeUs: 574.8, upperDbc: -30, lowerDbc: null },
  ],
};

export const PVT_SCENARIOS: readonly PvtScenario[] = [
  {
    id: 'baseline',
    title: 'CASE 01 · Quiet bench',
    shortTitle: '기준 파형',
    cue: '기준 조건에서 margin이 가장 좁은 위치를 찾습니다.',
    parameters: PVT_DEFAULT_PARAMETERS,
    expectedDiagnosis: '정상 기준 파형',
    evidence: '모든 sample의 margin이 0 dB 이상',
    explanation: '기준 파형은 교육용 corridor 안에서 ramp, plateau, off-region을 모두 유지합니다.',
    expectedTrace: {
      pass: true,
      firstRegion: null,
      firstBoundary: null,
      worstRegion: null,
      worstBoundary: null,
      minimumViolationGroups: 0,
    },
  },
  {
    id: 'early-timing',
    title: 'CASE 02 · Too soon',
    shortTitle: '이른 timing',
    cue: 'Leading edge가 corridor보다 먼저 나타납니다.',
    parameters: { ...PVT_DEFAULT_PARAMETERS, timingOffsetUs: -8 },
    expectedDiagnosis: 'PA enable 또는 trigger가 너무 이름',
    evidence: 'pre-burst/ramp-up 영역의 upper boundary 이탈',
    explanation: '전체 trace가 왼쪽으로 이동해 off-region 제한을 먼저 침범합니다.',
    expectedTrace: {
      pass: false,
      firstRegion: 'pre-burst',
      firstBoundary: 'upper',
      worstRegion: 'ramp-down',
      worstBoundary: 'lower',
      minimumViolationGroups: 3,
    },
  },
  {
    id: 'late-ramp',
    title: 'CASE 03 · Late arrival',
    shortTitle: '늦은 ramp',
    cue: 'Burst 시작 시점에 nominal power에 도달하지 못합니다.',
    parameters: { ...PVT_DEFAULT_PARAMETERS, timingOffsetUs: 10, rampUpUs: 10 },
    expectedDiagnosis: 'Ramp-up 또는 bias sequence가 늦음',
    evidence: 'ramp-up 영역의 lower boundary 이탈',
    explanation: 'PA turn-on 기준이 늦어져 start corridor가 요구하는 전력보다 아래에 머뭅니다.',
    expectedTrace: {
      pass: false,
      firstRegion: 'ramp-up',
      firstBoundary: 'lower',
      worstRegion: 'ramp-up',
      worstBoundary: 'lower',
      minimumViolationGroups: 3,
    },
  },
  {
    id: 'overshoot',
    title: 'CASE 04 · Hot start',
    shortTitle: 'Overshoot',
    cue: 'Turn-on 직후 한 번 크게 치솟고 서서히 안정됩니다.',
    parameters: { ...PVT_DEFAULT_PARAMETERS, overshootDb: 2.8, settlingUs: 18 },
    expectedDiagnosis: 'Turn-on overshoot가 큼',
    evidence: 'early-settling 영역의 upper boundary 이탈',
    explanation: 'Control step에 대한 응답이 너무 커 초기 plateau 상한을 넘습니다.',
    expectedTrace: {
      pass: false,
      firstRegion: 'early-settling',
      firstBoundary: 'upper',
      worstRegion: 'early-settling',
      worstBoundary: 'upper',
      minimumViolationGroups: 1,
    },
  },
  {
    id: 'ringing',
    title: 'CASE 05 · Unquiet loop',
    shortTitle: 'Ringing',
    cue: '초기 plateau에서 여러 개의 peak가 반복됩니다.',
    parameters: { ...PVT_DEFAULT_PARAMETERS, overshootDb: 1, ringingDb: 1.8, settlingUs: 34 },
    expectedDiagnosis: 'Control path가 underdamped 상태',
    evidence: 'early-settling 영역에 반복 upper violation',
    explanation: 'Underdamped response의 반복 peak가 early-settling 상한을 여러 번 침범합니다.',
    expectedTrace: {
      pass: false,
      firstRegion: 'early-settling',
      firstBoundary: 'upper',
      worstRegion: 'early-settling',
      worstBoundary: 'upper',
      minimumViolationGroups: 4,
    },
  },
  {
    id: 'high-noise',
    title: 'CASE 06 · Door left open',
    shortTitle: '높은 off floor',
    cue: 'Useful burst는 깨끗하지만 burst 밖 power가 높습니다.',
    parameters: { ...PVT_DEFAULT_PARAMETERS, noiseFloorDbc: -24 },
    expectedDiagnosis: 'Off-region leakage 또는 noise floor가 높음',
    evidence: 'pre/post-burst upper boundary 이탈',
    explanation: 'Plateau만 보면 정상처럼 보이지만 off-region 제한을 만족하지 못합니다.',
    expectedTrace: {
      pass: false,
      firstRegion: 'pre-burst',
      firstBoundary: 'upper',
      worstRegion: 'pre-burst',
      worstBoundary: 'upper',
      minimumViolationGroups: 4,
    },
  },
] as const;

export function validatePvtParameters(parameters: PvtParameters): PvtParameters {
  for (const definition of PVT_PARAMETER_DEFINITIONS) {
    const value = parameters[definition.key];
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
      throw new RangeError(
        `${definition.key} must be within ${definition.min}…${definition.max} ${definition.unit}`,
      );
    }
  }
  if (!Number.isInteger(parameters.seed) || parameters.seed < 1 || parameters.seed > 9999) {
    throw new RangeError('seed must be an integer within 1…9999');
  }
  return parameters;
}

function mulberry32(initialSeed: number) {
  let seed = initialSeed;
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized * normalized * (3 - 2 * normalized);
}

function amplitudeToDb(amplitude: number, floorDbc: number) {
  if (amplitude <= 0) return floorDbc;
  return Math.max(floorDbc, 20 * Math.log10(amplitude));
}

function interpolateMask(timeUs: number, mask: readonly PvtMaskPoint[]) {
  const exact = mask.find((point) => point.timeUs === timeUs);
  if (exact) return { upper: exact.upperDbc, lower: exact.lowerDbc };

  const rightIndex = mask.findIndex((point) => point.timeUs > timeUs);
  if (rightIndex <= 0) {
    const point = rightIndex === 0 ? mask[0] : mask[mask.length - 1];
    if (!point) throw new RangeError('PVT mask must contain at least one point');
    return { upper: point.upperDbc, lower: point.lowerDbc };
  }

  const left = mask[rightIndex - 1];
  const right = mask[rightIndex];
  if (!left || !right) throw new RangeError('PVT mask interpolation points are missing');
  const ratio = (timeUs - left.timeUs) / (right.timeUs - left.timeUs);
  const upper = left.upperDbc + (right.upperDbc - left.upperDbc) * ratio;
  const lower = left.lowerDbc === null || right.lowerDbc === null
    ? null
    : left.lowerDbc + (right.lowerDbc - left.lowerDbc) * ratio;
  return { upper, lower };
}

function regionForTime(
  timeUs: number,
  profile: PvtSimulationProfile,
  boundary: PvtBoundaryKind,
): PvtViolationRegion {
  if (timeUs < profile.burstStartUs - 20) return 'pre-burst';
  if (timeUs < profile.burstStartUs) return 'ramp-up';
  if (timeUs < profile.burstStartUs + 8 && boundary === 'lower') return 'ramp-up';
  if (timeUs < profile.burstStartUs + 90) return 'early-settling';
  if (timeUs < profile.burstEndUs - 8) return 'plateau';
  if (timeUs <= profile.burstEndUs + 20) return 'ramp-down';
  return 'post-burst';
}

function causeLabels(violations: readonly PvtViolation[]) {
  const regions = new Set(violations.map((violation) => violation.region));
  const causes: string[] = [];
  if (regions.has('pre-burst')) causes.push('PA enable 또는 trigger가 너무 이른지 확인');
  if (regions.has('ramp-up')) causes.push('Ramp-up slew와 bias sequence timing 확인');
  if (regions.has('early-settling')) causes.push('Turn-on overshoot와 control-loop settling 확인');
  if (regions.has('plateau')) causes.push('Ringing, gain ripple 또는 지속 settling 확인');
  if (regions.has('ramp-down')) causes.push('Ramp-down slew와 switch/bias turn-off timing 확인');
  if (regions.has('post-burst')) causes.push('Leakage, isolation 또는 off-region noise floor 확인');
  return causes.length > 0 ? causes : ['Trace는 현재 교육용 corridor 안에 있습니다.'];
}

export function evaluatePvtTrace(
  trace: readonly PvtTracePoint[],
  profile = PVT_EDUCATIONAL_PROFILE,
): PvtEvaluation {
  let worstMarginDb = Number.POSITIVE_INFINITY;
  let worstTimeUs = profile.chartStartUs;
  const raw: Array<{ point: PvtTracePoint; boundary: PvtBoundaryKind }> = [];

  for (const point of trace) {
    const upperMargin = point.upperMaskDbc - point.powerDbc;
    const lowerMargin = point.lowerMaskDbc === null
      ? Number.POSITIVE_INFINITY
      : point.powerDbc - point.lowerMaskDbc;
    const margin = Math.min(upperMargin, lowerMargin);
    if (margin < worstMarginDb) {
      worstMarginDb = margin;
      worstTimeUs = point.timeUs;
    }
    if (margin < 0) {
      raw.push({ point, boundary: upperMargin < lowerMargin ? 'upper' : 'lower' });
    }
  }

  const violations: PvtViolation[] = [];
  for (const item of raw) {
    const region = regionForTime(item.point.timeUs, profile, item.boundary);
    const previous = violations.at(-1);
    if (
      previous
      && previous.boundary === item.boundary
      && previous.region === region
      && item.point.timeUs - previous.endUs <= 1.05
    ) {
      previous.endUs = item.point.timeUs;
      previous.worstMarginDb = Math.min(previous.worstMarginDb, item.point.marginDb);
    } else {
      violations.push({
        startUs: item.point.timeUs,
        endUs: item.point.timeUs,
        worstMarginDb: item.point.marginDb,
        boundary: item.boundary,
        region,
      });
    }
  }

  return {
    pass: violations.length === 0,
    worstMarginDb,
    worstTimeUs,
    firstViolationTimeUs: violations[0]?.startUs ?? null,
    violations,
    possibleCauses: causeLabels(violations),
  };
}

export function simulatePvt(
  input: PvtParameters,
  profile = PVT_EDUCATIONAL_PROFILE,
): PvtSimulationResult {
  const parameters = validatePvtParameters(input);
  const random = mulberry32(parameters.seed);
  const times = new Set<number>();
  for (let time = profile.chartStartUs; time <= profile.chartEndUs; time += 1) {
    times.add(Number(time.toFixed(1)));
  }
  profile.mask.forEach((point) => times.add(point.timeUs));

  const shiftedStart = profile.burstStartUs + parameters.timingOffsetUs;
  const shiftedEnd = profile.burstEndUs + parameters.timingOffsetUs;
  const rampStart = shiftedStart - parameters.rampUpUs;
  const rampEnd = shiftedEnd + parameters.rampDownUs;

  const trace = [...times]
    .sort((left, right) => left - right)
    .map((timeUs): PvtTracePoint => {
      let amplitude = 0;
      if (timeUs >= rampStart && timeUs < shiftedStart) {
        amplitude = smoothstep((timeUs - rampStart) / parameters.rampUpUs);
      } else if (timeUs >= shiftedStart && timeUs <= shiftedEnd) {
        amplitude = 1;
      } else if (timeUs > shiftedEnd && timeUs <= rampEnd) {
        amplitude = 1 - smoothstep((timeUs - shiftedEnd) / parameters.rampDownUs);
      }

      let powerDbc = amplitudeToDb(amplitude, parameters.noiseFloorDbc);
      if (timeUs >= shiftedStart && timeUs <= shiftedEnd) {
        const elapsed = timeUs - shiftedStart;
        const decay = Math.exp(-elapsed / parameters.settlingUs);
        const overshoot = parameters.overshootDb * decay;
        const ringing = parameters.ringingDb * decay * Math.sin((elapsed / 10.5) * Math.PI * 2);
        powerDbc += overshoot + ringing + (random() - 0.5) * 0.055;
      } else {
        powerDbc += (random() - 0.5) * 0.6;
      }
      powerDbc = Math.max(-80, Math.min(6, powerDbc));

      const mask = interpolateMask(timeUs, profile.mask);
      const upperMargin = mask.upper - powerDbc;
      const lowerMargin = mask.lower === null
        ? Number.POSITIVE_INFINITY
        : powerDbc - mask.lower;
      return {
        timeUs,
        powerDbc,
        upperMaskDbc: mask.upper,
        lowerMaskDbc: mask.lower,
        marginDb: Math.min(upperMargin, lowerMargin),
      };
    });

  return { trace, evaluation: evaluatePvtTrace(trace, profile) };
}

export function expectedPvtPrediction(result: PvtSimulationResult): PvtPrediction {
  if (result.evaluation.pass) return 'pass';
  const region = result.evaluation.violations[0]?.region;
  if (region === 'pre-burst' || region === 'post-burst') return 'off-region';
  if (region === 'ramp-up') return 'ramp-up';
  if (region === 'ramp-down') return 'ramp-down';
  return 'plateau';
}
