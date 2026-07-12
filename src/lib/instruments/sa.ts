import type {
  InstrumentReference,
  InstrumentScpiCommandDefinition,
  InstrumentScpiForm,
  InstrumentScpiSafetyClass,
} from '../../types/instruments';

export const N9020B_MODEL = 'N9020B';
export const N9020B_FIRMWARE_SCOPE = 'A.43.49';
export const N9020B_FREQUENCY_MIN_HZ = 10;
export const N9020B_FREQUENCY_MAX_HZ = 26_500_000_000;
export const N9020B_ANALYSIS_BANDWIDTH_MAX_HZ = 160_000_000;
export const N9020B_DAMAGE_AVERAGE_DBM = 30;
export const N9020B_DAMAGE_PULSE_DBM = 50;
export const N9020B_DAMAGE_PULSE_MAX_SECONDS = 10e-6;
export const N9020B_DAMAGE_PULSE_MAX_DUTY_PERCENT = 1;
export const N9020B_DAMAGE_DC_COUPLED_VOLTS = 0.2;
export const N9020B_DAMAGE_AC_COUPLED_VOLTS = 100;
export const N9020B_CONSERVATIVE_MIXER_LEVEL_DBM = -12;
/** Educational default Band-0/low-IF-gain reference, not a universal overload threshold. */
export const N9020B_WIDEBAND_ADC_FULL_SCALE_DBM = -8;
export const N9020B_PREAMP_LOW_BAND_MAX_GAIN_DB = 20;
export const N9020B_PREAMP_HIGH_BAND_MAX_GAIN_DB = 35;

const PRODUCT_URL = 'https://www.keysight.com/zz/en/product/N9020B/n9020b-mxa-signal-analyzer-multi-touch-10-hz-50-ghz.html';
const SPECIFICATION_URL = 'https://www.keysight.com/zz/en/assets/9018-04846/technical-specifications/9018-04846.pdf';
const PROGRAMMING_HELP_URL = 'https://www.keysight.com/us/en/assets/9018-04666/user-manuals/9018-04666.pdf';

function commandSource(section: string): InstrumentReference {
  return Object.freeze({
    title: "Keysight X-Series Signal Analyzer Spectrum Analyzer Mode User's & Programmer's Reference",
    organization: 'Keysight Technologies',
    url: PROGRAMMING_HELP_URL,
    documentNumber: 'N9060-90041',
    assetId: '9018-04666',
    revision: `Edition 19 (2025-12), N9020B firmware ${N9020B_FIRMWARE_SCOPE} review baseline`,
    section,
  });
}

type CommandRow = readonly [
  id: string,
  longForm: string,
  shortForm: string,
  forms: readonly InstrumentScpiForm[],
  stateEffect: string,
  safetyClass: InstrumentScpiSafetyClass,
  section: string,
  optionScope?: string,
];

const commandRows = [
  ['identity', '*IDN?', '*IDN?', ['query'], 'Reads vendor, model, serial and firmware.', 'identity', 'IEEE 488.2 common commands'],
  ['options', '*OPT?', '*OPT?', ['query'], 'Reads the installed options.', 'identity', 'IEEE 488.2 common commands'],
  ['clear-status', '*CLS', '*CLS', ['write'], 'Clears status and the error queue; it does not make the RF input safe.', 'queue', 'IEEE 488.2 common commands'],
  ['operation-complete', '*OPC?', '*OPC?', ['query'], 'Waits for prior overlapped operations and returns 1.', 'queue', 'IEEE 488.2 common commands'],
  ['system-error', 'SYSTEM:ERROR?', 'SYST:ERR?', ['query'], 'Pops the oldest error-queue record.', 'queue', 'SYSTem:ERRor?'],
  ['abort', 'ABORT', 'ABOR', ['write'], 'Aborts an acquisition without changing the physical input signal.', 'safety', 'ABORt'],
  ['configure-sa', 'CONFIGURE:SANALYZER:NDEFAULT', 'CONF:SAN:NDEF', ['write'], 'Selects Swept SA while preserving existing SA settings.', 'configuration', 'CONFigure:SANalyzer[:NDEFault]'],
  ['current-measurement', 'CONFIGURE?', 'CONF?', ['query'], 'Reads the selected measurement name.', 'configuration', 'CONFigure?'],
  ['continuous', 'INITIATE:CONTINUOUS', 'INIT:CONT', ['write', 'query'], 'Controls repeated acquisition.', 'acquisition', 'INITiate:CONTinuous'],
  ['initiate', 'INITIATE:IMMEDIATE', 'INIT:IMM', ['write'], 'Starts one acquisition using the configured trigger.', 'acquisition', 'INITiate[:IMMediate]'],
  ['center-frequency', 'SENSE:FREQUENCY:CENTER', 'FREQ:CENT', ['write', 'query'], 'Sets the center frequency.', 'configuration', 'SENSe:FREQuency:CENTer'],
  ['frequency-span', 'SENSE:FREQUENCY:SPAN', 'FREQ:SPAN', ['write', 'query'], 'Sets the displayed frequency span.', 'configuration', 'SENSe:FREQuency:SPAN'],
  ['start-frequency', 'SENSE:FREQUENCY:START', 'FREQ:STAR', ['write', 'query'], 'Sets the left edge of a nonzero span.', 'configuration', 'SENSe:FREQuency:STARt'],
  ['stop-frequency', 'SENSE:FREQUENCY:STOP', 'FREQ:STOP', ['write', 'query'], 'Sets the right edge of a nonzero span.', 'configuration', 'SENSe:FREQuency:STOP'],
  ['reference-level', 'DISPLAY:WINDOW1:TRACE:Y:SCALE:RLEVEL', 'DISP:WIND:TRAC:Y:RLEV', ['write', 'query'], 'Sets the display reference level; this is not a damage limit.', 'configuration', 'DISPlay:WINDow[1]:TRACe:Y[:SCALe]:RLEVel'],
  ['attenuation-auto', 'SENSE:POWER:RF:ATTENUATION:AUTO', 'POW:ATT:AUTO', ['write', 'query'], 'Controls automatic RF input attenuation.', 'safety', 'SENSe:POWer:RF:ATTenuation:AUTO'],
  ['attenuation', 'SENSE:POWER:RF:ATTENUATION', 'POW:ATT', ['write', 'query'], 'Sets mechanical input attenuation.', 'safety', 'SENSe:POWer:RF:ATTenuation'],
  ['preamp', 'SENSE:POWER:RF:GAIN:STATE', 'POW:GAIN', ['write', 'query'], 'Controls preamplifier state.', 'safety', 'SENSe:POWer:RF:GAIN[:STATe]', 'Option P26 in this profile'],
  ['rbw-auto', 'SENSE:BANDWIDTH:RESOLUTION:AUTO', 'BAND:RES:AUTO', ['write', 'query'], 'Controls automatic resolution bandwidth.', 'configuration', 'SENSe:BANDwidth:RESolution:AUTO'],
  ['rbw', 'SENSE:BANDWIDTH:RESOLUTION', 'BAND:RES', ['write', 'query'], 'Sets resolution bandwidth.', 'measurement', 'SENSe:BANDwidth:RESolution'],
  ['vbw-auto', 'SENSE:BANDWIDTH:VIDEO:AUTO', 'BAND:VID:AUTO', ['write', 'query'], 'Controls automatic video bandwidth.', 'configuration', 'SENSe:BANDwidth:VIDeo:AUTO'],
  ['vbw', 'SENSE:BANDWIDTH:VIDEO', 'BAND:VID', ['write', 'query'], 'Sets video bandwidth after detection.', 'measurement', 'SENSe:BANDwidth:VIDeo'],
  ['detector', 'SENSE:DETECTOR:TRACE1', 'DET:TRAC1', ['write', 'query'], 'Selects trace detector behavior.', 'measurement', 'SENSe:DETector:TRACe[1]'],
  ['trace-type', 'TRACE1:TYPE', 'TRAC1:TYPE', ['write', 'query'], 'Selects clear/write, average, maximum-hold or minimum-hold trace processing.', 'measurement', 'TRACe[1]:TYPE'],
  ['average-count', 'SENSE:AVERAGE:COUNT', 'AVER:COUN', ['write', 'query'], 'Sets the number of acquisitions used by averaging.', 'measurement', 'SENSe:AVERage:COUNt'],
  ['average-clear', 'SENSE:AVERAGE:CLEAR', 'AVER:CLE', ['write'], 'Restarts averaging or hold processing.', 'acquisition', 'SENSe:AVERage:CLEar'],
  ['sweep-points', 'SENSE:SWEEP:POINTS', 'SWE:POIN', ['write', 'query'], 'Sets the number of trace points.', 'measurement', 'SENSe:SWEep:POINts'],
  ['sweep-time-auto', 'SENSE:SWEEP:TIME:AUTO', 'SWE:TIME:AUTO', ['write', 'query'], 'Controls automatic sweep time.', 'configuration', 'SENSe:SWEep:TIME:AUTO'],
  ['sweep-time', 'SENSE:SWEEP:TIME', 'SWE:TIME', ['write', 'query'], 'Sets sweep time.', 'measurement', 'SENSe:SWEep:TIME'],
  ['trigger-source', 'TRIGGER:SANALYZER:SEQUENCE:SOURCE', 'TRIG:SAN:SOUR', ['write', 'query'], 'Selects Swept SA immediate, external or RF-burst trigger.', 'acquisition', 'TRIGger:SANalyzer[:SEQuence]:SOURce'],
  ['trigger-delay', 'TRIGGER:DELAY', 'TRIG:DEL', ['write', 'query'], 'Sets acquisition delay relative to trigger.', 'acquisition', 'TRIGger:DELay'],
  ['trace-data', 'TRACE:DATA? TRACE1', 'TRAC? TRACE1', ['query'], 'Returns the current Swept SA trace amplitude array.', 'measurement', 'TRACe[:DATA]? TRACE1'],
  ['data-format', 'FORMAT:TRACE:DATA', 'FORM:DATA', ['write', 'query'], 'Selects ASCII, REAL,32 or REAL,64 trace transfer format.', 'configuration', 'FORMat[:TRACe][:DATA]'],
  ['byte-order', 'FORMAT:BORDER', 'FORM:BORD', ['write', 'query'], 'Selects normal or swapped byte order for binary data.', 'configuration', 'FORMat:BORDer'],
  ['marker-state', 'CALCULATE:MARKER1:STATE', 'CALC:MARK1:STAT', ['write', 'query'], 'Controls marker 1.', 'measurement', 'CALCulate:MARKer:STATe'],
  ['marker-maximum', 'CALCULATE:MARKER1:MAXIMUM', 'CALC:MARK1:MAX', ['write'], 'Moves marker 1 to the highest current trace point.', 'measurement', 'CALCulate:MARKer:MAXimum'],
  ['marker-x', 'CALCULATE:MARKER1:X', 'CALC:MARK1:X', ['write', 'query'], 'Sets or reads marker frequency.', 'measurement', 'CALCulate:MARKer:X'],
  ['marker-y', 'CALCULATE:MARKER1:Y?', 'CALC:MARK1:Y?', ['query'], 'Reads marker amplitude.', 'measurement', 'CALCulate:MARKer:Y?'],
  ['configure-channel-power', 'CONFIGURE:CHPOWER', 'CONF:CHP', ['write'], 'Selects Channel Power measurement.', 'configuration', 'CONFigure:CHPower'],
  ['read-channel-power', 'READ:CHPOWER?', 'READ:CHP?', ['query'], 'Initiates and returns channel-power results.', 'measurement', 'READ:CHPower?'],
  ['fetch-channel-power', 'FETCH:CHPOWER?', 'FETC:CHP?', ['query'], 'Returns the latest valid channel-power result without acquiring.', 'measurement', 'FETCh:CHPower?'],
  ['configure-acp', 'CONFIGURE:ACPOWER', 'CONF:ACP', ['write'], 'Selects adjacent-channel-power measurement.', 'configuration', 'CONFigure:ACPower'],
  ['read-acp', 'READ:ACPOWER?', 'READ:ACP?', ['query'], 'Initiates and returns ACP results.', 'measurement', 'READ:ACPower?'],
  ['fetch-acp', 'FETCH:ACPOWER?', 'FETC:ACP?', ['query'], 'Returns the latest valid ACP result without acquiring.', 'measurement', 'FETCh:ACPower?'],
  ['configure-obw', 'CONFIGURE:OBWIDTH', 'CONF:OBW', ['write'], 'Selects occupied-bandwidth measurement.', 'configuration', 'CONFigure:OBWidth'],
  ['read-obw', 'READ:OBWIDTH?', 'READ:OBW?', ['query'], 'Initiates and returns occupied-bandwidth results.', 'measurement', 'READ:OBWidth?'],
  ['fetch-obw', 'FETCH:OBWIDTH?', 'FETC:OBW?', ['query'], 'Returns the latest valid occupied-bandwidth result without acquiring.', 'measurement', 'FETCh:OBWidth?'],
] as const satisfies readonly CommandRow[];

export const n9020bCommandCatalog: readonly InstrumentScpiCommandDefinition[] = Object.freeze(
  commandRows.map(([id, longForm, shortForm, forms, stateEffect, safetyClass, section, optionScope]) => Object.freeze({
    id,
    longForm,
    shortForm,
    forms,
    stateEffect,
    safetyClass,
    supportedModels: [N9020B_MODEL] as const,
    firmwareScope: N9020B_FIRMWARE_SCOPE,
    optionScope: optionScope ?? 'N9020B Spectrum Analyzer application',
    source: commandSource(section),
  })),
);

export const n9020bReferences = Object.freeze({
  product: Object.freeze({
    title: 'Keysight N9020B MXA Signal Analyzer product profile',
    organization: 'Keysight Technologies',
    url: PRODUCT_URL,
    documentNumber: 'N9020B product page',
    revision: 'Reviewed 2026-07-12',
    section: 'Frequency options and product support',
  } satisfies InstrumentReference),
  specifications: Object.freeze({
    title: 'Keysight N9020B MXA Signal Analyzer Specifications Guide',
    organization: 'Keysight Technologies',
    url: SPECIFICATION_URL,
    documentNumber: 'N9020-90276',
    assetId: '9018-04846',
    revision: 'Edition 1 (2025-01)',
    section: 'Input damage levels, preamplifier gain and wideband IF full scale',
  } satisfies InstrumentReference),
  programming: commandSource('Spectrum Analyzer mode command tree'),
});

export type N9020bMode = 'SA' | 'CHP' | 'ACP' | 'OBW';
export type N9020bDetector = 'NORM' | 'POS' | 'NEG' | 'SAMP' | 'AVER';
export type N9020bTriggerSource = 'IMM' | 'VID' | 'EXT1' | 'RFB';
export type N9020bTraceType = 'WRIT' | 'AVER' | 'MAXH' | 'MINH';
export type N9020bDataFormat = 'ASC' | 'REAL,32' | 'REAL,64';

export interface N9020bState {
  readonly mode: N9020bMode;
  readonly centerHz: number;
  readonly sweptCenterHz: number;
  readonly sweptSpanHz: number;
  readonly measurementCenterHz: Readonly<Record<'CHP' | 'ACP' | 'OBW', number>>;
  readonly spanHz: number;
  readonly referenceLevelDbm: number;
  readonly attenuationAuto: boolean;
  readonly attenuationDb: number;
  readonly preampEnabled: boolean;
  readonly rbwAuto: boolean;
  readonly rbwHz: number;
  readonly vbwAuto: boolean;
  readonly vbwHz: number;
  readonly detector: N9020bDetector;
  readonly traceType: N9020bTraceType;
  readonly averageCount: number;
  readonly dataFormat: N9020bDataFormat;
  readonly byteOrder: 'NORM' | 'SWAP';
  readonly sweepPoints: number;
  readonly sweepTimeAuto: boolean;
  readonly sweepTimeSeconds: number;
  readonly triggerSource: N9020bTriggerSource;
  readonly triggerDelaySeconds: number;
  readonly continuousEnabled: boolean;
  readonly acquisitionPending: boolean;
  readonly traceFresh: boolean;
  readonly markerEnabled: boolean;
  readonly markerHz: number;
}

export interface N9020bInputSafetyInput {
  readonly dutOutputAverageDbm: number;
  readonly dutOutputPeakDbm: number;
  /** Signed gain from DUT plane to analyzer connector; attenuation is negative. */
  readonly pathGainDb: number;
  readonly uncertaintyDb: number;
  readonly guardMarginDb: number;
  readonly pulseWidthSeconds: number;
  readonly dutyCyclePercent: number;
  readonly dcVolts: number;
  readonly acCoupled: boolean;
  readonly inputAttenuationDb: number;
  readonly preampGainDb: number;
}

export interface N9020bInputSafetyDecision {
  readonly allowed: boolean;
  readonly connectorAverageDbm: number;
  readonly connectorPeakDbm: number;
  readonly worstCaseAverageDbm: number;
  readonly worstCasePeakDbm: number;
  readonly mixerAverageDbm: number;
  readonly mixerPeakDbm: number;
  readonly averageHeadroomDb: number;
  readonly peakHeadroomDb: number;
  readonly mixerHeadroomDb: number;
  readonly reasons: readonly string[];
}

export interface N9020bIqCapture {
  readonly analysisBandwidthHz: number;
  readonly sampleRateHz: number;
  readonly sampleCount: number;
  readonly durationSeconds: number;
  readonly binSpacingHz: number;
  readonly pretriggerSamples: number;
}

export interface SpectrumPoint { readonly frequencyHz: number; readonly powerDbm: number }

export interface SpectrumScenario {
  readonly centerHz: number;
  readonly spanHz: number;
  readonly channelBandwidthHz: number;
  readonly channelPowerDbm: number;
  readonly aclrDb: number;
  readonly rbwHz: number;
  readonly vbwHz: number;
  readonly detector: N9020bDetector;
  readonly points: number;
}

export interface N9020bScpiError { readonly code: number; readonly message: string }
export interface N9020bTranscriptEntry {
  readonly index: number;
  readonly direction: 'write' | 'read';
  readonly message: string;
  readonly outcome: 'ok' | 'error' | 'would-time-out';
  readonly error?: N9020bScpiError;
}
export interface N9020bSession {
  readonly state: N9020bState;
  readonly outputQueue: readonly string[];
  readonly errorQueue: readonly N9020bScpiError[];
  readonly transcript: readonly N9020bTranscriptEntry[];
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
  return value;
}

function range(value: number, min: number, max: number, label: string): number {
  finite(value, label);
  if (value < min || value > max) throw new RangeError(`${label} must be between ${min} and ${max}.`);
  return value;
}

export function dbmToMilliwatts(dbm: number): number { return 10 ** (finite(dbm, 'dbm') / 10); }
export function milliwattsToDbm(milliwatts: number): number {
  if (!Number.isFinite(milliwatts) || milliwatts <= 0) throw new RangeError('milliwatts must be greater than zero.');
  return 10 * Math.log10(milliwatts);
}

/** Maximum nominal P26 gain used for a conservative educational level plan. */
export function n9020bPreampMaxGainDb(frequencyHz: number): number {
  range(frequencyHz, 100_000, N9020B_FREQUENCY_MAX_HZ, 'frequencyHz');
  return frequencyHz <= 3_600_000_000
    ? N9020B_PREAMP_LOW_BAND_MAX_GAIN_DB
    : N9020B_PREAMP_HIGH_BAND_MAX_GAIN_DB;
}

export function evaluateN9020bInputSafety(input: N9020bInputSafetyInput): N9020bInputSafetyDecision {
  Object.entries(input).forEach(([label, value]) => {
    if (typeof value === 'number') finite(value, label);
  });
  range(input.dutyCyclePercent, 0, 100, 'dutyCyclePercent');
  range(input.inputAttenuationDb, 0, 70, 'inputAttenuationDb');
  const connectorAverageDbm = input.dutOutputAverageDbm + input.pathGainDb;
  const connectorPeakDbm = input.dutOutputPeakDbm + input.pathGainDb;
  const worstCaseAverageDbm = connectorAverageDbm + input.uncertaintyDb + input.guardMarginDb;
  const worstCasePeakDbm = connectorPeakDbm + input.uncertaintyDb + input.guardMarginDb;
  const conditionalPulse = input.pulseWidthSeconds <= N9020B_DAMAGE_PULSE_MAX_SECONDS
    && input.dutyCyclePercent <= N9020B_DAMAGE_PULSE_MAX_DUTY_PERCENT
    && input.inputAttenuationDb >= 30;
  const peakLimit = conditionalPulse ? N9020B_DAMAGE_PULSE_DBM : N9020B_DAMAGE_AVERAGE_DBM;
  const mixerAverageDbm = worstCaseAverageDbm - input.inputAttenuationDb + input.preampGainDb;
  const mixerPeakDbm = worstCasePeakDbm - input.inputAttenuationDb + input.preampGainDb;
  const dcLimit = input.acCoupled ? N9020B_DAMAGE_AC_COUPLED_VOLTS : N9020B_DAMAGE_DC_COUPLED_VOLTS;
  const reasons: string[] = [];
  if (worstCaseAverageDbm > N9020B_DAMAGE_AVERAGE_DBM) reasons.push('worst-case average connector power exceeds the damage level');
  if (worstCasePeakDbm > peakLimit) reasons.push(conditionalPulse ? 'worst-case pulse exceeds the conditional pulse damage level' : 'pulse conditions do not qualify for the conditional +50 dBm limit');
  if (Math.abs(input.dcVolts) > dcLimit) reasons.push('DC voltage exceeds the selected coupling damage limit');
  if (mixerPeakDbm > N9020B_WIDEBAND_ADC_FULL_SCALE_DBM) reasons.push('front-end level exceeds the educational Band-0/low-IF-gain ADC full-scale assumption; check the actual band, IF gain and overload status');
  return {
    allowed: reasons.length === 0,
    connectorAverageDbm,
    connectorPeakDbm,
    worstCaseAverageDbm,
    worstCasePeakDbm,
    mixerAverageDbm,
    mixerPeakDbm,
    averageHeadroomDb: N9020B_DAMAGE_AVERAGE_DBM - worstCaseAverageDbm,
    peakHeadroomDb: peakLimit - worstCasePeakDbm,
    mixerHeadroomDb: N9020B_CONSERVATIVE_MIXER_LEVEL_DBM - mixerAverageDbm,
    reasons,
  };
}

export function calculateIqCapture(
  analysisBandwidthHz: number,
  sampleCount: number,
  pretriggerPercent = 20,
): N9020bIqCapture {
  range(analysisBandwidthHz, 1, N9020B_ANALYSIS_BANDWIDTH_MAX_HZ, 'analysisBandwidthHz');
  range(sampleCount, 16, 16_777_216, 'sampleCount');
  range(pretriggerPercent, 0, 100, 'pretriggerPercent');
  const sampleRateHz = analysisBandwidthHz * 1.25;
  return {
    analysisBandwidthHz,
    sampleRateHz,
    sampleCount: Math.round(sampleCount),
    durationSeconds: sampleCount / sampleRateHz,
    binSpacingHz: sampleRateHz / sampleCount,
    pretriggerSamples: Math.round(sampleCount * pretriggerPercent / 100),
  };
}

export function estimateSweepTimeSeconds(spanHz: number, rbwHz: number, points: number, vbwHz = rbwHz): number {
  range(spanHz, 0, N9020B_FREQUENCY_MAX_HZ, 'spanHz');
  range(rbwHz, 1, 8_000_000, 'rbwHz');
  range(vbwHz, 1, 50_000_000, 'vbwHz');
  range(points, 101, 20_001, 'points');
  if (spanHz === 0) return Math.max(1e-6, points / Math.max(vbwHz, 1));
  const normalizedPoints = points / 1001;
  return Math.max(1e-3, 0.25 * normalizedPoints * spanHz / (rbwHz ** 2) * Math.max(1, rbwHz / vbwHz));
}

function deterministicRipple(index: number): number {
  return 0.55 * Math.sin(index * 1.731) + 0.24 * Math.sin(index * 0.317 + 1.2);
}

export function generateN9020bSpectrum(scenario: SpectrumScenario): readonly SpectrumPoint[] {
  const points = Math.max(101, Math.round(scenario.points));
  const start = scenario.centerHz - scenario.spanHz / 2;
  const spacing = scenario.spanHz / (points - 1);
  const noise = -154 + 10 * Math.log10(scenario.rbwHz)
    + (scenario.detector === 'POS' ? 2.5 : scenario.detector === 'AVER' ? -1.2 : 0);
  const smooth = Math.max(0.08, Math.min(1, scenario.vbwHz / scenario.rbwHz));
  return Object.freeze(Array.from({ length: points }, (_, index) => {
    const frequencyHz = start + index * spacing;
    const offset = frequencyHz - scenario.centerHz;
    const normalized = Math.abs(offset) / Math.max(1, scenario.channelBandwidthHz / 2);
    let signalDbm: number;
    if (normalized <= 1) {
      const edgeRoll = 1.5 * normalized ** 8;
      signalDbm = scenario.channelPowerDbm - 10 * Math.log10(Math.max(1, scenario.channelBandwidthHz / scenario.rbwHz)) - edgeRoll;
    } else if (normalized <= 3) {
      const adjacentIndex = Math.floor((normalized - 1) / 2);
      signalDbm = scenario.channelPowerDbm - scenario.aclrDb - 10 * Math.log10(Math.max(1, scenario.channelBandwidthHz / scenario.rbwHz)) - adjacentIndex * 3;
    } else {
      signalDbm = -200;
    }
    const spur1 = scenario.centerHz + scenario.channelBandwidthHz * 2.8;
    const spurDistanceBins = Math.abs(frequencyHz - spur1) / Math.max(spacing, scenario.rbwHz);
    const spurDbm = scenario.channelPowerDbm - 52 - 10 * Math.log10(1 + spurDistanceBins ** 2);
    const combinedMw = dbmToMilliwatts(noise + deterministicRipple(index) * smooth)
      + dbmToMilliwatts(signalDbm)
      + dbmToMilliwatts(spurDbm);
    return Object.freeze({ frequencyHz, powerDbm: milliwattsToDbm(combinedMw) });
  }));
}

export function integrateTracePowerDbm(
  trace: readonly SpectrumPoint[],
  startHz: number,
  stopHz: number,
  rbwHz: number,
): number {
  if (trace.length < 2) throw new RangeError('trace must contain at least two points.');
  if (stopHz <= startHz) throw new RangeError('stopHz must be greater than startHz.');
  const spacing = Math.abs(trace[1]!.frequencyHz - trace[0]!.frequencyHz);
  const correction = spacing / Math.max(1, rbwHz);
  const totalMw = trace
    .filter(({ frequencyHz }) => frequencyHz >= startHz && frequencyHz <= stopHz)
    .reduce((sum, point) => sum + dbmToMilliwatts(point.powerDbm) * correction, 0);
  return milliwattsToDbm(Math.max(totalMw, 1e-20));
}

export function calculateOccupiedBandwidth(trace: readonly SpectrumPoint[], percent = 99): number {
  range(percent, 1, 100, 'percent');
  if (trace.length < 2) throw new RangeError('trace must contain at least two points.');
  const powers = trace.map(({ powerDbm }) => dbmToMilliwatts(powerDbm));
  const total = powers.reduce((sum, value) => sum + value, 0);
  const tail = total * (1 - percent / 100) / 2;
  let cumulative = 0;
  let low = 0;
  for (; low < powers.length - 1; low += 1) { cumulative += powers[low]!; if (cumulative >= tail) break; }
  cumulative = 0;
  let high = powers.length - 1;
  for (; high > low; high -= 1) { cumulative += powers[high]!; if (cumulative >= tail) break; }
  return trace[high]!.frequencyHz - trace[low]!.frequencyHz;
}

export function calculateAclrDb(
  trace: readonly SpectrumPoint[],
  centerHz: number,
  channelBandwidthHz: number,
  rbwHz: number,
): { readonly lowerDb: number; readonly upperDb: number } {
  const half = channelBandwidthHz / 2;
  const main = integrateTracePowerDbm(trace, centerHz - half, centerHz + half, rbwHz);
  const lower = integrateTracePowerDbm(trace, centerHz - 1.5 * channelBandwidthHz, centerHz - 0.5 * channelBandwidthHz, rbwHz);
  const upper = integrateTracePowerDbm(trace, centerHz + 0.5 * channelBandwidthHz, centerHz + 1.5 * channelBandwidthHz, rbwHz);
  return { lowerDb: main - lower, upperDb: main - upper };
}

export const defaultN9020bState: N9020bState = Object.freeze({
  mode: 'SA',
  centerHz: 3_500_000_000,
  sweptCenterHz: 3_500_000_000,
  sweptSpanHz: 200_000_000,
  measurementCenterHz: Object.freeze({ CHP: 3_500_000_000, ACP: 3_500_000_000, OBW: 3_500_000_000 }),
  spanHz: 200_000_000,
  referenceLevelDbm: 10,
  attenuationAuto: false,
  attenuationDb: 30,
  preampEnabled: false,
  rbwAuto: false,
  rbwHz: 100_000,
  vbwAuto: false,
  vbwHz: 300_000,
  detector: 'NORM',
  traceType: 'WRIT',
  averageCount: 10,
  dataFormat: 'ASC',
  byteOrder: 'NORM',
  sweepPoints: 1001,
  sweepTimeAuto: true,
  sweepTimeSeconds: 0.01,
  triggerSource: 'IMM',
  triggerDelaySeconds: 0,
  continuousEnabled: false,
  acquisitionPending: false,
  traceFresh: false,
  markerEnabled: false,
  markerHz: 3_500_000_000,
});

export function createN9020bSession(state: Partial<N9020bState> = {}): N9020bSession {
  return Object.freeze({
    state: Object.freeze({ ...defaultN9020bState, ...state }),
    outputQueue: Object.freeze([]),
    errorQueue: Object.freeze([]),
    transcript: Object.freeze([]),
  });
}

function appendTranscript(session: N9020bSession, entry: Omit<N9020bTranscriptEntry, 'index'>): N9020bSession {
  return Object.freeze({
    ...session,
    transcript: Object.freeze([...session.transcript, Object.freeze({ ...entry, index: session.transcript.length + 1 })]),
  });
}

function withError(session: N9020bSession, command: string, code: number, message: string): N9020bSession {
  const error = Object.freeze({ code, message });
  return appendTranscript(Object.freeze({ ...session, errorQueue: Object.freeze([...session.errorQueue, error]) }), {
    direction: 'write', message: command, outcome: 'error', error,
  });
}

function parseBoolean(argument: string): boolean | null {
  const value = argument.trim().toUpperCase();
  if (value === '1' || value === 'ON') return true;
  if (value === '0' || value === 'OFF') return false;
  return null;
}

function parseNumber(argument: string): number | null {
  const match = argument.trim().toUpperCase().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?)\s*(HZ|KHZ|MHZ|GHZ|S|MS|US|DBM|DB)?$/);
  if (!match) return null;
  const base = Number(match[1]);
  const scale: Record<string, number> = { HZ: 1, KHZ: 1e3, MHZ: 1e6, GHZ: 1e9, S: 1, MS: 1e-3, US: 1e-6, DBM: 1, DB: 1 };
  return base * (scale[match[2] ?? 'HZ'] ?? 1);
}

function canonicalHeader(raw: string): string {
  return raw.trim().replace(/^:/, '').toUpperCase();
}

function setState(session: N9020bSession, patch: Partial<N9020bState>, command: string): N9020bSession {
  return appendTranscript(Object.freeze({ ...session, state: Object.freeze({ ...session.state, traceFresh: false, ...patch }) }), {
    direction: 'write', message: command, outcome: 'ok',
  });
}

export function writeN9020bScpi(session: N9020bSession, programMessage: string): N9020bSession {
  const raw = programMessage.trim();
  if (!raw) return withError(session, programMessage, -109, 'Missing parameter');
  if (raw.includes(';') || /[\r\n]/.test(raw)) return withError(session, raw, -113, 'One command per educational program message');
  if (raw.endsWith('?')) return withError(session, raw, -410, 'Query INTERRUPTED; use query operation');
  const firstSpace = raw.search(/\s/);
  const header = canonicalHeader(firstSpace < 0 ? raw : raw.slice(0, firstSpace));
  const argument = firstSpace < 0 ? '' : raw.slice(firstSpace + 1).trim();
  if (header === '*CLS') return appendTranscript(Object.freeze({ ...session, errorQueue: Object.freeze([]) }), { direction: 'write', message: raw, outcome: 'ok' });
  if (header === 'ABOR' || header === 'ABORT') return setState(session, { acquisitionPending: false, traceFresh: false }, raw);
  if (header === 'INIT:IMM' || header === 'INITIATE:IMMEDIATE') {
    const waitsForEvent = session.state.mode === 'SA' && session.state.triggerSource !== 'IMM';
    return setState(session, { acquisitionPending: waitsForEvent, traceFresh: !waitsForEvent }, raw);
  }
  if (header === 'AVER:CLE' || header === 'SENSE:AVERAGE:CLEAR') return setState(session, { traceFresh: false }, raw);
  if (header === 'CALC:MARK1:MAX' || header === 'CALCULATE:MARKER1:MAXIMUM') {
    if (!session.state.traceFresh) return withError(session, raw, -230, 'Data corrupt or stale; acquire a fresh trace first');
    return setState(session, { markerEnabled: true, markerHz: session.state.centerHz, traceFresh: true }, raw);
  }
  if (header === 'CONF:SAN:NDEF' || header === 'CONFIGURE:SANALYZER:NDEFAULT') return setState(session, { mode: 'SA', centerHz: session.state.sweptCenterHz, spanHz: session.state.sweptSpanHz }, raw);
  if (header === 'CONF:CHP' || header === 'CONFIGURE:CHPOWER') return setState(session, { mode: 'CHP', centerHz: session.state.measurementCenterHz.CHP }, raw);
  if (header === 'CONF:ACP' || header === 'CONFIGURE:ACPOWER') return setState(session, { mode: 'ACP', centerHz: session.state.measurementCenterHz.ACP }, raw);
  if (header === 'CONF:OBW' || header === 'CONFIGURE:OBWIDTH') return setState(session, { mode: 'OBW', centerHz: session.state.measurementCenterHz.OBW }, raw);

  const measurementCenterHeaders: Readonly<Record<string, N9020bMode>> = {
    'CHP:FREQ:CENT': 'CHP', 'CHPOWER:FREQUENCY:CENTER': 'CHP',
    'ACP:FREQ:CENT': 'ACP', 'ACPOWER:FREQUENCY:CENTER': 'ACP',
    'OBW:FREQ:CENT': 'OBW', 'OBWIDTH:FREQUENCY:CENTER': 'OBW',
  };
  if (header in measurementCenterHeaders) {
    const requiredMode = measurementCenterHeaders[header]!;
    const value = parseNumber(argument);
    if (session.state.mode !== requiredMode) return withError(session, raw, -221, `${requiredMode} measurement is not selected`);
    if (value === null || value < N9020B_FREQUENCY_MIN_HZ || value > N9020B_FREQUENCY_MAX_HZ) return withError(session, raw, -222, 'Data out of range');
    return setState(session, {
      centerHz: value,
      measurementCenterHz: Object.freeze({ ...session.state.measurementCenterHz, [requiredMode]: value }),
    }, raw);
  }

  if (header === 'FREQ:STAR' || header === 'SENSE:FREQUENCY:START') {
    if (session.state.mode !== 'SA') return withError(session, raw, -221, 'Swept SA is not selected; use a measurement-qualified frequency command');
    const value = parseNumber(argument);
    const stopHz = session.state.centerHz + session.state.spanHz / 2;
    if (value === null || value < N9020B_FREQUENCY_MIN_HZ || value >= stopHz) return withError(session, raw, -222, 'Start frequency must be below current stop frequency');
    const centerHz = (value + stopHz) / 2;
    const spanHz = stopHz - value;
    return setState(session, { centerHz, spanHz, sweptCenterHz: centerHz, sweptSpanHz: spanHz }, raw);
  }
  if (header === 'FREQ:STOP' || header === 'SENSE:FREQUENCY:STOP') {
    if (session.state.mode !== 'SA') return withError(session, raw, -221, 'Swept SA is not selected; use a measurement-qualified frequency command');
    const value = parseNumber(argument);
    const startHz = session.state.centerHz - session.state.spanHz / 2;
    if (value === null || value > N9020B_FREQUENCY_MAX_HZ || value <= startHz) return withError(session, raw, -222, 'Stop frequency must be above current start frequency');
    const centerHz = (startHz + value) / 2;
    const spanHz = value - startHz;
    return setState(session, { centerHz, spanHz, sweptCenterHz: centerHz, sweptSpanHz: spanHz }, raw);
  }

  const booleanHeaders: Record<string, keyof N9020bState> = {
    'INIT:CONT': 'continuousEnabled', 'INITIATE:CONTINUOUS': 'continuousEnabled',
    'POW:ATT:AUTO': 'attenuationAuto', 'SENSE:POWER:RF:ATTENUATION:AUTO': 'attenuationAuto',
    'POW:GAIN': 'preampEnabled', 'POW:GAIN:STAT': 'preampEnabled', 'SENSE:POWER:RF:GAIN:STATE': 'preampEnabled',
    'BAND:RES:AUTO': 'rbwAuto', 'SENSE:BANDWIDTH:RESOLUTION:AUTO': 'rbwAuto',
    'BAND:VID:AUTO': 'vbwAuto', 'SENSE:BANDWIDTH:VIDEO:AUTO': 'vbwAuto',
    'SWE:TIME:AUTO': 'sweepTimeAuto', 'SENSE:SWEEP:TIME:AUTO': 'sweepTimeAuto',
    'CALC:MARK1:STAT': 'markerEnabled', 'CALCULATE:MARKER1:STATE': 'markerEnabled',
  };
  if (header in booleanHeaders) {
    const value = parseBoolean(argument);
    if (value === null) return withError(session, raw, -222, 'Data out of range');
    const key = booleanHeaders[header]!;
    return setState(session, { [key]: value } as Partial<N9020bState>, raw);
  }

  const numericHeaders: Record<string, readonly [keyof N9020bState, number, number]> = {
    'FREQ:CENT': ['centerHz', N9020B_FREQUENCY_MIN_HZ, N9020B_FREQUENCY_MAX_HZ],
    'SENSE:FREQUENCY:CENTER': ['centerHz', N9020B_FREQUENCY_MIN_HZ, N9020B_FREQUENCY_MAX_HZ],
    'FREQ:SPAN': ['spanHz', 0, N9020B_FREQUENCY_MAX_HZ],
    'SENSE:FREQUENCY:SPAN': ['spanHz', 0, N9020B_FREQUENCY_MAX_HZ],
    'DISP:WIND:TRAC:Y:RLEV': ['referenceLevelDbm', -170, 50],
    'DISP:WIND:TRAC:Y:SCAL:RLEV': ['referenceLevelDbm', -170, 50],
    'DISPLAY:WINDOW1:TRACE:Y:SCALE:RLEVEL': ['referenceLevelDbm', -170, 50],
    'POW:ATT': ['attenuationDb', 0, 70], 'SENSE:POWER:RF:ATTENUATION': ['attenuationDb', 0, 70],
    'BAND:RES': ['rbwHz', 1, 8e6], 'SENSE:BANDWIDTH:RESOLUTION': ['rbwHz', 1, 8e6],
    'BAND:VID': ['vbwHz', 1, 50e6], 'SENSE:BANDWIDTH:VIDEO': ['vbwHz', 1, 50e6],
    'SWE:POIN': ['sweepPoints', 101, 20001], 'SENSE:SWEEP:POINTS': ['sweepPoints', 101, 20001],
    'AVER:COUN': ['averageCount', 1, 100000], 'SENSE:AVERAGE:COUNT': ['averageCount', 1, 100000],
    'SWE:TIME': ['sweepTimeSeconds', 1e-6, 1000], 'SENSE:SWEEP:TIME': ['sweepTimeSeconds', 1e-6, 1000],
    'TRIG:DEL': ['triggerDelaySeconds', -10, 10], 'TRIGGER:DELAY': ['triggerDelaySeconds', -10, 10],
    'CALC:MARK1:X': ['markerHz', N9020B_FREQUENCY_MIN_HZ, N9020B_FREQUENCY_MAX_HZ],
    'CALCULATE:MARKER1:X': ['markerHz', N9020B_FREQUENCY_MIN_HZ, N9020B_FREQUENCY_MAX_HZ],
  };
  if (header in numericHeaders) {
    const [key, min, max] = numericHeaders[header]!;
    const sweptOnly = key === 'centerHz' || key === 'spanHz' || key === 'rbwHz' || key === 'vbwHz' || key === 'sweepPoints' || key === 'sweepTimeSeconds';
    if (sweptOnly && session.state.mode !== 'SA') return withError(session, raw, -221, 'Swept SA is not selected; use a measurement-qualified command');
    const value = parseNumber(argument);
    if (value === null || value < min || value > max) return withError(session, raw, -222, 'Data out of range');
    const normalized = key === 'sweepPoints' || key === 'averageCount' ? Math.round(value) : value;
    const sweptPatch = key === 'centerHz'
      ? { sweptCenterHz: normalized }
      : key === 'spanHz'
        ? { sweptSpanHz: normalized }
        : {};
    return setState(session, { [key]: normalized, ...sweptPatch } as Partial<N9020bState>, raw);
  }

  if (header === 'DET:TRAC1' || header === 'SENSE:DETECTOR:TRACE1' || header === 'DET:TRAC') {
    const value = argument.toUpperCase() as N9020bDetector;
    if (!['NORM', 'POS', 'NEG', 'SAMP', 'AVER'].includes(value)) return withError(session, raw, -222, 'Data out of range');
    return setState(session, { detector: value }, raw);
  }
  if (header === 'TRAC1:TYPE' || header === 'TRACE1:TYPE') {
    const value = argument.toUpperCase().replace('WRITE', 'WRIT').replace('AVERAGE', 'AVER').replace('MAXHOLD', 'MAXH').replace('MINHOLD', 'MINH') as N9020bTraceType;
    if (!['WRIT', 'AVER', 'MAXH', 'MINH'].includes(value)) return withError(session, raw, -222, 'Data out of range');
    return setState(session, { traceType: value }, raw);
  }
  if (header === 'FORM:DATA' || header === 'FORMAT:TRACE:DATA') {
    const value = argument.toUpperCase().replace('ASCII', 'ASC') as N9020bDataFormat;
    if (!['ASC', 'REAL,32', 'REAL,64'].includes(value)) return withError(session, raw, -222, 'Data out of range');
    return setState(session, { dataFormat: value }, raw);
  }
  if (header === 'FORM:BORD' || header === 'FORMAT:BORDER') {
    const value = argument.toUpperCase().replace('NORMAL', 'NORM').replace('SWAPPED', 'SWAP') as 'NORM' | 'SWAP';
    if (!['NORM', 'SWAP'].includes(value)) return withError(session, raw, -222, 'Data out of range');
    return setState(session, { byteOrder: value }, raw);
  }
  if (header === 'TRIG:SAN:SOUR' || header === 'TRIGGER:SANALYZER:SEQUENCE:SOURCE') {
    const value = argument.toUpperCase() as N9020bTriggerSource;
    if (!['IMM', 'VID', 'EXT1', 'RFB'].includes(value)) return withError(session, raw, -222, 'Data out of range');
    return setState(session, { triggerSource: value }, raw);
  }
  return withError(session, raw, -113, 'Undefined header');
}

/** Injects the deterministic event that a non-immediate Swept-SA trigger is waiting for. */
export function completeN9020bTrigger(
  session: N9020bSession,
  source: Exclude<N9020bTriggerSource, 'IMM'>,
): N9020bSession {
  const message = `HOST TRIGGER ${source}`;
  if (!session.state.acquisitionPending || session.state.triggerSource !== source) {
    return withError(session, message, -221, 'No matching pending acquisition');
  }
  return setState(session, { acquisitionPending: false, traceFresh: true }, message);
}

function currentTrace(state: N9020bState): readonly SpectrumPoint[] {
  return generateN9020bSpectrum({
    centerHz: state.centerHz,
    spanHz: state.spanHz,
    channelBandwidthHz: Math.min(100e6, Math.max(1e6, state.spanHz / 2)),
    channelPowerDbm: -10,
    aclrDb: 45,
    rbwHz: state.rbwHz,
    vbwHz: state.vbwHz,
    detector: state.detector,
    points: state.sweepPoints,
  });
}

function queryResponse(session: N9020bSession, header: string): readonly [N9020bSession, string] | null {
  const state = session.state;
  const scalar: Record<string, string> = {
    '*IDN?': `KEYSIGHT TECHNOLOGIES,${N9020B_MODEL},MY00000000,${N9020B_FIRMWARE_SCOPE}`,
    '*OPT?': '526,B1X,MPB,P26,N9060EM0E',
    '*OPC?': '1',
    'CONF?': state.mode === 'SA' ? 'SANalyzer' : state.mode, 'CONFIGURE?': state.mode === 'SA' ? 'SANalyzer' : state.mode,
    'INIT:CONT?': state.continuousEnabled ? '1' : '0', 'INITIATE:CONTINUOUS?': state.continuousEnabled ? '1' : '0',
    'FREQ:CENT?': String(state.centerHz), 'SENSE:FREQUENCY:CENTER?': String(state.centerHz),
    'CHP:FREQ:CENT?': String(state.measurementCenterHz.CHP), 'CHPOWER:FREQUENCY:CENTER?': String(state.measurementCenterHz.CHP),
    'ACP:FREQ:CENT?': String(state.measurementCenterHz.ACP), 'ACPOWER:FREQUENCY:CENTER?': String(state.measurementCenterHz.ACP),
    'OBW:FREQ:CENT?': String(state.measurementCenterHz.OBW), 'OBWIDTH:FREQUENCY:CENTER?': String(state.measurementCenterHz.OBW),
    'FREQ:SPAN?': String(state.spanHz), 'SENSE:FREQUENCY:SPAN?': String(state.spanHz),
    'FREQ:STAR?': String(state.centerHz - state.spanHz / 2), 'SENSE:FREQUENCY:START?': String(state.centerHz - state.spanHz / 2),
    'FREQ:STOP?': String(state.centerHz + state.spanHz / 2), 'SENSE:FREQUENCY:STOP?': String(state.centerHz + state.spanHz / 2),
    'DISP:WIND:TRAC:Y:RLEV?': String(state.referenceLevelDbm), 'DISP:WIND:TRAC:Y:SCAL:RLEV?': String(state.referenceLevelDbm), 'DISPLAY:WINDOW1:TRACE:Y:SCALE:RLEVEL?': String(state.referenceLevelDbm),
    'POW:ATT:AUTO?': state.attenuationAuto ? '1' : '0', 'SENSE:POWER:RF:ATTENUATION:AUTO?': state.attenuationAuto ? '1' : '0',
    'POW:ATT?': String(state.attenuationDb), 'SENSE:POWER:RF:ATTENUATION?': String(state.attenuationDb),
    'POW:GAIN?': state.preampEnabled ? '1' : '0', 'POW:GAIN:STAT?': state.preampEnabled ? '1' : '0', 'SENSE:POWER:RF:GAIN:STATE?': state.preampEnabled ? '1' : '0',
    'BAND:RES:AUTO?': state.rbwAuto ? '1' : '0', 'SENSE:BANDWIDTH:RESOLUTION:AUTO?': state.rbwAuto ? '1' : '0',
    'BAND:RES?': String(state.rbwHz), 'SENSE:BANDWIDTH:RESOLUTION?': String(state.rbwHz),
    'BAND:VID:AUTO?': state.vbwAuto ? '1' : '0', 'SENSE:BANDWIDTH:VIDEO:AUTO?': state.vbwAuto ? '1' : '0',
    'BAND:VID?': String(state.vbwHz), 'SENSE:BANDWIDTH:VIDEO?': String(state.vbwHz),
    'DET:TRAC1?': state.detector, 'SENSE:DETECTOR:TRACE1?': state.detector,
    'TRAC1:TYPE?': state.traceType, 'TRACE1:TYPE?': state.traceType,
    'AVER:COUN?': String(state.averageCount), 'SENSE:AVERAGE:COUNT?': String(state.averageCount),
    'FORM:DATA?': state.dataFormat, 'FORMAT:TRACE:DATA?': state.dataFormat,
    'FORM:BORD?': state.byteOrder, 'FORMAT:BORDER?': state.byteOrder,
    'SWE:POIN?': String(state.sweepPoints), 'SENSE:SWEEP:POINTS?': String(state.sweepPoints),
    'SWE:TIME:AUTO?': state.sweepTimeAuto ? '1' : '0', 'SENSE:SWEEP:TIME:AUTO?': state.sweepTimeAuto ? '1' : '0',
    'SWE:TIME?': String(state.sweepTimeAuto ? estimateSweepTimeSeconds(state.spanHz, state.rbwHz, state.sweepPoints, state.vbwHz) : state.sweepTimeSeconds),
    'SENSE:SWEEP:TIME?': String(state.sweepTimeAuto ? estimateSweepTimeSeconds(state.spanHz, state.rbwHz, state.sweepPoints, state.vbwHz) : state.sweepTimeSeconds),
    'TRIG:SAN:SOUR?': state.triggerSource, 'TRIGGER:SANALYZER:SEQUENCE:SOURCE?': state.triggerSource,
    'TRIG:DEL?': String(state.triggerDelaySeconds), 'TRIGGER:DELAY?': String(state.triggerDelaySeconds),
    'CALC:MARK1:STAT?': state.markerEnabled ? '1' : '0', 'CALCULATE:MARKER1:STATE?': state.markerEnabled ? '1' : '0',
    'CALC:MARK1:X?': String(state.markerHz), 'CALCULATE:MARKER1:X?': String(state.markerHz),
  };
  if (header in scalar) return [session, scalar[header]!];
  if (header === 'SYST:ERR?' || header === 'SYSTEM:ERROR?') {
    const [first, ...rest] = session.errorQueue;
    return [Object.freeze({ ...session, errorQueue: Object.freeze(rest) }), first ? `${first.code},"${first.message}"` : '0,"No error"'];
  }
  if (header === 'TRAC?' || header === 'TRACE:DATA?') {
    if (!state.traceFresh) return null;
    const trace = currentTrace(state);
    const response = state.dataFormat === 'ASC'
      ? trace.map(({ powerDbm }) => powerDbm.toFixed(5)).join(',')
      : `#MOCK-BINARY:${state.dataFormat}:${state.byteOrder}:${trace.length}`;
    return [session, response];
  }
  const trace = currentTrace(state);
  if (header === 'CALC:MARK1:Y?' || header === 'CALCULATE:MARKER1:Y?') {
    if (!state.traceFresh || !state.markerEnabled) return null;
    const nearest = trace.reduce((best, point) => Math.abs(point.frequencyHz - state.markerHz) < Math.abs(best.frequencyHz - state.markerHz) ? point : best);
    return [session, String(nearest.powerDbm)];
  }
  if (header === 'READ:CHP?' || header === 'READ:CHPOWER?' || header === 'FETC:CHP?' || header === 'FETCH:CHPOWER?') {
    if (header.startsWith('FET') && (!state.traceFresh || state.mode !== 'CHP')) return null;
    const power = integrateTracePowerDbm(trace, state.centerHz - 50e6, state.centerHz + 50e6, state.rbwHz);
    return [Object.freeze({ ...session, state: Object.freeze({ ...state, traceFresh: true }) }), `${power},${state.centerHz}`];
  }
  if (header === 'READ:ACP?' || header === 'READ:ACPOWER?' || header === 'FETC:ACP?' || header === 'FETCH:ACPOWER?') {
    if (header.startsWith('FET') && (!state.traceFresh || state.mode !== 'ACP')) return null;
    const aclr = calculateAclrDb(trace, state.centerHz, 100e6, state.rbwHz);
    return [Object.freeze({ ...session, state: Object.freeze({ ...state, traceFresh: true }) }), `${aclr.lowerDb},${aclr.upperDb}`];
  }
  if (header === 'READ:OBW?' || header === 'READ:OBWIDTH?' || header === 'FETC:OBW?' || header === 'FETCH:OBWIDTH?') {
    if (header.startsWith('FET') && (!state.traceFresh || state.mode !== 'OBW')) return null;
    return [Object.freeze({ ...session, state: Object.freeze({ ...state, traceFresh: true }) }), `${calculateOccupiedBandwidth(trace, 99)},${state.centerHz}`];
  }
  return null;
}

export function queryN9020bScpi(session: N9020bSession, programMessage: string): N9020bSession {
  const raw = programMessage.trim();
  const firstSpace = raw.search(/\s/);
  const queryToken = firstSpace < 0 ? raw : raw.slice(0, firstSpace);
  const argument = firstSpace < 0 ? '' : raw.slice(firstSpace + 1).trim().toUpperCase();
  if (!queryToken.endsWith('?') || raw.includes(';') || /[\r\n]/.test(raw)) return withError(session, raw, -113, 'Query header expected; one command per message');
  const header = canonicalHeader(queryToken);
  if ((header === 'TRAC?' || header === 'TRACE:DATA?') && argument !== 'TRACE1') return withError(session, raw, -222, 'TRACE1 argument required');
  const sweptOnlyQueries = new Set([
    'FREQ:CENT?', 'SENSE:FREQUENCY:CENTER?', 'FREQ:SPAN?', 'SENSE:FREQUENCY:SPAN?',
    'FREQ:STAR?', 'SENSE:FREQUENCY:START?', 'FREQ:STOP?', 'SENSE:FREQUENCY:STOP?',
    'BAND:RES?', 'SENSE:BANDWIDTH:RESOLUTION?', 'BAND:VID?', 'SENSE:BANDWIDTH:VIDEO?',
    'SWE:POIN?', 'SENSE:SWEEP:POINTS?', 'SWE:TIME?', 'SENSE:SWEEP:TIME?',
    'DET:TRAC1?', 'SENSE:DETECTOR:TRACE1?', 'TRAC1:TYPE?', 'TRACE1:TYPE?',
    'TRAC?', 'TRACE:DATA?',
  ]);
  if (sweptOnlyQueries.has(header) && session.state.mode !== 'SA') {
    return withError(session, raw, -221, 'Swept SA is not selected; use a measurement-qualified command');
  }
  const measurementCenterQueries: Readonly<Record<string, N9020bMode>> = {
    'CHP:FREQ:CENT?': 'CHP', 'CHPOWER:FREQUENCY:CENTER?': 'CHP',
    'ACP:FREQ:CENT?': 'ACP', 'ACPOWER:FREQUENCY:CENTER?': 'ACP',
    'OBW:FREQ:CENT?': 'OBW', 'OBWIDTH:FREQUENCY:CENTER?': 'OBW',
  };
  if (header in measurementCenterQueries && session.state.mode !== measurementCenterQueries[header]) {
    return withError(session, raw, -221, `${measurementCenterQueries[header]} measurement is not selected`);
  }
  if (header === '*OPC?' && session.state.acquisitionPending) {
    return appendTranscript(session, { direction: 'write', message: raw, outcome: 'would-time-out' });
  }
  const resolved = queryResponse(session, header);
  if (!resolved) {
    const dataQuery = header.includes('TRAC') || header.includes('MARK') || header.startsWith('FETC') || header.startsWith('FETCH');
    return withError(session, raw, dataQuery ? -230 : -113, dataQuery ? 'Data corrupt or stale; configure and complete a fresh acquisition first' : 'Undefined header');
  }
  const [updated, response] = resolved;
  return appendTranscript(Object.freeze({ ...updated, outputQueue: Object.freeze([...updated.outputQueue, response]) }), {
    direction: 'write', message: raw, outcome: 'ok',
  });
}

export function readN9020bScpi(session: N9020bSession): { readonly session: N9020bSession; readonly response: string | null } {
  const [response, ...rest] = session.outputQueue;
  if (response === undefined) return { session: withError(session, 'READ', -420, 'Query UNTERMINATED; output queue empty'), response: null };
  return {
    session: appendTranscript(Object.freeze({ ...session, outputQueue: Object.freeze(rest) }), { direction: 'read', message: response, outcome: 'ok' }),
    response,
  };
}
