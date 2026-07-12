import type {
  InstrumentReference,
  InstrumentScpiCommandDefinition,
  InstrumentScpiForm,
  InstrumentScpiSafetyClass,
} from '../../types/instruments';

export const U2061XA_MODEL = 'U2061XA';
export const U2061XA_FIRMWARE_SCOPE = 'A.03.16';
export const U2061XA_FREQUENCY_MIN_HZ = 10_000_000;
export const U2061XA_FREQUENCY_MAX_HZ = 6_000_000_000;
export const U2061XA_AVERAGE_POWER_MIN_DBM = -70;
export const U2061XA_AVERAGE_POWER_MAX_DBM = 26;
export const U2061XA_DAMAGE_AVERAGE_DBM = 26;
export const U2061XA_DAMAGE_PEAK_DBM = 29;
export const U2061XA_DAMAGE_PEAK_MAX_DURATION_SECONDS = 10e-6;
export const U2061XA_DAMAGE_DC_VOLTS = 10;
export const U2061XA_ERROR_QUEUE_CAPACITY = 30;
export const U2061XA_ERROR_DRAIN_MAX_QUERIES = U2061XA_ERROR_QUEUE_CAPACITY + 1;
export const U2061XA_APERTURE_MAX_SECONDS = 200e-3;
export const U2061XA_APERTURE_RESOLUTION_SECONDS = 100e-9;
export const U2061XA_MAX_AVERAGE_READINGS_PER_SECOND = 50_000;

const U2061XA_PROGRAMMING_GUIDE_URL =
  'https://www.keysight.com/us/en/assets/9018-04755/programming-guides/9018-04755.pdf';

function u2061xaCommandSource(section: string): InstrumentReference {
  return Object.freeze({
    title: 'Keysight 2050/60 X-Series Wide Dynamic Range Power Sensors Programming Guide',
    organization: 'Keysight Technologies',
    url: U2061XA_PROGRAMMING_GUIDE_URL,
    documentNumber: '9018-04755',
    revision: `Firmware ${U2061XA_FIRMWARE_SCOPE} review baseline`,
    section,
  });
}

export const u2061xaProgrammingReference = u2061xaCommandSource('SCPI command reference');

type U2061CommandRow = readonly [
  id: string,
  longForm: string,
  shortForm: string,
  forms: readonly InstrumentScpiForm[],
  stateEffect: string,
  safetyClass: InstrumentScpiSafetyClass,
  section: string,
];

const u2061xaCommandRows = [
  ['identity', '*IDN?', '*IDN?', ['query'], 'Reads vendor, model, serial and firmware.', 'identity', 'IEEE 488.2 common commands'],
  ['options', '*OPT?', '*OPT?', ['query'], 'Reads the installed option response.', 'identity', 'IEEE 488.2 common commands'],
  ['operation-complete', '*OPC?', '*OPC?', ['query'], 'Synchronizes prior operations and returns 1.', 'queue', 'IEEE 488.2 common commands'],
  ['clear-status', '*CLS', '*CLS', ['write'], 'Clears status and the error queue.', 'queue', 'IEEE 488.2 common commands'],
  ['reset', '*RST', '*RST', ['write'], 'Restores the educational reset state.', 'configuration', 'IEEE 488.2 common commands'],
  ['system-error', 'SYSTEM:ERROR?', 'SYST:ERR?', ['query'], 'Pops the oldest SCPI error record.', 'queue', 'System error queue'],
  ['detector-function', 'SENSE:DETECTOR:FUNCTION', 'SENS:DET:FUNC', ['write', 'query'], 'Selects Average or Normal detector processing.', 'configuration', 'SENSe:DETector:FUNCtion'],
  ['measurement-frequency', 'SENSE:FREQUENCY', 'SENS:FREQ', ['write', 'query'], 'Selects frequency-response correction metadata.', 'configuration', 'SENSe:FREQuency'],
  ['sweep-aperture', 'SENSE:SWEEP:APERTURE', 'SENS:SWE:APER', ['write', 'query'], 'Sets the Average-mode measurement aperture.', 'measurement', 'SENSe:SWEep:APERture'],
  ['average-count', 'SENSE:AVERAGE:COUNT', 'SENS:AVER:COUN', ['write', 'query'], 'Sets the manual averaging count.', 'measurement', 'SENSe:AVERage:COUNt'],
  ['average-count-auto', 'SENSE:AVERAGE:COUNT:AUTO', 'SENS:AVER:COUN:AUTO', ['write', 'query'], 'Enables or disables automatic averaging count.', 'measurement', 'SENSe:AVERage:COUNt:AUTO'],
  ['video-bandwidth', 'SENSE:BANDWIDTH:VIDEO', 'SENS:BAND:VID', ['write', 'query'], 'Selects Normal-mode video bandwidth.', 'measurement', 'SENSe:BANDwidth:VIDeo'],
  ['trigger-source', 'TRIGGER:SOURCE', 'TRIG:SOUR', ['write', 'query'], 'Selects immediate, internal, external, bus or hold trigger.', 'acquisition', 'TRIGger:SOURce'],
  ['trigger-level', 'TRIGGER:LEVEL', 'TRIG:LEV', ['write', 'query'], 'Sets the internal trigger threshold.', 'acquisition', 'TRIGger:LEVel'],
  ['trigger-slope', 'TRIGGER:SLOPE', 'TRIG:SLOP', ['write'], 'Selects positive or negative trigger slope.', 'acquisition', 'TRIGger:SLOPe'],
  ['trigger-delay', 'TRIGGER:DELAY', 'TRIG:DEL', ['write'], 'Sets delay relative to the trigger event.', 'acquisition', 'TRIGger:DELay'],
  ['trigger-holdoff', 'TRIGGER:HOLDOFF', 'TRIG:HOLD', ['write'], 'Sets trigger holdoff.', 'acquisition', 'TRIGger:HOLDoff'],
  ['zero-type', 'CALIBRATION:ZERO:TYPE', 'CAL:ZERO:TYPE', ['write'], 'Selects internal or external zero.', 'calibration', 'CALibration:ZERO:TYPE'],
  ['zero-auto', 'CALIBRATION:ZERO:AUTO', 'CAL:ZERO:AUTO', ['write'], 'Controls zero execution.', 'calibration', 'CALibration:ZERO:AUTO'],
  ['calibration-auto', 'CALIBRATION:AUTO', 'CAL:AUTO', ['write'], 'Controls calibration execution.', 'calibration', 'CALibration:AUTO'],
  ['calibration-all', 'CALIBRATION:ALL?', 'CAL:ALL?', ['query'], 'Runs the combined zero/calibration query.', 'calibration', 'CALibration:ALL?'],
  ['continuous-initiate', 'INITIATE:CONTINUOUS', 'INIT:CONT', ['write', 'query'], 'Controls continuous acquisition.', 'acquisition', 'INITiate:CONTinuous'],
  ['initiate-immediate', 'INITIATE:IMMEDIATE', 'INIT:IMM', ['write'], 'Arms or starts a new acquisition.', 'acquisition', 'INITiate[:IMMediate]'],
  ['bus-trigger', '*TRG', '*TRG', ['write'], 'Supplies the bus trigger event to an armed acquisition.', 'acquisition', 'IEEE 488.2 common commands'],
  ['trigger-immediate', 'TRIGGER:IMMEDIATE', 'TRIG:IMM', ['write'], 'Supplies an immediate trigger event.', 'acquisition', 'TRIGger:IMMediate'],
  ['read', 'READ?', 'READ?', ['query'], 'Configures, initiates and returns one measurement.', 'measurement', 'READ?'],
  ['fetch', 'FETCH?', 'FETC?', ['query'], 'Returns a completed acquisition without re-arming.', 'measurement', 'FETCh?'],
  ['abort', 'ABORT', 'ABOR', ['write'], 'Aborts an armed acquisition.', 'safety', 'ABORt'],
] as const satisfies readonly U2061CommandRow[];

export const u2061xaCommandCatalog: readonly InstrumentScpiCommandDefinition[] = Object.freeze(
  u2061xaCommandRows.map(([
    id,
    longForm,
    shortForm,
    forms,
    stateEffect,
    safetyClass,
    section,
  ]) => Object.freeze({
    id,
    longForm,
    shortForm,
    forms,
    stateEffect,
    safetyClass,
    supportedModels: [U2061XA_MODEL] as const,
    firmwareScope: U2061XA_FIRMWARE_SCOPE,
    optionScope: 'U2061XA base hardware',
    source: u2061xaCommandSource(section),
  })),
);

export const u2061xaCommandById = Object.freeze(Object.fromEntries(
  u2061xaCommandCatalog.map((command) => [command.id, command]),
) as Readonly<Record<string, InstrumentScpiCommandDefinition>>);

export type U2061DetectorMode = 'AVER' | 'NORM';
export type U2061VideoBandwidth = 'LOW' | 'MED' | 'HIGH' | 'OFF';
export type U2061TriggerSource = 'IMM' | 'INT' | 'EXT' | 'BUS' | 'HOLD';
export type U2061TriggerSlope = 'POS' | 'NEG';
export type U2061ZeroType = 'INT' | 'EXT';

export interface RectangularBurstInput {
  readonly onPowerDbm: number;
  readonly dutyCyclePercent: number;
}

export interface RectangularBurstMetrics {
  readonly onPowerDbm: number;
  readonly averagePowerDbm: number;
  readonly peakToAverageDb: number;
  readonly dutyCyclePercent: number;
}

export interface U2061InputSafetyInput {
  readonly sensorAveragePowerDbm: number;
  readonly sensorPeakPowerDbm: number;
  readonly peakDurationSeconds: number;
  readonly dcVoltage: number;
  readonly guardMarginDb: number;
}

export interface U2061InputSafetyDecision {
  readonly allowed: boolean;
  readonly averageDamageLevelDbm: number;
  readonly conditionalPeakDamageLevelDbm: number;
  readonly guardedAverageLimitDbm: number;
  readonly guardedPeakLimitDbm: number;
  readonly peakDamageRule: '<10us' | 'average-limit';
  readonly averageHeadroomDb: number;
  readonly peakHeadroomDb: number;
  readonly reasons: readonly string[];
}

export interface U2061UncertaintyInput {
  readonly sensorSwr: number;
  readonly dutSwr: number;
  /** All non-mismatch contributors expressed as a relative standard uncertainty. */
  readonly systemStandardPercent: number;
  readonly coverageFactor?: number;
}

export interface U2061UncertaintyResult {
  readonly sensorGammaMagnitude: number;
  readonly dutGammaMagnitude: number;
  readonly mismatchStandardPercent: number;
  readonly combinedStandardPercent: number;
  readonly expandedPercent: number;
  readonly coverageFactor: number;
}

export interface PaPowerMeasurementInput {
  readonly inputSensorDbm: number;
  readonly inputPathCorrectionDb: number;
  readonly outputSensorDbm: number;
  readonly outputPathCorrectionDb: number;
  readonly supplyVoltageV: number;
  readonly supplyCurrentA: number;
}

export interface PaPowerMeasurementResult {
  /** Directional forward-wave estimate; not accepted/delivered power without reverse-wave data. */
  readonly powerConvention: 'forward-wave';
  readonly inputDutPlaneDbm: number;
  readonly outputDutPlaneDbm: number;
  readonly gainDb: number;
  readonly inputPowerW: number;
  readonly outputPowerW: number;
  readonly dcPowerW: number;
  readonly drainEfficiencyPercent: number;
  readonly paePercent: number;
}

export interface U2061State {
  readonly detectorMode: U2061DetectorMode;
  readonly frequencyHz: number;
  readonly apertureSeconds: number;
  readonly averagingEnabled: boolean;
  readonly averageCountAuto: boolean;
  readonly averageCount: number;
  readonly videoBandwidth: U2061VideoBandwidth;
  readonly triggerSource: U2061TriggerSource;
  readonly triggerLevelDbm: number;
  readonly triggerSlope: U2061TriggerSlope;
  readonly triggerDelaySeconds: number;
  readonly triggerHoldoffSeconds: number;
  readonly channelCorrectionDb: number;
  readonly zeroType: U2061ZeroType;
  readonly zeroed: boolean;
  readonly calibrated: boolean;
  readonly continuousEnabled: boolean;
  readonly armed: boolean;
  readonly rawInputPowerDbm: number;
  readonly lastMeasurementDbm: number | null;
}

export interface U2061ScpiError {
  readonly code: number;
  readonly message: string;
}

export interface U2061TranscriptEntry {
  readonly index: number;
  readonly direction: 'write' | 'read';
  readonly message: string;
  readonly outcome: 'ok' | 'error';
  readonly error?: U2061ScpiError;
}

export interface U2061Session {
  readonly state: U2061State;
  readonly outputQueue: readonly string[];
  readonly errorQueue: readonly U2061ScpiError[];
  readonly transcript: readonly U2061TranscriptEntry[];
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

function assertRange(value: number, min: number, max: number, label: string): void {
  assertFinite(value, label);
  if (value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

export function dbmToWatts(powerDbm: number): number {
  assertFinite(powerDbm, 'powerDbm');
  return 10 ** ((powerDbm - 30) / 10);
}

export function wattsToDbm(powerW: number): number {
  assertFinite(powerW, 'powerW');
  if (powerW <= 0) throw new RangeError('powerW must be greater than zero.');
  return 10 * Math.log10(powerW) + 30;
}

export function calculateRectangularBurstPower({
  onPowerDbm,
  dutyCyclePercent,
}: RectangularBurstInput): RectangularBurstMetrics {
  assertFinite(onPowerDbm, 'onPowerDbm');
  assertRange(dutyCyclePercent, Number.MIN_VALUE, 100, 'dutyCyclePercent');
  const dutyRatio = dutyCyclePercent / 100;
  const peakToAverageDb = -10 * Math.log10(dutyRatio);
  return {
    onPowerDbm,
    averagePowerDbm: onPowerDbm - peakToAverageDb,
    peakToAverageDb,
    dutyCyclePercent,
  };
}

export function getU2061ApertureMinimumSeconds(frequencyHz: number): number {
  assertRange(frequencyHz, U2061XA_FREQUENCY_MIN_HZ, U2061XA_FREQUENCY_MAX_HZ, 'frequencyHz');
  return frequencyHz >= 300_000_000 ? 20e-6 : 50e-6;
}

export function validateU2061Aperture(frequencyHz: number, apertureSeconds: number): void {
  const minimum = getU2061ApertureMinimumSeconds(frequencyHz);
  assertFinite(apertureSeconds, 'apertureSeconds');
  const tolerance = U2061XA_APERTURE_RESOLUTION_SECONDS / 2;
  if (apertureSeconds < minimum - tolerance
    || apertureSeconds > U2061XA_APERTURE_MAX_SECONDS + tolerance) {
    throw new RangeError(
      `apertureSeconds must be between ${minimum} and ${U2061XA_APERTURE_MAX_SECONDS}.`,
    );
  }
}

export function calculateU2061AverageReadingRate(
  frequencyHz: number,
  apertureSeconds: number,
): number {
  validateU2061Aperture(frequencyHz, apertureSeconds);
  return Math.min(U2061XA_MAX_AVERAGE_READINGS_PER_SECOND, 1 / apertureSeconds);
}

export function evaluateU2061InputSafety({
  sensorAveragePowerDbm,
  sensorPeakPowerDbm,
  peakDurationSeconds,
  dcVoltage,
  guardMarginDb,
}: U2061InputSafetyInput): U2061InputSafetyDecision {
  assertFinite(sensorAveragePowerDbm, 'sensorAveragePowerDbm');
  assertFinite(sensorPeakPowerDbm, 'sensorPeakPowerDbm');
  assertFinite(peakDurationSeconds, 'peakDurationSeconds');
  assertFinite(dcVoltage, 'dcVoltage');
  assertFinite(guardMarginDb, 'guardMarginDb');
  if (peakDurationSeconds <= 0) throw new RangeError('peakDurationSeconds must be greater than zero.');
  if (dcVoltage < 0) throw new RangeError('dcVoltage must be zero or greater.');
  if (guardMarginDb < 0) throw new RangeError('guardMarginDb must be zero or greater.');

  const usesShortPulseRule = peakDurationSeconds < U2061XA_DAMAGE_PEAK_MAX_DURATION_SECONDS;
  const peakDamageLevel = usesShortPulseRule
    ? U2061XA_DAMAGE_PEAK_DBM
    : U2061XA_DAMAGE_AVERAGE_DBM;
  const guardedAverageLimitDbm = U2061XA_DAMAGE_AVERAGE_DBM - guardMarginDb;
  const guardedPeakLimitDbm = peakDamageLevel - guardMarginDb;
  const averageHeadroomDb = guardedAverageLimitDbm - sensorAveragePowerDbm;
  const peakHeadroomDb = guardedPeakLimitDbm - sensorPeakPowerDbm;
  const reasons: string[] = [];

  if (averageHeadroomDb <= 0) {
    reasons.push(`Average input reaches or exceeds the guarded ${guardedAverageLimitDbm.toFixed(1)} dBm limit.`);
  }
  if (peakHeadroomDb <= 0) {
    reasons.push(`Peak input reaches or exceeds the guarded ${guardedPeakLimitDbm.toFixed(1)} dBm limit.`);
  }
  if (dcVoltage >= U2061XA_DAMAGE_DC_VOLTS) {
    reasons.push(`DC input reaches or exceeds the ${U2061XA_DAMAGE_DC_VOLTS.toFixed(0)} V damage level.`);
  }

  return {
    allowed: reasons.length === 0,
    averageDamageLevelDbm: U2061XA_DAMAGE_AVERAGE_DBM,
    conditionalPeakDamageLevelDbm: peakDamageLevel,
    guardedAverageLimitDbm,
    guardedPeakLimitDbm,
    peakDamageRule: usesShortPulseRule ? '<10us' : 'average-limit',
    averageHeadroomDb,
    peakHeadroomDb,
    reasons,
  };
}

export function swrToGammaMagnitude(swr: number): number {
  assertFinite(swr, 'swr');
  if (swr < 1) throw new RangeError('swr must be 1 or greater.');
  return (swr - 1) / (swr + 1);
}

export function calculateU2061Uncertainty({
  sensorSwr,
  dutSwr,
  systemStandardPercent,
  coverageFactor = 2,
}: U2061UncertaintyInput): U2061UncertaintyResult {
  assertFinite(systemStandardPercent, 'systemStandardPercent');
  assertFinite(coverageFactor, 'coverageFactor');
  if (systemStandardPercent < 0) throw new RangeError('systemStandardPercent must be zero or greater.');
  if (coverageFactor <= 0) throw new RangeError('coverageFactor must be greater than zero.');
  const sensorGammaMagnitude = swrToGammaMagnitude(sensorSwr);
  const dutGammaMagnitude = swrToGammaMagnitude(dutSwr);
  const mismatchStandardPercent = sensorGammaMagnitude * dutGammaMagnitude / Math.sqrt(2) * 100;
  const combinedStandardPercent = Math.hypot(systemStandardPercent, mismatchStandardPercent);
  return {
    sensorGammaMagnitude,
    dutGammaMagnitude,
    mismatchStandardPercent,
    combinedStandardPercent,
    expandedPercent: combinedStandardPercent * coverageFactor,
    coverageFactor,
  };
}

export function calculateDutPlanePowerDbm(
  sensorReadingDbm: number,
  signedPathCorrectionDb: number,
): number {
  assertFinite(sensorReadingDbm, 'sensorReadingDbm');
  assertFinite(signedPathCorrectionDb, 'signedPathCorrectionDb');
  return sensorReadingDbm + signedPathCorrectionDb;
}

export function calculatePaPowerMeasurement({
  inputSensorDbm,
  inputPathCorrectionDb,
  outputSensorDbm,
  outputPathCorrectionDb,
  supplyVoltageV,
  supplyCurrentA,
}: PaPowerMeasurementInput): PaPowerMeasurementResult {
  [inputSensorDbm, inputPathCorrectionDb, outputSensorDbm, outputPathCorrectionDb,
    supplyVoltageV, supplyCurrentA].forEach((value, index) => assertFinite(value, `input[${index}]`));
  if (supplyVoltageV <= 0 || supplyCurrentA <= 0) {
    throw new RangeError('Supply voltage and current must be greater than zero.');
  }
  const inputDutPlaneDbm = calculateDutPlanePowerDbm(inputSensorDbm, inputPathCorrectionDb);
  const outputDutPlaneDbm = calculateDutPlanePowerDbm(outputSensorDbm, outputPathCorrectionDb);
  const inputPowerW = dbmToWatts(inputDutPlaneDbm);
  const outputPowerW = dbmToWatts(outputDutPlaneDbm);
  const dcPowerW = supplyVoltageV * supplyCurrentA;
  return {
    powerConvention: 'forward-wave',
    inputDutPlaneDbm,
    outputDutPlaneDbm,
    gainDb: outputDutPlaneDbm - inputDutPlaneDbm,
    inputPowerW,
    outputPowerW,
    dcPowerW,
    drainEfficiencyPercent: outputPowerW / dcPowerW * 100,
    paePercent: (outputPowerW - inputPowerW) / dcPowerW * 100,
  };
}

export function createU2061ResetState(): U2061State {
  return {
    detectorMode: 'AVER',
    frequencyHz: 3_500_000_000,
    apertureSeconds: 1e-3,
    averagingEnabled: true,
    averageCountAuto: true,
    averageCount: 16,
    videoBandwidth: 'OFF',
    triggerSource: 'IMM',
    triggerLevelDbm: -20,
    triggerSlope: 'POS',
    triggerDelaySeconds: 0,
    triggerHoldoffSeconds: 1e-6,
    channelCorrectionDb: 0,
    zeroType: 'INT',
    zeroed: true,
    calibrated: true,
    continuousEnabled: true,
    armed: false,
    rawInputPowerDbm: -20,
    lastMeasurementDbm: null,
  };
}

export function createU2061Session(): U2061Session {
  return {
    state: createU2061ResetState(),
    outputQueue: [],
    errorQueue: [],
    transcript: [],
  };
}

function appendTranscript(
  session: U2061Session,
  direction: U2061TranscriptEntry['direction'],
  message: string,
  error?: U2061ScpiError,
): U2061Session {
  const entry: U2061TranscriptEntry = {
    index: session.transcript.length + 1,
    direction,
    message,
    outcome: error ? 'error' : 'ok',
    ...(error ? { error } : {}),
  };
  return { ...session, transcript: [...session.transcript, entry] };
}

function pushError(session: U2061Session, error: U2061ScpiError): U2061Session {
  const errors = [...session.errorQueue];
  if (errors.length >= U2061XA_ERROR_QUEUE_CAPACITY) {
    errors[errors.length - 1] = { code: -350, message: 'Queue overflow' };
  } else {
    errors.push(error);
  }
  return { ...session, errorQueue: errors };
}

function commandError(session: U2061Session, command: string, code: number, message: string): U2061Session {
  const error = { code, message };
  return appendTranscript(pushError(session, error), 'write', command, error);
}

function formatScpiNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toPrecision(12).replace(/0+$/, '').replace(/\.$/, '');
}

function parseScpiNumber(token: string): number | null {
  const match = token.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?)\s*(GHZ|MHZ|KHZ|HZ|MS|US|NS|S|DBM|DB|V)?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2]?.toUpperCase();
  const scale = unit === 'GHZ' ? 1e9
    : unit === 'MHZ' ? 1e6
      : unit === 'KHZ' ? 1e3
        : unit === 'MS' ? 1e-3
          : unit === 'US' ? 1e-6
            : unit === 'NS' ? 1e-9
              : 1;
  return Number.isFinite(value) ? value * scale : null;
}

function splitCommand(command: string): { header: string; parameter: string } {
  const trimmed = command.trim();
  const space = trimmed.search(/\s/);
  return space < 0
    ? { header: trimmed.toUpperCase(), parameter: '' }
    : { header: trimmed.slice(0, space).toUpperCase(), parameter: trimmed.slice(space).trim() };
}

function queryResponse(session: U2061Session, header: string): { session: U2061Session; response?: string } {
  const state = session.state;
  if (header === '*IDN?') return { session, response: `Keysight Technologies,${U2061XA_MODEL},RF-WIKI-DEMO,${U2061XA_FIRMWARE_SCOPE}` };
  if (header === '*OPT?') return { session, response: '""' };
  if (header === '*OPC?') return { session, response: '1' };
  if (header === 'SYST:ERR?' || header === 'SYSTEM:ERROR?') {
    const error = session.errorQueue[0];
    return error
      ? { session: { ...session, errorQueue: session.errorQueue.slice(1) }, response: `${error.code},"${error.message}"` }
      : { session, response: '+0,"No error"' };
  }
  if (header === 'SENS:DET:FUNC?' || header === 'SENSE:DETECTOR:FUNCTION?') return { session, response: state.detectorMode };
  if (header === 'SENS:FREQ?' || header === 'SENSE:FREQUENCY?') return { session, response: formatScpiNumber(state.frequencyHz) };
  if (header === 'SENS:SWE:APER?' || header === 'SENSE:SWEEP:APERTURE?') return { session, response: formatScpiNumber(state.apertureSeconds) };
  if (header === 'SENS:AVER:COUN?' || header === 'SENSE:AVERAGE:COUNT?') return { session, response: String(state.averageCount) };
  if (header === 'SENS:AVER:COUN:AUTO?' || header === 'SENSE:AVERAGE:COUNT:AUTO?') return { session, response: state.averageCountAuto ? '1' : '0' };
  if (header === 'SENS:BAND:VID?' || header === 'SENSE:BANDWIDTH:VIDEO?') return { session, response: state.videoBandwidth };
  if (header === 'TRIG:SOUR?' || header === 'TRIGGER:SOURCE?') return { session, response: state.triggerSource };
  if (header === 'TRIG:LEV?' || header === 'TRIGGER:LEVEL?') return { session, response: formatScpiNumber(state.triggerLevelDbm) };
  if (header === 'INIT:CONT?' || header === 'INITIATE:CONTINUOUS?') return { session, response: state.continuousEnabled ? '1' : '0' };
  if (header === 'READ?' || header === 'READ1?') {
    if (state.triggerSource === 'BUS' || state.triggerSource === 'HOLD') {
      const next = pushError(session, { code: -214, message: 'Trigger deadlock' });
      return { session: next, response: '9.91E37' };
    }
    const measured = state.rawInputPowerDbm + state.channelCorrectionDb;
    return { session: { ...session, state: { ...state, lastMeasurementDbm: measured, armed: false } }, response: formatScpiNumber(measured) };
  }
  if (header === 'FETC?' || header === 'FETCH?') {
    if (state.armed) {
      const next = pushError(session, { code: -230, message: 'Acquisition not complete' });
      return { session: next, response: '9.91E37' };
    }
    if (state.lastMeasurementDbm === null) {
      const next = pushError(session, { code: -230, message: 'No completed acquisition' });
      return { session: next, response: '9.91E37' };
    }
    return { session, response: formatScpiNumber(state.lastMeasurementDbm) };
  }
  if (header === 'CAL:ALL?' || header === 'CALIBRATION:ALL?') {
    return {
      session: { ...session, state: { ...state, zeroed: true, calibrated: true } },
      response: '0',
    };
  }
  return { session };
}

export function writeU2061Scpi(current: U2061Session, programMessage: string): U2061Session {
  const command = programMessage.trim();
  if (!command) return commandError(current, programMessage, -102, 'Syntax error');
  if (command.includes(';')) return commandError(current, command, -102, 'One program message per line');

  let session = current;
  if (session.outputQueue.length > 0) {
    session = pushError({ ...session, outputQueue: [] }, { code: -410, message: 'Query INTERRUPTED' });
  }
  const { header, parameter } = splitCommand(command);

  if (header.endsWith('?')) {
    const result = queryResponse(session, header);
    if (result.response === undefined) return commandError(result.session, command, -113, 'Undefined header');
    return appendTranscript(
      { ...result.session, outputQueue: [...result.session.outputQueue, result.response] },
      'write',
      command,
    );
  }

  if (header === '*CLS') {
    return appendTranscript({ ...session, errorQueue: [] }, 'write', command);
  }
  if (header === '*RST') {
    return appendTranscript({ ...session, state: createU2061ResetState() }, 'write', command);
  }

  const state = session.state;
  if (header === 'SENS:DET:FUNC' || header === 'SENSE:DETECTOR:FUNCTION') {
    const value = parameter.toUpperCase();
    if (value !== 'AVER' && value !== 'AVERAGE' && value !== 'NORM' && value !== 'NORMAL') {
      return commandError(session, command, -224, 'Illegal parameter value');
    }
    return appendTranscript({ ...session, state: { ...state, detectorMode: value.startsWith('AVER') ? 'AVER' : 'NORM' } }, 'write', command);
  }
  if (header === 'SENS:FREQ' || header === 'SENSE:FREQUENCY') {
    const value = parseScpiNumber(parameter);
    if (value === null || value < U2061XA_FREQUENCY_MIN_HZ || value > U2061XA_FREQUENCY_MAX_HZ) {
      return commandError(session, command, -222, 'Data out of range');
    }
    let apertureSeconds = state.apertureSeconds;
    const apertureMinimum = getU2061ApertureMinimumSeconds(value);
    if (apertureSeconds < apertureMinimum) apertureSeconds = apertureMinimum;
    return appendTranscript({ ...session, state: { ...state, frequencyHz: value, apertureSeconds } }, 'write', command);
  }
  if (header === 'SENS:SWE:APER' || header === 'SENSE:SWEEP:APERTURE') {
    if (state.detectorMode !== 'AVER') return commandError(session, command, -221, 'Settings conflict');
    const value = parseScpiNumber(parameter);
    if (value === null) return commandError(session, command, -222, 'Data out of range');
    try {
      validateU2061Aperture(state.frequencyHz, value);
    } catch {
      return commandError(session, command, -222, 'Data out of range');
    }
    return appendTranscript({ ...session, state: { ...state, apertureSeconds: value } }, 'write', command);
  }
  if (header === 'SENS:AVER:COUN:AUTO' || header === 'SENSE:AVERAGE:COUNT:AUTO') {
    const value = parameter.toUpperCase();
    if (!['ON', 'OFF', '1', '0'].includes(value)) return commandError(session, command, -224, 'Illegal parameter value');
    const enabled = value === 'ON' || value === '1';
    return appendTranscript({ ...session, state: { ...state, averageCountAuto: enabled, averagingEnabled: enabled || state.averagingEnabled } }, 'write', command);
  }
  if (header === 'SENS:AVER:COUN' || header === 'SENSE:AVERAGE:COUNT') {
    const value = parseScpiNumber(parameter);
    if (value === null || !Number.isInteger(value) || value < 1 || value > 1024) {
      return commandError(session, command, -222, 'Data out of range');
    }
    return appendTranscript({ ...session, state: { ...state, averageCount: value, averageCountAuto: false, averagingEnabled: true } }, 'write', command);
  }
  if (header === 'SENS:BAND:VID' || header === 'SENSE:BANDWIDTH:VIDEO') {
    if (state.detectorMode !== 'NORM') return commandError(session, command, -221, 'Settings conflict');
    const value = parameter.toUpperCase() as U2061VideoBandwidth;
    if (!['LOW', 'MED', 'HIGH', 'OFF'].includes(value)) return commandError(session, command, -224, 'Illegal parameter value');
    return appendTranscript({ ...session, state: { ...state, videoBandwidth: value } }, 'write', command);
  }
  if (header === 'TRIG:SOUR' || header === 'TRIGGER:SOURCE') {
    const aliases: Record<string, U2061TriggerSource> = {
      IMM: 'IMM', IMMEDIATE: 'IMM', INT: 'INT', INTERNAL: 'INT', EXT: 'EXT', EXTERNAL: 'EXT', BUS: 'BUS', HOLD: 'HOLD',
    };
    const value = aliases[parameter.toUpperCase()];
    if (!value) return commandError(session, command, -224, 'Illegal parameter value');
    return appendTranscript({ ...session, state: { ...state, triggerSource: value } }, 'write', command);
  }
  if (header === 'TRIG:LEV' || header === 'TRIGGER:LEVEL') {
    const value = parseScpiNumber(parameter);
    if (value === null || value < -48 || value > 20) return commandError(session, command, -222, 'Data out of range');
    if (state.triggerSource !== 'INT') return commandError(session, command, -221, 'Settings conflict');
    return appendTranscript({ ...session, state: { ...state, triggerLevelDbm: value } }, 'write', command);
  }
  if (header === 'TRIG:SLOP' || header === 'TRIGGER:SLOPE') {
    const value = parameter.toUpperCase();
    if (!['POS', 'POSITIVE', 'NEG', 'NEGATIVE'].includes(value)) return commandError(session, command, -224, 'Illegal parameter value');
    if (state.triggerSource !== 'INT' && state.triggerSource !== 'EXT') return commandError(session, command, -221, 'Settings conflict');
    return appendTranscript({ ...session, state: { ...state, triggerSlope: value.startsWith('POS') ? 'POS' : 'NEG' } }, 'write', command);
  }
  if (header === 'TRIG:DEL' || header === 'TRIGGER:DELAY') {
    const value = parseScpiNumber(parameter);
    const minimum = state.detectorMode === 'AVER' ? -1.6e-3 : -1;
    if (value === null || value < minimum || value > 1) return commandError(session, command, -222, 'Data out of range');
    return appendTranscript({ ...session, state: { ...state, triggerDelaySeconds: value } }, 'write', command);
  }
  if (header === 'TRIG:HOLD' || header === 'TRIGGER:HOLDOFF') {
    const value = parseScpiNumber(parameter);
    if (value === null || value < 1e-6 || value > 0.4) return commandError(session, command, -222, 'Data out of range');
    if (state.triggerSource !== 'INT' && state.triggerSource !== 'EXT') return commandError(session, command, -221, 'Settings conflict');
    return appendTranscript({ ...session, state: { ...state, triggerHoldoffSeconds: value } }, 'write', command);
  }
  if (header === 'CAL:ZERO:TYPE' || header === 'CALIBRATION:ZERO:TYPE') {
    const value = parameter.toUpperCase();
    if (!['INT', 'INTERNAL', 'EXT', 'EXTERNAL'].includes(value)) return commandError(session, command, -224, 'Illegal parameter value');
    return appendTranscript({ ...session, state: { ...state, zeroType: value.startsWith('INT') ? 'INT' : 'EXT', zeroed: false } }, 'write', command);
  }
  if (header === 'CAL:ZERO:AUTO' || header === 'CALIBRATION:ZERO:AUTO') {
    if (!['ONCE', 'ON', '1', 'OFF', '0'].includes(parameter.toUpperCase())) return commandError(session, command, -224, 'Illegal parameter value');
    return appendTranscript({ ...session, state: { ...state, zeroed: parameter.toUpperCase() !== 'OFF' && parameter !== '0' } }, 'write', command);
  }
  if (header === 'CAL:AUTO' || header === 'CALIBRATION:AUTO') {
    if (!['ONCE', 'ON', '1', 'OFF', '0'].includes(parameter.toUpperCase())) return commandError(session, command, -224, 'Illegal parameter value');
    return appendTranscript({ ...session, state: { ...state, calibrated: parameter.toUpperCase() !== 'OFF' && parameter !== '0' } }, 'write', command);
  }
  if (header === 'INIT:CONT' || header === 'INITIATE:CONTINUOUS') {
    const enabled = parameter.toUpperCase() === 'ON' || parameter === '1';
    if (!['ON', 'OFF', '1', '0'].includes(parameter.toUpperCase())) return commandError(session, command, -224, 'Illegal parameter value');
    return appendTranscript({ ...session, state: { ...state, continuousEnabled: enabled } }, 'write', command);
  }
  if (header === 'INIT' || header === 'INIT:IMM' || header === 'INITIATE:IMMEDIATE') {
    const immediate = state.triggerSource === 'IMM';
    const measured = state.rawInputPowerDbm + state.channelCorrectionDb;
    return appendTranscript({
      ...session,
      // Every INIT starts a new acquisition and invalidates the previous result.
      // IMM completes deterministically in this educational model; all other
      // sources remain armed until their matching event arrives.
      state: { ...state, armed: !immediate, lastMeasurementDbm: immediate ? measured : null },
    }, 'write', command);
  }
  if (header === '*TRG') {
    if (!state.armed) return commandError(session, command, -211, 'Trigger ignored');
    if (state.triggerSource !== 'BUS') return commandError(session, command, -221, 'Settings conflict');
    const measured = state.rawInputPowerDbm + state.channelCorrectionDb;
    return appendTranscript({ ...session, state: { ...state, armed: false, lastMeasurementDbm: measured } }, 'write', command);
  }
  if (header === 'TRIG:IMM' || header === 'TRIGGER:IMMEDIATE') {
    if (!state.armed) return commandError(session, command, -211, 'Trigger ignored');
    const measured = state.rawInputPowerDbm + state.channelCorrectionDb;
    return appendTranscript({ ...session, state: { ...state, armed: false, lastMeasurementDbm: measured } }, 'write', command);
  }
  if (header === 'ABOR' || header === 'ABORT') {
    return appendTranscript({ ...session, state: { ...state, armed: false } }, 'write', command);
  }

  return commandError(session, command, -113, 'Undefined header');
}

export function readU2061Scpi(current: U2061Session): { session: U2061Session; response: string | null } {
  const response = current.outputQueue[0] ?? null;
  if (response === null) {
    const error = { code: -420, message: 'Query UNTERMINATED' };
    const session = appendTranscript(pushError(current, error), 'read', 'READ', error);
    return { session, response: null };
  }
  return {
    session: appendTranscript({ ...current, outputQueue: current.outputQueue.slice(1) }, 'read', response),
    response,
  };
}

export function queryU2061Scpi(current: U2061Session, command: string): { session: U2061Session; response: string | null } {
  return readU2061Scpi(writeU2061Scpi(current, command));
}
