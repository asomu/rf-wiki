/**
 * Deterministic educational model for the Keysight E5080B-2K0 ENA.
 *
 * It deliberately implements a small, conservative SCPI subset. It is not a
 * browser driver and it must not be used as damage protection for a real VNA.
 */

export interface EnaComplex {
  readonly re: number;
  readonly im: number;
}

export interface EnaSweepState {
  readonly startHz: number;
  readonly stopHz: number;
  readonly points: number;
  readonly ifBandwidthHz: number;
  readonly sourcePowerDbm: number;
  readonly averagingEnabled: boolean;
  readonly averagingCount: number;
  readonly sweepType: 'LIN' | 'LOG';
}

export interface EnaCalibrationState {
  readonly status: 'none' | 'valid' | 'interpolated' | 'questionable' | 'outside-range';
  readonly originalSweep: EnaSweepState | null;
  readonly referencePlane: string;
  readonly method: 'none' | 'SOLT' | 'ECal';
  readonly interpolationEnabled: boolean;
  readonly reasons: readonly string[];
}

export interface EnaState {
  readonly model: 'E5080B';
  readonly firmware: 'A.20.25.03';
  readonly option: '2K0';
  readonly sweep: EnaSweepState;
  readonly rfOutputEnabled: boolean;
  readonly sourcePowerLimitDbm: number;
  readonly sourcePowerLimitEnabled: boolean;
  readonly calibrationPowerLimitDbm: number;
  readonly calibrationPowerLimitEnabled: boolean;
  readonly measurement: 'S11' | 'S21' | 'S12' | 'S22';
  readonly triggerSource: 'IMM' | 'MAN' | 'EXT';
  readonly dataFormat: 'ASC' | 'REAL32';
  readonly byteOrder: 'NORM' | 'SWAP';
  readonly calibration: EnaCalibrationState;
}

export interface EnaScpiError {
  readonly code: number;
  readonly message: string;
}

export interface EnaTranscriptEntry {
  readonly direction: 'write' | 'read';
  readonly message: string;
  readonly outcome: 'accepted' | 'response' | 'error' | 'would-time-out';
  readonly error?: EnaScpiError;
}

export interface EnaSession {
  readonly state: EnaState;
  readonly outputQueue: readonly string[];
  readonly errorQueue: readonly EnaScpiError[];
  readonly pendingOperations: readonly string[];
  readonly acquisition: EnaAcquisitionState;
  readonly transcript: readonly EnaTranscriptEntry[];
}

export interface EnaAcquisitionState {
  readonly status: 'idle' | 'armed' | 'sweeping' | 'complete';
  readonly armedTrigger: 'MAN' | 'EXT' | null;
  readonly dataFresh: boolean;
  readonly sweepCount: number;
}

export interface EnaSweepPoint {
  readonly frequencyHz: number;
  readonly s11: EnaComplex;
  readonly s21: EnaComplex;
  readonly s12: EnaComplex;
  readonly s22: EnaComplex;
}

export interface EnaCommandSource {
  readonly organization: 'Keysight Technologies';
  readonly url: string;
  readonly section: string;
}

export interface EnaCommandDefinition {
  readonly id: string;
  readonly longForm: string;
  readonly shortForm: string;
  readonly forms: readonly ('write' | 'query')[];
  readonly stateEffect: string;
  readonly safetyClass: 'identity' | 'configuration' | 'safety' | 'acquisition' | 'queue';
  readonly supportedModels: readonly ['E5080B'];
  readonly firmwareScope: 'A.20.25.03';
  readonly optionScope: '2K0' | 'base';
  readonly source: EnaCommandSource;
}

const PROGRAMMING_GUIDE = 'https://helpfiles.keysight.com/csg/e5080b/Programming/Programming_Guide.htm';
const COMMAND_TREE = 'https://helpfiles.keysight.com/csg/e5080b/Programming/GP-IB_Command_Finder/SCPI_Command_Tree.htm';

const source = (section: string, url = COMMAND_TREE): EnaCommandSource => ({
  organization: 'Keysight Technologies',
  url,
  section,
});

export const e5080bCommandCatalog: readonly EnaCommandDefinition[] = [
  ['identity', '*IDN?', '*IDN?', ['query'], 'Reads model and firmware.', 'identity', 'base', '*IDN?'],
  ['options', '*OPT?', '*OPT?', ['query'], 'Reads installed hardware options.', 'identity', 'base', '*OPT?'],
  ['clear-status', '*CLS', '*CLS', ['write'], 'Clears status and the educational error queue.', 'queue', 'base', '*CLS'],
  ['operation-complete', '*OPC?', '*OPC?', ['query'], 'Waits for prior operations and returns 1.', 'queue', 'base', '*OPC?'],
  ['system-error', 'SYSTem:ERRor?', 'SYST:ERR?', ['query'], 'Pops one FIFO error.', 'queue', 'base', 'SYSTem:ERRor?'],
  ['rf-output', 'OUTPut', 'OUTP', ['write', 'query'], 'Opens or closes the VNA source path.', 'safety', 'base', 'OUTPut'],
  ['power-limit', 'SYSTem:POWer1:LIMit', 'SYST:POW1:LIM', ['write', 'query'], 'Sets the normal source power ceiling.', 'safety', '2K0', 'SYSTem:POWer:LIMit'],
  ['power-limit-state', 'SYSTem:POWer1:LIMit:STATe', 'SYST:POW1:LIM:STAT', ['write', 'query'], 'Enables the normal source power ceiling.', 'safety', '2K0', 'SYSTem:POWer:LIMit:STATe'],
  ['cal-power-limit', 'SYSTem:POWer1:LIMit:CALibration', 'SYST:POW1:LIM:CAL', ['write', 'query'], 'Sets the guided-calibration ceiling.', 'safety', '2K0', 'SYSTem:POWer:LIMit:CALibration'],
  ['cal-power-limit-state', 'SYSTem:POWer:LIMit:CALibration:STATe', 'SYST:POW:LIM:CAL:STAT', ['write', 'query'], 'Enables the guided-calibration ceiling.', 'safety', '2K0', 'SYSTem:POWer:LIMit:CALibration:STATe'],
  ['source-power', 'SOURce1:POWer1', 'SOUR1:POW1', ['write', 'query'], 'Sets test-port source power.', 'safety', '2K0', 'SOURce:POWer'],
  ['frequency-start', 'SENSe1:FREQuency:STARt', 'SENS1:FREQ:STAR', ['write', 'query'], 'Sets sweep start frequency.', 'configuration', 'base', 'SENSe:FREQuency:STARt'],
  ['frequency-stop', 'SENSe1:FREQuency:STOP', 'SENS1:FREQ:STOP', ['write', 'query'], 'Sets sweep stop frequency.', 'configuration', 'base', 'SENSe:FREQuency:STOP'],
  ['sweep-points', 'SENSe1:SWEep:POINts', 'SENS1:SWE:POIN', ['write', 'query'], 'Sets number of complex frequency points.', 'configuration', 'base', 'SENSe:SWEep:POINts'],
  ['sweep-type', 'SENSe1:SWEep:TYPE', 'SENS1:SWE:TYPE', ['write', 'query'], 'Selects linear or logarithmic frequency spacing.', 'configuration', 'base', 'SENSe:SWEep:TYPE'],
  ['if-bandwidth', 'SENSe1:BANDwidth', 'SENS1:BWID', ['write', 'query'], 'Sets receiver IF bandwidth.', 'configuration', 'base', 'SENSe:BANDwidth'],
  ['averaging-state', 'SENSe1:AVERage:STATe', 'SENS1:AVER:STAT', ['write', 'query'], 'Enables receiver averaging.', 'configuration', 'base', 'SENSe:AVERage:STATe'],
  ['averaging-count', 'SENSe1:AVERage:COUNt', 'SENS1:AVER:COUN', ['write', 'query'], 'Sets averaging count.', 'configuration', 'base', 'SENSe:AVERage:COUNt'],
  ['correction-state', 'SENSe1:CORRection:STATe', 'SENS1:CORR:STAT', ['write', 'query'], 'Enables or disables applied correction.', 'configuration', 'base', 'SENSe:CORRection:STATe'],
  ['measurement', 'CALCulate1:PARameter:DEFine:EXTended', 'CALC1:PAR:DEF:EXT', ['write'], 'Defines an S-parameter measurement.', 'configuration', 'base', 'CALCulate:PARameter:DEFine:EXTended'],
  ['trigger-source', 'TRIGger:SOURce', 'TRIG:SOUR', ['write', 'query'], 'Selects immediate, manual, or external trigger.', 'acquisition', 'base', 'TRIGger:SOURce'],
  ['bus-trigger', '*TRG', '*TRG', ['write'], 'Supplies a manual bus trigger event to an armed sweep.', 'acquisition', 'base', '*TRG'],
  ['abort', 'ABORt', 'ABOR', ['write'], 'Aborts a pending sweep without declaring data valid.', 'acquisition', 'base', 'ABORt'],
  ['initiate', 'INITiate1:IMMediate', 'INIT1:IMM', ['write'], 'Starts one deterministic sweep.', 'acquisition', 'base', 'INITiate:IMMediate'],
  ['data-format', 'FORMat:DATA', 'FORM:DATA', ['write', 'query'], 'Selects ASCII or REAL,32 transfer representation.', 'acquisition', 'base', 'FORMat:DATA'],
  ['byte-order', 'FORMat:BORDer', 'FORM:BORD', ['write', 'query'], 'Selects normal or swapped binary byte order.', 'acquisition', 'base', 'FORMat:BORDer'],
  ['sdata', 'CALCulate1:MEASure1:DATA:SDATa?', 'CALC1:MEAS1:DATA:SDAT?', ['query'], 'Returns corrected complex pairs.', 'acquisition', 'base', 'CALCulate:MEASure:DATA:SDATa?'],
  ['fdata', 'CALCulate1:MEASure1:DATA:FDATa?', 'CALC1:MEAS1:DATA:FDAT?', ['query'], 'Returns display-format data.', 'acquisition', 'base', 'CALCulate:MEASure:DATA:FDATa?'],
  ['x-values', 'CALCulate1:MEASure1:X:VALues?', 'CALC1:MEAS1:X:VAL?', ['query'], 'Returns stimulus frequencies.', 'acquisition', 'base', 'CALCulate:MEASure:X:VALues?'],
].map(([id, longForm, shortForm, forms, stateEffect, safetyClass, optionScope, section]) => ({
  id: id as string,
  longForm: longForm as string,
  shortForm: shortForm as string,
  forms: forms as readonly ('write' | 'query')[],
  stateEffect: stateEffect as string,
  safetyClass: safetyClass as EnaCommandDefinition['safetyClass'],
  supportedModels: ['E5080B'],
  firmwareScope: 'A.20.25.03',
  optionScope: optionScope as EnaCommandDefinition['optionScope'],
  source: source(section as string, ['identity', 'options', 'clear-status', 'operation-complete'].includes(id as string) ? PROGRAMMING_GUIDE : COMMAND_TREE),
}));

export const e5080bProgrammingReference = {
  organization: 'Keysight Technologies' as const,
  model: 'E5080B' as const,
  firmware: 'A.20.25.03' as const,
  url: PROGRAMMING_GUIDE,
};

export const defaultEnaSweep: EnaSweepState = {
  startHz: 1e9,
  stopHz: 6e9,
  points: 201,
  ifBandwidthHz: 1e3,
  sourcePowerDbm: -30,
  averagingEnabled: false,
  averagingCount: 4,
  sweepType: 'LIN',
};

export function createE5080bSession(overrides: Partial<EnaState> = {}): EnaSession {
  return {
    state: {
      model: 'E5080B',
      firmware: 'A.20.25.03',
      option: '2K0',
      sweep: defaultEnaSweep,
      rfOutputEnabled: false,
      sourcePowerLimitDbm: -20,
      sourcePowerLimitEnabled: false,
      calibrationPowerLimitDbm: -20,
      calibrationPowerLimitEnabled: false,
      measurement: 'S21',
      triggerSource: 'IMM',
      dataFormat: 'ASC',
      byteOrder: 'SWAP',
      calibration: {
        status: 'none',
        originalSweep: null,
        referencePlane: 'test ports',
        method: 'none',
        interpolationEnabled: true,
        reasons: ['No calibration has been applied.'],
      },
      ...overrides,
    },
    outputQueue: [],
    errorQueue: [],
    pendingOperations: [],
    acquisition: { status: 'idle', armedTrigger: null, dataFresh: false, sweepCount: 0 },
    transcript: [],
  };
}

const add = (a: EnaComplex, b: EnaComplex): EnaComplex => ({ re: a.re + b.re, im: a.im + b.im });
const divide = (a: EnaComplex, b: EnaComplex): EnaComplex => {
  const denominator = b.re ** 2 + b.im ** 2;
  return { re: (a.re * b.re + a.im * b.im) / denominator, im: (a.im * b.re - a.re * b.im) / denominator };
};
export const enaMagnitude = (value: EnaComplex) => Math.hypot(value.re, value.im);
export const enaPhaseDegrees = (value: EnaComplex) => Math.atan2(value.im, value.re) * 180 / Math.PI;
export const enaLogMagnitudeDb = (value: EnaComplex) => 20 * Math.log10(Math.max(enaMagnitude(value), Number.EPSILON));
export const enaReturnLossDb = (gamma: EnaComplex) => -enaLogMagnitudeDb(gamma);
export const enaVswr = (gamma: EnaComplex) => {
  const magnitude = enaMagnitude(gamma);
  return magnitude >= 1 ? Number.POSITIVE_INFINITY : (1 + magnitude) / (1 - magnitude);
};

export function gammaToImpedance(gamma: EnaComplex, referenceOhms = 50): EnaComplex {
  const normalized = divide(add({ re: 1, im: 0 }, gamma), { re: 1 - gamma.re, im: -gamma.im });
  return { re: normalized.re * referenceOhms, im: normalized.im * referenceOhms };
}

export function impedanceToGamma(impedance: EnaComplex, referenceOhms = 50): EnaComplex {
  return divide({ re: impedance.re - referenceOhms, im: impedance.im }, { re: impedance.re + referenceOhms, im: impedance.im });
}

function polar(magnitude: number, phaseDegrees: number): EnaComplex {
  const phase = phaseDegrees * Math.PI / 180;
  return { re: magnitude * Math.cos(phase), im: magnitude * Math.sin(phase) };
}

export function enaFrequencyGrid(sweep: EnaSweepState): readonly number[] {
  if (sweep.points < 2) return [sweep.startHz];
  return Array.from({ length: sweep.points }, (_, index) => {
    const ratio = index / (sweep.points - 1);
    if (sweep.sweepType === 'LOG') return sweep.startHz * ((sweep.stopHz / sweep.startHz) ** ratio);
    return sweep.startHz + (sweep.stopHz - sweep.startHz) * ratio;
  });
}

/** A reproducible passive two-port with a match resonance and cable delay. */
export function generateEnaSweep(sweep: EnaSweepState): readonly EnaSweepPoint[] {
  const traceNoiseDbRms = estimateEnaTraceNoiseDbRms(sweep);
  return enaFrequencyGrid(sweep).map((frequencyHz, index) => {
    const ghz = frequencyHz / 1e9;
    const resonance = Math.exp(-1 * (((ghz - 3.5) / 0.72) ** 2));
    const s11Magnitude = 0.42 - 0.34 * resonance;
    const deterministicNoise = traceNoiseDbRms * (
      0.76 * Math.sin(index * 2.173 + 0.31)
      + 0.48 * Math.sin(index * 0.731 + 1.17)
    );
    const transmissionDb = -(0.45 + 0.14 * ghz + 1.2 * Math.exp(-1 * (((ghz - 5.1) / 0.55) ** 2)))
      + deterministicNoise;
    const transmissionMagnitude = 10 ** (transmissionDb / 20);
    const delayPhase = -360 * frequencyHz * 1.35e-9;
    return {
      frequencyHz,
      s11: polar(s11Magnitude, 35 - 28 * ghz),
      s21: polar(transmissionMagnitude, delayPhase),
      s12: polar(transmissionMagnitude * 0.997, delayPhase + 0.8),
      s22: polar(0.18 + 0.06 * Math.sin(ghz), -48 + 17 * ghz),
    };
  });
}

export function calculateGroupDelaySeconds(points: readonly EnaSweepPoint[]): readonly number[] {
  if (points.length < 2) return points.map(() => 0);
  const phases = points.map((point) => Math.atan2(point.s21.im, point.s21.re));
  for (let index = 1; index < phases.length; index += 1) {
    const previous = phases[index - 1]!;
    let current = phases[index]!;
    while (current - previous > Math.PI) current -= 2 * Math.PI;
    while (current - previous < -Math.PI) current += 2 * Math.PI;
    phases[index] = current;
  }
  return points.map((_, index) => {
    const left = Math.max(0, index - 1);
    const right = Math.min(points.length - 1, index + 1);
    const deltaFrequency = points[right]!.frequencyHz - points[left]!.frequencyHz;
    return deltaFrequency === 0 ? 0 : -(phases[right]! - phases[left]!) / (2 * Math.PI * deltaFrequency);
  });
}

export function estimateSweepTimeSeconds(sweep: EnaSweepState): number {
  const averaging = sweep.averagingEnabled ? sweep.averagingCount : 1;
  return sweep.points * averaging * (1 / sweep.ifBandwidthHz + 0.000035);
}

/**
 * A deterministic teaching estimate, not an E5080B noise specification.
 * It exists so the IFBW/averaging controls change the trace as well as text.
 */
export function estimateEnaTraceNoiseDbRms(sweep: EnaSweepState): number {
  const averaging = sweep.averagingEnabled ? Math.sqrt(sweep.averagingCount) : 1;
  return 0.03 * Math.sqrt(sweep.ifBandwidthHz / 1e3) / averaging;
}

export function estimateEnaPaCompressionDb(
  inputPowerDbm: number,
  thresholdDbm = -15,
  scaleDb = 8,
): number {
  if (scaleDb <= 0) throw new RangeError('Compression scale must be positive.');
  const driveAboveThresholdDb = Math.max(0, inputPowerDbm - thresholdDbm);
  return (driveAboveThresholdDb / scaleDb) ** 2;
}

export function calibrateEna(sweep: EnaSweepState, method: 'SOLT' | 'ECal', referencePlane = 'cable ends'): EnaCalibrationState {
  return {
    status: 'valid',
    originalSweep: { ...sweep },
    referencePlane,
    method,
    interpolationEnabled: true,
    reasons: ['Stimulus matches the saved calibration grid.'],
  };
}

export function evaluateCalibrationValidity(calibration: EnaCalibrationState, sweep: EnaSweepState): EnaCalibrationState {
  const original = calibration.originalSweep;
  if (!original || calibration.method === 'none') return calibration;
  if (sweep.startHz < original.startHz || sweep.stopHz > original.stopHz) {
    return { ...calibration, status: 'outside-range', reasons: ['Sweep extends outside the calibrated frequency range.'] };
  }
  const questionable: string[] = [];
  if (sweep.ifBandwidthHz !== original.ifBandwidthHz) questionable.push('IF bandwidth changed after calibration.');
  if (sweep.sourcePowerDbm !== original.sourcePowerDbm) questionable.push('Source power changed after calibration.');
  if (sweep.sweepType !== original.sweepType) questionable.push('Sweep type changed after calibration.');
  if (questionable.length > 0) return { ...calibration, status: 'questionable', reasons: questionable };
  if (sweep.startHz !== original.startHz || sweep.stopHz !== original.stopHz || sweep.points !== original.points) {
    return calibration.interpolationEnabled
      ? { ...calibration, status: 'interpolated', reasons: ['Correction terms are interpolated onto the changed in-range grid.'] }
      : { ...calibration, status: 'questionable', reasons: ['Frequency grid changed and interpolation is disabled.'] };
  }
  return { ...calibration, status: 'valid', reasons: ['Stimulus matches the saved calibration grid.'] };
}

export interface FixtureTransformResult {
  readonly measuredS21Db: number;
  readonly deembeddedS21Db: number;
  readonly fixtureLossDb: number;
  readonly residualUncertaintyDb: number;
}

export function deembedSymmetricFixture(measuredS21Db: number, fixtureLossEachDb: number, fixtureModelErrorDb = 0.08): FixtureTransformResult {
  const fixtureLossDb = 2 * Math.max(0, fixtureLossEachDb);
  return {
    measuredS21Db,
    deembeddedS21Db: measuredS21Db + fixtureLossDb,
    fixtureLossDb,
    residualUncertaintyDb: Math.abs(fixtureModelErrorDb),
  };
}

export interface EnaReceiverSafetyDecision {
  readonly port2ReceiverInputDbm: number;
  readonly permittedDbm: number;
  readonly safe: boolean;
  readonly reason: string;
}

export function evaluateEnaReceiverSafety(
  dutOutputDbm: number,
  externalAttenuationDb: number,
  conservativeWorkingLimitDbm: number,
  guardMarginDb = 3,
): EnaReceiverSafetyDecision {
  const port2ReceiverInputDbm = dutOutputDbm - externalAttenuationDb;
  const permittedDbm = conservativeWorkingLimitDbm - guardMarginDb;
  return {
    port2ReceiverInputDbm,
    permittedDbm,
    safe: port2ReceiverInputDbm <= permittedDbm,
    reason: port2ReceiverInputDbm <= permittedDbm
      ? 'External attenuation keeps the estimated receiver input below the chosen working limit.'
      : 'Add external attenuation/coupling or reduce drive before connecting the PA output.',
  };
}

const parseNumber = (argument: string): number | null => {
  const match = argument.trim().toUpperCase().match(/^([-+]?\d+(?:\.\d+)?(?:E[-+]?\d+)?)\s*(HZ|KHZ|MHZ|GHZ|DBM)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const multiplier: Record<string, number> = { HZ: 1, KHZ: 1e3, MHZ: 1e6, GHZ: 1e9, DBM: 1 };
  return value * (match[2] ? multiplier[match[2]]! : 1);
};

const normalizeHeader = (header: string) => header.trim().replace(/^:/, '').toUpperCase();

export interface ParsedEnaCommand {
  readonly id: string;
  readonly form: 'write' | 'query';
  readonly argument: string | null;
  readonly raw: string;
}

export type EnaParseResult = { readonly ok: true; readonly command: ParsedEnaCommand } | { readonly ok: false; readonly error: EnaScpiError };

const patterns: readonly [string, RegExp][] = [
  ['identity', /^\*IDN$/], ['options', /^\*OPT$/], ['clear-status', /^\*CLS$/], ['operation-complete', /^\*OPC$/],
  ['system-error', /^SYST(?:EM)?:ERR(?:OR)?(?::NEXT)?$/],
  ['rf-output', /^OUTP(?:UT)?$/],
  ['power-limit-state', /^SYST(?:EM)?:POW(?:ER)?1?:LIM(?:IT)?:STAT(?:E)?$/],
  ['power-limit', /^SYST(?:EM)?:POW(?:ER)?1?:LIM(?:IT)?$/],
  ['cal-power-limit-state', /^SYST(?:EM)?:POW(?:ER)?1?:LIM(?:IT)?:CAL(?:IBRATION)?:STAT(?:E)?$/],
  ['cal-power-limit', /^SYST(?:EM)?:POW(?:ER)?1?:LIM(?:IT)?:CAL(?:IBRATION)?$/],
  ['source-power', /^SOUR(?:CE)?1?:POW(?:ER)?1?$/],
  ['frequency-start', /^SENS(?:E)?1?:FREQ(?:UENCY)?:STAR(?:T)?$/],
  ['frequency-stop', /^SENS(?:E)?1?:FREQ(?:UENCY)?:STOP$/],
  ['sweep-points', /^SENS(?:E)?1?:SWE(?:EP)?:POIN(?:TS)?$/],
  ['sweep-type', /^SENS(?:E)?1?:SWE(?:EP)?:TYPE$/],
  ['if-bandwidth', /^SENS(?:E)?1?:(?:BWID|BAND(?:WIDTH)?)$/],
  ['averaging-state', /^SENS(?:E)?1?:AVER(?:AGE)?:STAT(?:E)?$/],
  ['averaging-count', /^SENS(?:E)?1?:AVER(?:AGE)?:COUN(?:T)?$/],
  ['correction-state', /^SENS(?:E)?1?:CORR(?:ECTION)?:STAT(?:E)?$/],
  ['measurement', /^CALC(?:ULATE)?1?:PAR(?:AMETER)?:DEF(?:INE)?:EXT(?:ENDED)?$/],
  ['trigger-source', /^TRIG(?:GER)?:SOUR(?:CE)?$/],
  ['bus-trigger', /^\*TRG$/],
  ['abort', /^ABOR(?:T)?$/],
  ['initiate', /^INIT(?:IATE)?1?:IMM(?:EDIATE)?$/],
  ['data-format', /^FORM(?:AT)?:DATA$/],
  ['byte-order', /^FORM(?:AT)?:BORD(?:ER)?$/],
  ['sdata', /^CALC(?:ULATE)?1?:MEAS(?:URE)?1?:DATA:SDAT(?:A)?$/],
  ['fdata', /^CALC(?:ULATE)?1?:MEAS(?:URE)?1?:DATA:FDAT(?:A)?$/],
  ['x-values', /^CALC(?:ULATE)?1?:MEAS(?:URE)?1?:X:VAL(?:UES)?$/],
];

export function parseE5080bScpi(raw: string): EnaParseResult {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes(';')) return { ok: false, error: { code: -102, message: 'Syntax error: one program message per line only' } };
  const space = trimmed.search(/\s/);
  const headerWithQuery = space < 0 ? trimmed : trimmed.slice(0, space);
  const argument = space < 0 ? null : trimmed.slice(space).trim();
  const query = headerWithQuery.endsWith('?');
  const header = normalizeHeader(query ? headerWithQuery.slice(0, -1) : headerWithQuery);
  const match = patterns.find(([, pattern]) => pattern.test(header));
  if (!match) return { ok: false, error: { code: -113, message: 'Undefined header' } };
  const definition = e5080bCommandCatalog.find(({ id }) => id === match[0])!;
  const form = query ? 'query' : 'write';
  if (!definition.forms.includes(form)) return { ok: false, error: { code: -105, message: 'Query or write form not supported' } };
  if (query && argument) return { ok: false, error: { code: -108, message: 'Parameter not allowed' } };
  if (!query && form === 'write' && !argument && !['clear-status', 'initiate', 'abort', 'bus-trigger'].includes(match[0])) {
    return { ok: false, error: { code: -109, message: 'Missing parameter' } };
  }
  return { ok: true, command: { id: match[0], form, argument, raw: trimmed } };
}

const withError = (session: EnaSession, raw: string, error: EnaScpiError): EnaSession => ({
  ...session,
  errorQueue: [...session.errorQueue, error],
  transcript: [...session.transcript, { direction: 'write', message: raw, outcome: 'error', error }],
});

const stateWithSweep = (state: EnaState, patch: Partial<EnaSweepState>): EnaState => {
  const sweep = { ...state.sweep, ...patch };
  return { ...state, sweep, calibration: evaluateCalibrationValidity(state.calibration, sweep) };
};

function boolArgument(argument: string | null): boolean | null {
  if (!argument) return null;
  if (/^(1|ON)$/i.test(argument)) return true;
  if (/^(0|OFF)$/i.test(argument)) return false;
  return null;
}

const dataInvalidatingCommands = new Set([
  'source-power',
  'frequency-start',
  'frequency-stop',
  'sweep-points',
  'sweep-type',
  'if-bandwidth',
  'averaging-state',
  'averaging-count',
  'correction-state',
  'measurement',
  'trigger-source',
]);

function executeWrite(session: EnaSession, command: ParsedEnaCommand): EnaSession {
  let state = session.state;
  const value = command.argument ? parseNumber(command.argument) : null;
  const rangeError = (): EnaSession => withError(session, command.raw, { code: -222, message: 'Data out of range' });
  switch (command.id) {
    case 'clear-status':
      return { ...session, errorQueue: [], transcript: [...session.transcript, { direction: 'write', message: command.raw, outcome: 'accepted' }] };
    case 'rf-output': {
      const enabled = boolArgument(command.argument);
      if (enabled === null) return rangeError();
      if (enabled && (!state.sourcePowerLimitEnabled || state.sweep.sourcePowerDbm > state.sourcePowerLimitDbm)) {
        return withError(session, command.raw, { code: -221, message: 'RF ON blocked: enable and satisfy the explicit source power limit' });
      }
      state = { ...state, rfOutputEnabled: enabled };
      break;
    }
    case 'power-limit':
      if (value === null || value < -120 || value > 100) return rangeError();
      state = { ...state, sourcePowerLimitDbm: value };
      break;
    case 'power-limit-state': {
      const enabled = boolArgument(command.argument); if (enabled === null) return rangeError();
      state = { ...state, sourcePowerLimitEnabled: enabled }; break;
    }
    case 'cal-power-limit':
      if (value === null || value < -120 || value > 100) return rangeError();
      state = { ...state, calibrationPowerLimitDbm: value }; break;
    case 'cal-power-limit-state': {
      const enabled = boolArgument(command.argument); if (enabled === null) return rangeError();
      state = { ...state, calibrationPowerLimitEnabled: enabled }; break;
    }
    case 'source-power':
      if (value === null || value < -120 || value > 20) return rangeError();
      if (state.sourcePowerLimitEnabled && value > state.sourcePowerLimitDbm) return rangeError();
      state = stateWithSweep(state, { sourcePowerDbm: value }); break;
    case 'frequency-start':
      if (value === null || value < 9e3 || value >= state.sweep.stopHz) return rangeError();
      state = stateWithSweep(state, { startHz: value }); break;
    case 'frequency-stop':
      if (value === null || value > 20e9 || value <= state.sweep.startHz) return rangeError();
      state = stateWithSweep(state, { stopHz: value }); break;
    case 'sweep-points':
      if (value === null || !Number.isInteger(value) || value < 2 || value > 100001) return rangeError();
      state = stateWithSweep(state, { points: value }); break;
    case 'sweep-type': {
      const sweepType = command.argument?.toUpperCase();
      if (!sweepType || !['LIN', 'LOG'].includes(sweepType)) return rangeError();
      state = stateWithSweep(state, { sweepType: sweepType as EnaSweepState['sweepType'] }); break;
    }
    case 'if-bandwidth':
      if (value === null || value < 1 || value > 15e6) return rangeError();
      state = stateWithSweep(state, { ifBandwidthHz: value }); break;
    case 'averaging-state': {
      const enabled = boolArgument(command.argument); if (enabled === null) return rangeError();
      state = stateWithSweep(state, { averagingEnabled: enabled }); break;
    }
    case 'averaging-count':
      if (value === null || !Number.isInteger(value) || value < 1 || value > 65536) return rangeError();
      state = stateWithSweep(state, { averagingCount: value }); break;
    case 'correction-state': {
      const enabled = boolArgument(command.argument); if (enabled === null) return rangeError();
      state = { ...state, calibration: enabled
        ? state.calibration
        : { ...state.calibration, status: 'none', reasons: ['Correction was disabled by the operator.'] } };
      break;
    }
    case 'measurement': {
      const match = command.argument?.toUpperCase().match(/(?:^|,)\s*['"]?(S11|S21|S12|S22)['"]?\s*$/);
      if (!match) return rangeError(); state = { ...state, measurement: match[1] as EnaState['measurement'] }; break;
    }
    case 'trigger-source': {
      const trigger = command.argument?.toUpperCase();
      if (!trigger || !['IMM', 'MAN', 'EXT'].includes(trigger)) return rangeError();
      state = { ...state, triggerSource: trigger as EnaState['triggerSource'] }; break;
    }
    case 'data-format': {
      const dataFormat = command.argument?.toUpperCase().replace(/\s/g, '');
      if (dataFormat === 'ASC' || dataFormat === 'ASC,0') state = { ...state, dataFormat: 'ASC' };
      else if (dataFormat === 'REAL,32') state = { ...state, dataFormat: 'REAL32' };
      else return rangeError();
      break;
    }
    case 'byte-order': {
      const byteOrder = command.argument?.toUpperCase();
      if (!byteOrder || !['NORM', 'SWAP'].includes(byteOrder)) return rangeError();
      state = { ...state, byteOrder: byteOrder as EnaState['byteOrder'] }; break;
    }
    case 'abort':
      return {
        ...session,
        pendingOperations: [],
        acquisition: { ...session.acquisition, status: 'idle', armedTrigger: null, dataFresh: false },
        transcript: [...session.transcript, { direction: 'write', message: command.raw, outcome: 'accepted' }],
      };
    case 'bus-trigger':
      if (session.acquisition.status !== 'armed' || session.acquisition.armedTrigger !== 'MAN') {
        return withError(session, command.raw, { code: -221, message: 'Manual bus trigger requires an armed MAN sweep' });
      }
      return {
        ...session,
        pendingOperations: ['sweep'],
        acquisition: { ...session.acquisition, status: 'sweeping', armedTrigger: null, dataFresh: false },
        transcript: [...session.transcript, { direction: 'write', message: command.raw, outcome: 'accepted' }],
      };
    case 'initiate': {
      const armedTrigger = state.triggerSource === 'IMM' ? null : state.triggerSource;
      return {
        ...session,
        pendingOperations: armedTrigger ? [`awaiting-${armedTrigger.toLowerCase()}-trigger`] : ['sweep'],
        acquisition: {
          ...session.acquisition,
          status: armedTrigger ? 'armed' : 'sweeping',
          armedTrigger,
          dataFresh: false,
        },
        transcript: [...session.transcript, { direction: 'write', message: command.raw, outcome: 'accepted' }],
      };
    }
    default:
      return withError(session, command.raw, { code: -113, message: 'Unsupported write in educational model' });
  }
  const invalidatesData = dataInvalidatingCommands.has(command.id);
  return {
    ...session,
    state,
    ...(invalidatesData ? {
      pendingOperations: [],
      acquisition: { ...session.acquisition, status: 'idle' as const, armedTrigger: null, dataFresh: false },
    } : {}),
    transcript: [...session.transcript, { direction: 'write', message: command.raw, outcome: 'accepted' }],
  };
}

function queryResponse(session: EnaSession, command: ParsedEnaCommand): { session: EnaSession; response: string | null } {
  const state = session.state;
  let response: string | null = '';
  let errorQueue = session.errorQueue;
  let pendingOperations = session.pendingOperations;
  let acquisition = session.acquisition;
  switch (command.id) {
    case 'identity': response = 'Keysight Technologies,E5080B,MY00000000,A.20.25.03'; break;
    case 'options': response = '2K0'; break;
    case 'operation-complete':
      if (acquisition.status === 'armed') {
        response = null;
      } else if (acquisition.status === 'sweeping') {
        response = '1';
        pendingOperations = [];
        acquisition = {
          status: 'complete',
          armedTrigger: null,
          dataFresh: true,
          sweepCount: acquisition.sweepCount + 1,
        };
      } else {
        response = '1';
        pendingOperations = [];
      }
      break;
    case 'system-error': {
      const next = errorQueue[0]; response = next ? `${next.code},"${next.message}"` : '+0,"No error"'; errorQueue = errorQueue.slice(1); break;
    }
    case 'rf-output': response = state.rfOutputEnabled ? '1' : '0'; break;
    case 'power-limit': response = state.sourcePowerLimitDbm.toFixed(6); break;
    case 'power-limit-state': response = state.sourcePowerLimitEnabled ? '1' : '0'; break;
    case 'cal-power-limit': response = state.calibrationPowerLimitDbm.toFixed(6); break;
    case 'cal-power-limit-state': response = state.calibrationPowerLimitEnabled ? '1' : '0'; break;
    case 'source-power': response = state.sweep.sourcePowerDbm.toFixed(6); break;
    case 'frequency-start': response = state.sweep.startHz.toFixed(6); break;
    case 'frequency-stop': response = state.sweep.stopHz.toFixed(6); break;
    case 'sweep-points': response = String(state.sweep.points); break;
    case 'sweep-type': response = state.sweep.sweepType; break;
    case 'if-bandwidth': response = state.sweep.ifBandwidthHz.toFixed(6); break;
    case 'averaging-state': response = state.sweep.averagingEnabled ? '1' : '0'; break;
    case 'averaging-count': response = String(state.sweep.averagingCount); break;
    case 'correction-state': response = state.calibration.status === 'none' ? '0' : '1'; break;
    case 'trigger-source': response = state.triggerSource; break;
    case 'data-format': response = state.dataFormat === 'REAL32' ? 'REAL,32' : 'ASC,0'; break;
    case 'byte-order': response = state.byteOrder; break;
    case 'x-values': response = enaFrequencyGrid(state.sweep).join(','); break;
    case 'sdata': {
      if (acquisition.status !== 'complete' || !acquisition.dataFresh) {
        response = null;
        errorQueue = [...errorQueue, { code: -230, message: 'Data corrupt or stale: complete a triggered sweep first' }];
        break;
      }
      response = generateEnaSweep(state.sweep).flatMap((point) => {
        const value = point[state.measurement.toLowerCase() as 's11' | 's21' | 's12' | 's22'];
        return [value.re, value.im];
      }).join(','); break;
    }
    case 'fdata': {
      if (acquisition.status !== 'complete' || !acquisition.dataFresh) {
        response = null;
        errorQueue = [...errorQueue, { code: -230, message: 'Data corrupt or stale: complete a triggered sweep first' }];
        break;
      }
      response = generateEnaSweep(state.sweep).map((point) => enaLogMagnitudeDb(point[state.measurement.toLowerCase() as 's11' | 's21' | 's12' | 's22'])).join(','); break;
    }
    default: response = '';
  }
  return { session: { ...session, errorQueue, pendingOperations, acquisition }, response };
}

export function signalE5080bTriggerEvent(session: EnaSession, source: 'MAN' | 'EXT'): EnaSession {
  if (session.acquisition.status !== 'armed' || session.acquisition.armedTrigger !== source) {
    return withError(session, `EVENT ${source}`, { code: -221, message: `${source} trigger event requires a matching armed sweep` });
  }
  return {
    ...session,
    pendingOperations: ['sweep'],
    acquisition: { ...session.acquisition, status: 'sweeping', armedTrigger: null, dataFresh: false },
    transcript: [...session.transcript, { direction: 'write', message: `EVENT ${source}`, outcome: 'accepted' }],
  };
}

export function writeE5080bScpi(session: EnaSession, raw: string): EnaSession {
  let current = session;
  if (current.outputQueue.length > 0) {
    const interrupted = { code: -410, message: 'Query INTERRUPTED' } as const;
    current = { ...current, outputQueue: [], errorQueue: [...current.errorQueue, interrupted] };
  }
  const parsed = parseE5080bScpi(raw);
  if (!parsed.ok) return withError(current, raw, parsed.error);
  if (parsed.command.form === 'write') return executeWrite(current, parsed.command);
  const result = queryResponse(current, parsed.command);
  return {
    ...result.session,
    outputQueue: result.response === null
      ? result.session.outputQueue
      : [...result.session.outputQueue, result.response],
    transcript: [...result.session.transcript, { direction: 'write', message: raw.trim(), outcome: 'accepted' }],
  };
}

export function readE5080bScpi(session: EnaSession): { readonly session: EnaSession; readonly response: string | null; readonly status: 'response' | 'would-time-out' } {
  const response = session.outputQueue[0];
  if (response === undefined) return {
    response: null,
    status: 'would-time-out',
    session: { ...session, transcript: [...session.transcript, { direction: 'read', message: 'READ', outcome: 'would-time-out' }] },
  };
  return {
    response,
    status: 'response',
    session: { ...session, outputQueue: session.outputQueue.slice(1), transcript: [...session.transcript, { direction: 'read', message: response, outcome: 'response' }] },
  };
}

export function queryE5080bScpi(session: EnaSession, raw: string): { readonly session: EnaSession; readonly response: string | null } {
  return readE5080bScpi(writeE5080bScpi(session, raw));
}

export interface EnaProgramStep {
  readonly id: string;
  readonly phase: 'identify' | 'safe' | 'configure' | 'verify' | 'acquire' | 'cleanup';
  readonly operation: 'write' | 'query';
  readonly message: string;
}

export function createE5080bSafeSweepProgram(sweep: EnaSweepState = defaultEnaSweep): readonly EnaProgramStep[] {
  return [
    { id: 'identify', phase: 'identify', operation: 'query', message: '*IDN?' },
    { id: 'options', phase: 'identify', operation: 'query', message: '*OPT?' },
    { id: 'rf-off-first', phase: 'safe', operation: 'write', message: 'OUTP OFF' },
    { id: 'clear', phase: 'safe', operation: 'write', message: '*CLS' },
    { id: 'power-limit', phase: 'safe', operation: 'write', message: `SYST:POW1:LIM ${sweep.sourcePowerDbm + 3} DBM` },
    { id: 'power-limit-on', phase: 'safe', operation: 'write', message: 'SYST:POW1:LIM:STAT ON' },
    { id: 'start', phase: 'configure', operation: 'write', message: `SENS1:FREQ:STAR ${sweep.startHz} HZ` },
    { id: 'stop', phase: 'configure', operation: 'write', message: `SENS1:FREQ:STOP ${sweep.stopHz} HZ` },
    { id: 'points', phase: 'configure', operation: 'write', message: `SENS1:SWE:POIN ${sweep.points}` },
    { id: 'ifbw', phase: 'configure', operation: 'write', message: `SENS1:BWID ${sweep.ifBandwidthHz} HZ` },
    { id: 'power', phase: 'configure', operation: 'write', message: `SOUR1:POW1 ${sweep.sourcePowerDbm} DBM` },
    { id: 'complete', phase: 'verify', operation: 'query', message: '*OPC?' },
    { id: 'query-power', phase: 'verify', operation: 'query', message: 'SOUR1:POW1?' },
    { id: 'errors', phase: 'verify', operation: 'query', message: 'SYST:ERR?' },
    { id: 'cleanup', phase: 'cleanup', operation: 'write', message: 'OUTP OFF' },
  ];
}
