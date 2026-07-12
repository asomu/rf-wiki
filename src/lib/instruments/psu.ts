/**
 * Deterministic educational model for a Keysight N6705C with an N6752A
 * high-performance autoranging module in slot 1 (Option 761).
 *
 * The model is intentionally conservative. It teaches state, wiring and
 * program sequencing; it is not a substitute for the instrument firmware,
 * the DUT data sheet, calibration, fusing or a hardware interlock.
 */

import type {
  InstrumentReference,
  InstrumentScpiCommandDefinition,
  InstrumentScpiForm,
  InstrumentScpiSafetyClass,
} from '../../types/instruments';

export const N6752A_VOLTAGE_MAX_V = 50;
export const N6752A_CURRENT_MAX_A = 10;
export const N6752A_POWER_MAX_W = 100;
export const N6752A_REMOTE_SENSE_MAX_DROP_PER_LEAD_V = 1;
export const N6752A_DIGITIZER_MIN_INTERVAL_S = 10.24e-6;
export const N6752A_DIGITIZER_MAX_SAMPLE_RATE_HZ = 1 / N6752A_DIGITIZER_MIN_INTERVAL_S;
export const N6752A_DIGITIZER_MAX_POINTS = 524_288;
export const N6752A_LIST_MAX_STEPS = 512;
export const N6752A_LIST_MAX_DWELL_S = 262.144;
export const N6752A_OVP_MAX_V = 55;
export const N6705C_FIRMWARE_SCOPE = 'E_02_09_3271';
export const N6705C_N6752A_PROFILE_MODEL = 'N6705C + N6752A';

export const n6705cOfficialReferences = Object.freeze({
  programmer: 'https://www.keysight.com/zz/en/assets/9018-03617/programming-guides/9018-03617.pdf',
  specifications: 'https://www.keysight.com/us/en/assets/9018-04533/technical-specifications/9018-04533.pdf',
  operatingGuide: 'https://www.keysight.com/us/en/assets/9018-04227/service-manuals/9018-04227.pdf',
  remoteSense: 'https://www.keysight.com/us/en/assets/7018-01861/brochures/5989-8851.pdf',
  pae: 'https://www.keysight.com/zz/en/assets/7018-01656/application-notes/5989-7293.pdf',
});

function n6705cCommandSource(section: string): InstrumentReference {
  return Object.freeze({
    title: 'Keysight N6700 Modular Power System Programmer’s Reference',
    organization: 'Keysight Technologies',
    url: n6705cOfficialReferences.programmer,
    documentNumber: '9018-03617',
    revision: `Firmware ${N6705C_FIRMWARE_SCOPE} review baseline`,
    section,
  });
}

export const n6705cProgrammingReference = n6705cCommandSource('SCPI command reference');

type N6705cCommandRow = readonly [
  id: string,
  longForm: string,
  shortForm: string,
  forms: readonly InstrumentScpiForm[],
  stateEffect: string,
  safetyClass: InstrumentScpiSafetyClass,
  optionScope: string,
  section: string,
];

const n6705cCommandRows = [
  ['identity', '*IDN?', '*IDN?', ['query'], 'Reads mainframe identity and firmware.', 'identity', 'N6705C base', 'IEEE 488.2 common commands'],
  ['options', '*OPT?', '*OPT?', ['query'], 'Reads mainframe option response.', 'identity', 'N6705C base', 'IEEE 488.2 common commands'],
  ['channel-model', 'SYSTEM:CHANNEL:MODEL?', 'SYST:CHAN:MOD?', ['query'], 'Reads the module installed in the selected slot.', 'identity', 'N6705C slot discovery', 'SYSTem:CHANnel:MODel?'],
  ['channel-options', 'SYSTEM:CHANNEL:OPTIONS?', 'SYST:CHAN:OPT?', ['query'], 'Reads options for the selected module.', 'identity', 'N6705C slot discovery', 'SYSTem:CHANnel:OPTions?'],
  ['operation-complete', '*OPC?', '*OPC?', ['query'], 'Synchronizes prior operations and returns 1.', 'queue', 'N6705C base', 'IEEE 488.2 common commands'],
  ['clear-status', '*CLS', '*CLS', ['write'], 'Clears status and the error queue.', 'queue', 'N6705C base', 'IEEE 488.2 common commands'],
  ['system-error', 'SYSTEM:ERROR?', 'SYST:ERR?', ['query'], 'Pops the oldest SCPI error record.', 'queue', 'N6705C base', 'System error queue'],
  ['output', 'OUTPUT', 'OUTP', ['write', 'query'], 'Controls or reads the selected output state.', 'safety', 'N6752A slot 1; Option 761 profile', 'OUTPut'],
  ['voltage', 'VOLTAGE', 'VOLT', ['write', 'query'], 'Sets or reads the channel voltage setpoint.', 'configuration', 'N6752A slot 1', 'VOLTage'],
  ['current', 'CURRENT', 'CURR', ['write', 'query'], 'Sets or reads the channel current limit.', 'configuration', 'N6752A slot 1', 'CURRent'],
  ['voltage-protection', 'VOLTAGE:PROTECTION', 'VOLT:PROT', ['write', 'query'], 'Sets or reads over-voltage protection.', 'safety', 'N6752A slot 1', 'VOLTage:PROTection'],
  ['current-protection-state', 'CURRENT:PROTECTION:STATE', 'CURR:PROT:STAT', ['write', 'query'], 'Enables or reads over-current protection.', 'safety', 'N6752A slot 1', 'CURRent:PROTection:STATe'],
  ['current-protection-delay', 'CURRENT:PROTECTION:DELAY', 'CURR:PROT:DEL', ['write', 'query'], 'Sets or reads the over-current delay.', 'safety', 'N6752A slot 1', 'CURRent:PROTection:DELay'],
  ['voltage-slew', 'VOLTAGE:SLEW', 'VOLT:SLEW', ['write', 'query'], 'Sets or reads voltage slew.', 'configuration', 'N6752A slot 1', 'VOLTage:SLEW'],
  ['operation-condition', 'STATUS:OPERATION:CONDITION?', 'STAT:OPER:COND?', ['query'], 'Reads the operation status condition bit mask.', 'measurement', 'N6752A slot 1', 'STATus:OPERation:CONDition?'],
  ['abort-transient', 'ABORT:TRANSIENT', 'ABOR:TRAN', ['write'], 'Aborts an armed transient.', 'safety', 'N6752A slot 1', 'ABORt:TRANsient'],
  ['abort-acquisition', 'ABORT:ACQUIRE', 'ABOR:ACQ', ['write'], 'Aborts an acquisition.', 'safety', 'N6752A slot 1', 'ABORt:ACQuire'],
  ['initiate-transient', 'INITIATE:TRANSIENT', 'INIT:TRAN', ['write'], 'Arms the selected transient system.', 'acquisition', 'N6752A slot 1', 'INITiate:TRANsient'],
  ['bus-trigger', '*TRG', '*TRG', ['write'], 'Supplies the bus trigger event to an armed transient.', 'acquisition', 'N6705C base', 'IEEE 488.2 common commands'],
  ['list-voltage', 'LIST:VOLTAGE', 'LIST:VOLT', ['write'], 'Loads voltage LIST points.', 'configuration', 'N6752A slot 1', 'LIST:VOLTage'],
  ['list-dwell', 'LIST:DWELL', 'LIST:DWEL', ['write'], 'Loads LIST dwell values.', 'configuration', 'N6752A slot 1', 'LIST:DWELl'],
  ['voltage-mode', 'VOLTAGE:MODE', 'VOLT:MODE', ['write'], 'Selects fixed, step or LIST voltage mode.', 'configuration', 'N6752A slot 1', 'VOLTage:MODE'],
  ['current-mode', 'CURRENT:MODE', 'CURR:MODE', ['write'], 'Selects fixed, step or LIST current mode.', 'configuration', 'N6752A slot 1', 'CURRent:MODE'],
  ['transient-trigger-source', 'TRIGGER:TRANSIENT:SOURCE', 'TRIG:TRAN:SOUR', ['write'], 'Selects the transient trigger source.', 'acquisition', 'N6752A slot 1', 'TRIGger:TRANsient:SOURce'],
] as const satisfies readonly N6705cCommandRow[];

export const n6705cCommandCatalog: readonly InstrumentScpiCommandDefinition[] = Object.freeze(
  n6705cCommandRows.map(([
    id,
    longForm,
    shortForm,
    forms,
    stateEffect,
    safetyClass,
    optionScope,
    section,
  ]) => Object.freeze({
    id,
    longForm,
    shortForm,
    forms,
    stateEffect,
    safetyClass,
    supportedModels: [N6705C_N6752A_PROFILE_MODEL] as const,
    firmwareScope: N6705C_FIRMWARE_SCOPE,
    optionScope,
    source: n6705cCommandSource(section),
  })),
);

export const n6705cCommandById = Object.freeze(Object.fromEntries(
  n6705cCommandCatalog.map((command) => [command.id, command]),
) as Readonly<Record<string, InstrumentScpiCommandDefinition>>);

export type PsuRegulationMode = 'OFF' | 'CV' | 'CC' | 'POWER_ENVELOPE' | 'TRIPPED';

export interface N6752aOperatingPointInput {
  readonly voltageSetpointV: number;
  readonly currentLimitA: number;
  readonly loadResistanceOhm: number;
  readonly outputEnabled: boolean;
  readonly ovpLevelV: number;
  readonly ocpEnabled: boolean;
  readonly ocpDelayMs: number;
  readonly timeInCurrentLimitMs: number;
}

export interface N6752aOperatingPoint {
  readonly mode: PsuRegulationMode;
  readonly voltageV: number;
  readonly currentA: number;
  readonly powerW: number;
  readonly demandedCurrentA: number;
  readonly demandedPowerW: number;
  readonly maximumCurrentAtSetpointA: number;
  readonly envelopeLimited: boolean;
  readonly protectionReason: string | null;
  readonly operationStatusValue: number;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return value;
}

function within(name: string, value: number, minimum: number, maximum: number): number {
  finite(name, value);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${name} must be within ${minimum} to ${maximum}.`);
  }
  return value;
}

export function getN6752aMaximumCurrentAtVoltage(voltageV: number): number {
  within('voltageV', voltageV, 0, N6752A_VOLTAGE_MAX_V);
  if (voltageV === 0) return N6752A_CURRENT_MAX_A;
  return Math.min(N6752A_CURRENT_MAX_A, N6752A_POWER_MAX_W / voltageV);
}

export function evaluateN6752aOperatingPoint(
  input: N6752aOperatingPointInput,
): N6752aOperatingPoint {
  const voltageSetpointV = within(
    'voltageSetpointV',
    input.voltageSetpointV,
    0,
    N6752A_VOLTAGE_MAX_V,
  );
  const currentLimitA = within('currentLimitA', input.currentLimitA, 0, N6752A_CURRENT_MAX_A);
  const loadResistanceOhm = finite('loadResistanceOhm', input.loadResistanceOhm);
  if (loadResistanceOhm <= 0) throw new RangeError('loadResistanceOhm must be greater than zero.');
  const ovpLevelV = within('ovpLevelV', input.ovpLevelV, 0, N6752A_OVP_MAX_V);
  const ocpDelayMs = finite('ocpDelayMs', input.ocpDelayMs);
  const timeInCurrentLimitMs = finite('timeInCurrentLimitMs', input.timeInCurrentLimitMs);
  if (ocpDelayMs < 0 || timeInCurrentLimitMs < 0) {
    throw new RangeError('OCP timing values must be zero or greater.');
  }

  const demandedCurrentA = voltageSetpointV / loadResistanceOhm;
  const demandedPowerW = voltageSetpointV * demandedCurrentA;
  const maximumCurrentAtSetpointA = getN6752aMaximumCurrentAtVoltage(voltageSetpointV);

  if (!input.outputEnabled) {
    return {
      mode: 'OFF',
      voltageV: 0,
      currentA: 0,
      powerW: 0,
      demandedCurrentA,
      demandedPowerW,
      maximumCurrentAtSetpointA,
      envelopeLimited: false,
      protectionReason: null,
      operationStatusValue: 4,
    };
  }

  if (voltageSetpointV > ovpLevelV) {
    return {
      mode: 'TRIPPED',
      voltageV: 0,
      currentA: 0,
      powerW: 0,
      demandedCurrentA,
      demandedPowerW,
      maximumCurrentAtSetpointA,
      envelopeLimited: false,
      protectionReason: `Voltage setpoint ${voltageSetpointV.toFixed(2)} V exceeds OVP ${ovpLevelV.toFixed(2)} V.`,
      operationStatusValue: 4,
    };
  }

  const cvCurrentA = demandedCurrentA;
  const cvInsideCurrent = cvCurrentA <= currentLimitA && cvCurrentA <= N6752A_CURRENT_MAX_A;
  const cvInsidePower = demandedPowerW <= N6752A_POWER_MAX_W;
  let mode: PsuRegulationMode;
  let currentA: number;

  if (cvInsideCurrent && cvInsidePower) {
    mode = 'CV';
    currentA = cvCurrentA;
  } else {
    const currentAtPowerBoundaryA = Math.sqrt(N6752A_POWER_MAX_W / loadResistanceOhm);
    currentA = Math.min(
      currentLimitA,
      N6752A_CURRENT_MAX_A,
      demandedCurrentA,
      currentAtPowerBoundaryA,
    );
    mode = currentAtPowerBoundaryA < Math.min(currentLimitA, demandedCurrentA)
      ? 'POWER_ENVELOPE'
      : 'CC';
  }

  const voltageV = Math.min(voltageSetpointV, currentA * loadResistanceOhm);
  const powerW = voltageV * currentA;
  const inCurrentLimit = mode === 'CC' || mode === 'POWER_ENVELOPE';
  if (input.ocpEnabled && inCurrentLimit && timeInCurrentLimitMs >= ocpDelayMs) {
    return {
      mode: 'TRIPPED',
      voltageV: 0,
      currentA: 0,
      powerW: 0,
      demandedCurrentA,
      demandedPowerW,
      maximumCurrentAtSetpointA,
      envelopeLimited: mode === 'POWER_ENVELOPE',
      protectionReason: `OCP disabled the output after ${ocpDelayMs.toFixed(0)} ms in current limit.`,
      operationStatusValue: 4,
    };
  }

  return {
    mode,
    voltageV,
    currentA,
    powerW,
    demandedCurrentA,
    demandedPowerW,
    maximumCurrentAtSetpointA,
    envelopeLimited: mode === 'POWER_ENVELOPE',
    protectionReason: null,
    // The real status register reports CV or CC; POWER_ENVELOPE is a Wiki
    // explanation of why the requested V/I point cannot exist inside 100 W.
    operationStatusValue: mode === 'CV' ? 1 : 2,
  };
}

export interface RemoteSenseInput {
  readonly setVoltageV: number;
  readonly loadCurrentA: number;
  readonly forceLeadResistanceOhmPerLead: number;
  readonly remoteSenseEnabled: boolean;
}

export interface RemoteSenseResult {
  readonly totalLeadDropV: number;
  readonly outputTerminalVoltageV: number;
  readonly dutVoltageV: number;
  readonly senseErrorV: number;
  readonly compensationLimited: boolean;
  readonly maximumCompensableDropV: number;
}

export function evaluateRemoteSense(input: RemoteSenseInput): RemoteSenseResult {
  const setVoltageV = within('setVoltageV', input.setVoltageV, 0, N6752A_VOLTAGE_MAX_V);
  const loadCurrentA = within('loadCurrentA', input.loadCurrentA, 0, N6752A_CURRENT_MAX_A);
  const resistance = finite('forceLeadResistanceOhmPerLead', input.forceLeadResistanceOhmPerLead);
  if (resistance < 0) throw new RangeError('forceLeadResistanceOhmPerLead must be zero or greater.');

  const dropPerLeadV = loadCurrentA * resistance;
  const totalLeadDropV = 2 * dropPerLeadV;
  const maximumCompensableDropV = 2 * N6752A_REMOTE_SENSE_MAX_DROP_PER_LEAD_V;
  if (!input.remoteSenseEnabled) {
    const dutVoltageV = Math.max(0, setVoltageV - totalLeadDropV);
    return {
      totalLeadDropV,
      outputTerminalVoltageV: setVoltageV,
      dutVoltageV,
      senseErrorV: setVoltageV - dutVoltageV,
      compensationLimited: false,
      maximumCompensableDropV,
    };
  }

  const compensableDropV = Math.min(totalLeadDropV, maximumCompensableDropV);
  const requiredTerminalVoltageV = setVoltageV + compensableDropV;
  const outputTerminalVoltageV = Math.min(N6752A_VOLTAGE_MAX_V, requiredTerminalVoltageV);
  const dutVoltageV = Math.max(0, outputTerminalVoltageV - totalLeadDropV);
  const compensationLimited = dropPerLeadV > N6752A_REMOTE_SENSE_MAX_DROP_PER_LEAD_V
    || requiredTerminalVoltageV > N6752A_VOLTAGE_MAX_V;
  return {
    totalLeadDropV,
    outputTerminalVoltageV,
    dutVoltageV,
    senseErrorV: setVoltageV - dutVoltageV,
    compensationLimited,
    maximumCompensableDropV,
  };
}

export interface SlewTransientInput {
  readonly voltageStepV: number;
  readonly programmedSlewVPerSecond: number;
  readonly loadCapacitanceMicrofarad: number;
  readonly steadyLoadCurrentA: number;
  readonly currentLimitA: number;
}

export interface SlewTransientResult {
  readonly programmedRiseTimeMs: number;
  readonly capacitiveCurrentA: number;
  readonly predictedPeakCurrentA: number;
  readonly currentLimited: boolean;
  readonly effectiveSlewVPerSecond: number;
  readonly effectiveRiseTimeMs: number;
}

export function evaluateSlewTransient(input: SlewTransientInput): SlewTransientResult {
  const voltageStepV = within('voltageStepV', input.voltageStepV, 0, N6752A_VOLTAGE_MAX_V);
  const programmedSlew = finite('programmedSlewVPerSecond', input.programmedSlewVPerSecond);
  if (programmedSlew <= 0) throw new RangeError('programmedSlewVPerSecond must be greater than zero.');
  const capacitanceF = finite('loadCapacitanceMicrofarad', input.loadCapacitanceMicrofarad) * 1e-6;
  if (capacitanceF < 0) throw new RangeError('loadCapacitanceMicrofarad must be zero or greater.');
  const steadyLoadCurrentA = within('steadyLoadCurrentA', input.steadyLoadCurrentA, 0, N6752A_CURRENT_MAX_A);
  const currentLimitA = within('currentLimitA', input.currentLimitA, 0, N6752A_CURRENT_MAX_A);
  const capacitiveCurrentA = capacitanceF * programmedSlew;
  const predictedPeakCurrentA = steadyLoadCurrentA + capacitiveCurrentA;
  const currentLimited = predictedPeakCurrentA > currentLimitA;
  const availableCapacitiveCurrentA = Math.max(0, currentLimitA - steadyLoadCurrentA);
  const effectiveSlewVPerSecond = currentLimited && capacitanceF > 0
    ? availableCapacitiveCurrentA / capacitanceF
    : programmedSlew;
  const effectiveRiseTimeMs = effectiveSlewVPerSecond > 0
    ? voltageStepV / effectiveSlewVPerSecond * 1000
    : Number.POSITIVE_INFINITY;
  return {
    programmedRiseTimeMs: voltageStepV / programmedSlew * 1000,
    capacitiveCurrentA,
    predictedPeakCurrentA,
    currentLimited,
    effectiveSlewVPerSecond,
    effectiveRiseTimeMs,
  };
}

export interface DigitizedCaptureInput {
  readonly points: number;
  readonly sampleIntervalSeconds: number;
  readonly parameterCount: 1 | 2 | 3 | 4;
}

export interface DigitizedCaptureResult {
  readonly points: number;
  readonly sampleIntervalSeconds: number;
  readonly sampleRateHz: number;
  readonly durationSeconds: number;
  readonly maximumPointsForParameters: number;
}

export function evaluateDigitizedCapture(input: DigitizedCaptureInput): DigitizedCaptureResult {
  if (!Number.isInteger(input.points) || input.points < 1) {
    throw new RangeError('points must be a positive integer.');
  }
  const maximumPointsForParameters = Math.floor(
    N6752A_DIGITIZER_MAX_POINTS / input.parameterCount,
  );
  if (input.points > maximumPointsForParameters) {
    throw new RangeError(`points exceed ${maximumPointsForParameters} for ${input.parameterCount} parameters.`);
  }
  const interval = finite('sampleIntervalSeconds', input.sampleIntervalSeconds);
  if (interval < N6752A_DIGITIZER_MIN_INTERVAL_S) {
    throw new RangeError('N6752A sample interval cannot be shorter than 10.24 microseconds.');
  }
  return {
    points: input.points,
    sampleIntervalSeconds: interval,
    sampleRateHz: 1 / interval,
    durationSeconds: input.points * interval,
    maximumPointsForParameters,
  };
}

export interface PaDcInput {
  readonly voltageV: number;
  readonly currentA: number;
  readonly pinDbm: number;
  readonly poutDbm: number;
}

export interface PaDcResult {
  readonly dcInputPowerW: number;
  readonly rfInputPowerW: number;
  readonly rfOutputPowerW: number;
  readonly addedRfPowerW: number;
  readonly paePercent: number;
  readonly dissipatedPowerW: number;
}

export function dbmToWatts(powerDbm: number): number {
  finite('powerDbm', powerDbm);
  return 10 ** ((powerDbm - 30) / 10);
}

export function calculatePaDcMetrics(input: PaDcInput): PaDcResult {
  const voltageV = within('voltageV', input.voltageV, 0, N6752A_VOLTAGE_MAX_V);
  const currentA = within('currentA', input.currentA, 0, N6752A_CURRENT_MAX_A);
  const dcInputPowerW = voltageV * currentA;
  if (dcInputPowerW <= 0) throw new RangeError('DC input power must be greater than zero.');
  const rfInputPowerW = dbmToWatts(input.pinDbm);
  const rfOutputPowerW = dbmToWatts(input.poutDbm);
  const addedRfPowerW = rfOutputPowerW - rfInputPowerW;
  return {
    dcInputPowerW,
    rfInputPowerW,
    rfOutputPowerW,
    addedRfPowerW,
    paePercent: addedRfPowerW / dcInputPowerW * 100,
    dissipatedPowerW: dcInputPowerW + rfInputPowerW - rfOutputPowerW,
  };
}

export interface PsuProgramStep {
  readonly phase: 'identify' | 'safe-off' | 'configure' | 'verify' | 'arm' | 'enable' | 'cleanup';
  readonly message: string;
  readonly operation: 'write' | 'query';
}

export function createN6705cSafeBiasProgram(options: {
  readonly voltageV: number;
  readonly currentLimitA: number;
  readonly ovpV: number;
  readonly ocpDelaySeconds?: number;
  readonly includeOutputOn?: boolean;
}): readonly PsuProgramStep[] {
  within('voltageV', options.voltageV, 0, N6752A_VOLTAGE_MAX_V);
  within('currentLimitA', options.currentLimitA, 0, N6752A_CURRENT_MAX_A);
  within('ovpV', options.ovpV, 0, N6752A_OVP_MAX_V);
  const envelopeCurrentA = getN6752aMaximumCurrentAtVoltage(options.voltageV);
  if (options.currentLimitA > envelopeCurrentA) {
    throw new RangeError(
      `currentLimitA exceeds the N6752A 100 W envelope at ${options.voltageV} V; maximum is ${envelopeCurrentA} A.`,
    );
  }
  if (options.voltageV >= options.ovpV) throw new RangeError('ovpV must be above the voltage setpoint.');
  const delay = options.ocpDelaySeconds ?? 0.02;
  if (!Number.isFinite(delay) || delay < 0 || delay > 0.255) {
    throw new RangeError('ocpDelaySeconds must be within 0 to 0.255.');
  }
  const steps: PsuProgramStep[] = [
    { phase: 'identify', message: '*IDN?', operation: 'query' },
    { phase: 'identify', message: 'SYST:CHAN:MOD? (@1)', operation: 'query' },
    { phase: 'identify', message: 'SYST:CHAN:OPT? (@1)', operation: 'query' },
    { phase: 'safe-off', message: 'OUTP OFF,(@1)', operation: 'write' },
    { phase: 'verify', message: '*OPC?', operation: 'query' },
    { phase: 'configure', message: `VOLT ${options.voltageV},(@1)`, operation: 'write' },
    { phase: 'configure', message: `CURR ${options.currentLimitA},(@1)`, operation: 'write' },
    { phase: 'configure', message: `VOLT:PROT ${options.ovpV},(@1)`, operation: 'write' },
    { phase: 'configure', message: `CURR:PROT:DEL ${delay},(@1)`, operation: 'write' },
    { phase: 'configure', message: 'CURR:PROT:STAT ON,(@1)', operation: 'write' },
    { phase: 'verify', message: 'VOLT? (@1)', operation: 'query' },
    { phase: 'verify', message: 'CURR? (@1)', operation: 'query' },
    { phase: 'verify', message: 'VOLT:PROT? (@1)', operation: 'query' },
    { phase: 'verify', message: 'CURR:PROT:STAT? (@1)', operation: 'query' },
    { phase: 'verify', message: 'OUTP? (@1)', operation: 'query' },
    { phase: 'verify', message: 'SYST:ERR?', operation: 'query' },
  ];
  if (options.includeOutputOn) {
    steps.push(
      { phase: 'enable', message: 'OUTP ON,(@1)', operation: 'write' },
      { phase: 'verify', message: '*OPC?', operation: 'query' },
      { phase: 'verify', message: 'OUTP? (@1)', operation: 'query' },
      { phase: 'verify', message: 'STAT:OPER:COND? (@1)', operation: 'query' },
      { phase: 'verify', message: 'SYST:ERR?', operation: 'query' },
    );
  }
  steps.push(
    { phase: 'cleanup', message: 'OUTP OFF,(@1)', operation: 'write' },
    { phase: 'cleanup', message: 'ABOR:TRAN (@1)', operation: 'write' },
    { phase: 'cleanup', message: 'ABOR:ACQ (@1)', operation: 'write' },
  );
  return Object.freeze(steps);
}

export interface PsuMockState {
  readonly voltageSetpointV: number;
  readonly currentLimitA: number;
  readonly ovpLevelV: number;
  readonly ocpEnabled: boolean;
  readonly ocpDelaySeconds: number;
  readonly slewVPerSecond: number;
  readonly outputEnabled: boolean;
  readonly listVoltagesV: readonly number[];
  readonly listDwellSeconds: readonly number[];
  readonly transientArmed: boolean;
  readonly errors: readonly string[];
  readonly identityVerified: boolean;
  readonly moduleVerified: boolean;
  readonly optionVerified: boolean;
  readonly outputOffVerified: boolean;
  readonly voltageQueryBackVerified: boolean;
  readonly currentQueryBackVerified: boolean;
  readonly ovpQueryBackVerified: boolean;
  readonly ocpQueryBackVerified: boolean;
  readonly errorQueueVerified: boolean;
  readonly errorSeenSinceClear: boolean;
}

export interface PsuMockCommandResult {
  readonly state: PsuMockState;
  readonly response: string | null;
}

export interface PsuMockCommandContext {
  /** One-shot application permission. It is deliberately not stored in instrument state. */
  readonly outputEnablePermit?: boolean;
}

export function createN6705cMockState(): PsuMockState {
  return {
    voltageSetpointV: 0,
    currentLimitA: 0.1,
    ovpLevelV: 55,
    ocpEnabled: false,
    ocpDelaySeconds: 0.02,
    slewVPerSecond: 9.9e37,
    outputEnabled: false,
    listVoltagesV: [],
    listDwellSeconds: [],
    transientArmed: false,
    errors: [],
    identityVerified: false,
    moduleVerified: false,
    optionVerified: false,
    outputOffVerified: false,
    voltageQueryBackVerified: false,
    currentQueryBackVerified: false,
    ovpQueryBackVerified: false,
    ocpQueryBackVerified: false,
    errorQueueVerified: false,
    errorSeenSinceClear: false,
  };
}

function normalizeProgramMessage(message: string): string {
  return message.trim().replace(/\s*,?\s*\(@1\)\s*$/i, '').trim();
}

function parseBoolean(value: string): boolean | null {
  if (/^(?:ON|1)$/i.test(value)) return true;
  if (/^(?:OFF|0)$/i.test(value)) return false;
  return null;
}

function withMockError(state: PsuMockState, message: string): PsuMockState {
  return {
    ...state,
    errors: [...state.errors, message],
    errorQueueVerified: false,
    errorSeenSinceClear: true,
  };
}

function afterMockWrite(
  state: PsuMockState,
  changes: Partial<PsuMockState> = {},
): PsuMockState {
  return { ...state, ...changes, errorQueueVerified: false };
}

function getOutputEnableBlockReason(
  state: PsuMockState,
  context: PsuMockCommandContext,
): string | null {
  if (!context.outputEnablePermit) return 'explicit application permit missing';
  if (!state.identityVerified || !state.moduleVerified || !state.optionVerified) {
    return 'identity, slot-1 N6752A and Option 761 not verified';
  }
  if (!state.outputOffVerified) return 'output OFF query-back missing';
  if (
    !state.voltageQueryBackVerified
    || !state.currentQueryBackVerified
    || !state.ovpQueryBackVerified
    || !state.ocpQueryBackVerified
  ) {
    return 'voltage, current, OVP and OCP query-back incomplete';
  }
  if (!state.ocpEnabled) return 'OCP is not enabled';
  if (state.voltageSetpointV >= state.ovpLevelV) return 'OVP must be above the voltage setpoint';
  if (state.voltageSetpointV * state.currentLimitA > N6752A_POWER_MAX_W) {
    return 'V × I limit exceeds the 100 W envelope';
  }
  if (state.errors.length > 0 || state.errorSeenSinceClear || !state.errorQueueVerified) {
    return 'error queue has not been verified clean';
  }
  return null;
}

export function executeN6705cMockCommand(
  state: PsuMockState,
  programMessage: string,
  context: PsuMockCommandContext = {},
): PsuMockCommandResult {
  if (programMessage.includes(';')) {
    return { state: withMockError(state, '-102,"Syntax error; one command per line"'), response: null };
  }
  const command = normalizeProgramMessage(programMessage);
  const upper = command.toUpperCase();
  if (upper === '*IDN?') return {
    state: { ...state, identityVerified: true },
    response: 'Keysight Technologies,N6705C,MY00000000,E.02.09.3271',
  };
  if (upper === '*OPT?') return { state, response: '0' };
  if (upper === 'SYST:CHAN:MOD?') return {
    state: { ...state, moduleVerified: true },
    response: 'N6752A',
  };
  if (upper === 'SYST:CHAN:OPT?') return {
    state: { ...state, optionVerified: true },
    response: '761',
  };
  if (upper === '*OPC?') return { state, response: '1' };
  if (upper === '*CLS') return {
    state: afterMockWrite(state, { errors: [], errorSeenSinceClear: false }),
    response: null,
  };
  if (upper === 'SYST:ERR?') {
    const [first, ...rest] = state.errors;
    if (first) {
      return {
        state: {
          ...state,
          errors: rest,
          errorQueueVerified: false,
          errorSeenSinceClear: true,
        },
        response: first,
      };
    }
    return {
      state: {
        ...state,
        errorQueueVerified: !state.errorSeenSinceClear,
      },
      response: '+0,"No error"',
    };
  }
  if (upper === 'OUTP?') return {
    state: { ...state, outputOffVerified: !state.outputEnabled },
    response: state.outputEnabled ? '1' : '0',
  };
  if (/^OUTP\s+/.test(upper)) {
    const next = parseBoolean(command.split(/\s+/, 2)[1] ?? '');
    if (next === null) return { state: withMockError(state, '-222,"Data out of range"'), response: null };
    if (!next) {
      return {
        state: afterMockWrite(state, { outputEnabled: false, outputOffVerified: false }),
        response: null,
      };
    }
    const blocked = getOutputEnableBlockReason(state, context);
    if (blocked) {
      return {
        state: withMockError(state, `-221,"Output enable blocked: ${blocked}"`),
        response: null,
      };
    }
    return {
      state: afterMockWrite(state, { outputEnabled: true, outputOffVerified: false }),
      response: null,
    };
  }
  if (upper === 'VOLT?') return {
    state: { ...state, voltageQueryBackVerified: true },
    response: state.voltageSetpointV.toFixed(6),
  };
  if (upper === 'CURR?') return {
    state: { ...state, currentQueryBackVerified: true },
    response: state.currentLimitA.toFixed(6),
  };
  if (upper === 'VOLT:PROT?') return {
    state: { ...state, ovpQueryBackVerified: true },
    response: state.ovpLevelV.toFixed(6),
  };
  if (upper === 'CURR:PROT:STAT?') return {
    state: { ...state, ocpQueryBackVerified: true },
    response: state.ocpEnabled ? '1' : '0',
  };
  if (upper === 'CURR:PROT:DEL?') return { state, response: state.ocpDelaySeconds.toFixed(6) };
  if (upper === 'VOLT:SLEW?') return { state, response: state.slewVPerSecond.toExponential(6) };
  if (upper === 'STAT:OPER:COND?') return { state, response: state.outputEnabled ? '1' : '4' };
  if (/^(?:ABOR:TRAN|ABORT:TRANSIENT|ABOR:ACQ|ABORT:ACQUIRE)/.test(upper)) {
    return { state: afterMockWrite(state, { transientArmed: false }), response: null };
  }
  if (/^INIT:TRAN/.test(upper)) {
    return { state: afterMockWrite(state, { transientArmed: true }), response: null };
  }
  if (upper === '*TRG') {
    if (!state.transientArmed) {
      return { state: withMockError(state, '-211,"Trigger ignored"'), response: null };
    }
    const voltageSetpointV = state.listVoltagesV[0] ?? state.voltageSetpointV;
    return {
      state: afterMockWrite(state, {
        voltageSetpointV,
        transientArmed: false,
        voltageQueryBackVerified: false,
      }),
      response: null,
    };
  }

  const scalarWrite = command.match(/^(VOLT(?::PROT)?|CURR(?::PROT:DEL)?|VOLT:SLEW)\s+(.+)$/i);
  if (scalarWrite) {
    const [, scalarHeader, scalarRawValue] = scalarWrite;
    if (!scalarHeader || !scalarRawValue) {
      return { state: withMockError(state, '-113,"Undefined header"'), response: null };
    }
    const value = Number(scalarRawValue);
    if (!Number.isFinite(value)) return { state: withMockError(state, '-128,"Numeric data error"'), response: null };
    try {
      switch (scalarHeader.toUpperCase()) {
        case 'VOLT':
          within('VOLT', value, 0, N6752A_VOLTAGE_MAX_V);
          return {
            state: afterMockWrite(state, {
              voltageSetpointV: value,
              voltageQueryBackVerified: false,
            }),
            response: null,
          };
        case 'CURR':
          within('CURR', value, 0, N6752A_CURRENT_MAX_A);
          return {
            state: afterMockWrite(state, {
              currentLimitA: value,
              currentQueryBackVerified: false,
            }),
            response: null,
          };
        case 'VOLT:PROT':
          within('VOLT:PROT', value, 0, N6752A_OVP_MAX_V);
          return {
            state: afterMockWrite(state, {
              ovpLevelV: value,
              ovpQueryBackVerified: false,
            }),
            response: null,
          };
        case 'CURR:PROT:DEL':
          within('CURR:PROT:DEL', value, 0, 0.255);
          return {
            state: afterMockWrite(state, { ocpDelaySeconds: value }),
            response: null,
          };
        case 'VOLT:SLEW':
          if (value <= 0) throw new RangeError('slew');
          return {
            state: afterMockWrite(state, { slewVPerSecond: value }),
            response: null,
          };
      }
    } catch {
      return { state: withMockError(state, '-222,"Data out of range"'), response: null };
    }
  }
  const ocpWrite = command.match(/^CURR:PROT:STAT\s+(.+)$/i);
  if (ocpWrite) {
    const [, ocpRawValue] = ocpWrite;
    if (!ocpRawValue) return { state: withMockError(state, '-222,"Data out of range"'), response: null };
    const value = parseBoolean(ocpRawValue);
    if (value === null) return { state: withMockError(state, '-222,"Data out of range"'), response: null };
    return {
      state: afterMockWrite(state, { ocpEnabled: value, ocpQueryBackVerified: false }),
      response: null,
    };
  }
  const listWrite = command.match(/^LIST:(VOLT|DWEL)\s+(.+)$/i);
  if (listWrite) {
    const [, listHeader, listRawValues] = listWrite;
    if (!listHeader || !listRawValues) {
      return { state: withMockError(state, '-113,"Undefined header"'), response: null };
    }
    const values = listRawValues.split(',').map(Number);
    if (values.some((value) => !Number.isFinite(value)) || values.length > N6752A_LIST_MAX_STEPS) {
      return { state: withMockError(state, '-222,"List data out of range"'), response: null };
    }
    if (listHeader.toUpperCase() === 'VOLT') {
      if (values.some((value) => value < 0 || value > N6752A_VOLTAGE_MAX_V)) {
        return { state: withMockError(state, '-222,"List voltage out of range"'), response: null };
      }
      return { state: afterMockWrite(state, { listVoltagesV: values }), response: null };
    }
    if (values.some((value) => value < 0 || value > N6752A_LIST_MAX_DWELL_S)) {
      return { state: withMockError(state, '-222,"List dwell out of range"'), response: null };
    }
    return { state: afterMockWrite(state, { listDwellSeconds: values }), response: null };
  }
  if (/^(?:VOLT|CURR):MODE\s+(?:FIX|FIXED|STEP|LIST)$/i.test(command)) {
    return { state: afterMockWrite(state), response: null };
  }
  if (/^TRIG:TRAN:SOUR\s+(?:BUS|EXT|EXTERNAL|IMM|IMMEDIATE)$/i.test(command)) {
    return { state: afterMockWrite(state), response: null };
  }
  return { state: withMockError(state, '-113,"Undefined header"'), response: null };
}
