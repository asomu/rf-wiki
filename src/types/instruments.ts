import type { Complex } from './rf';
import type { DBm, Decibels, Hertz, Seconds } from './units';

export type InstrumentKind =
  | 'signal-generator'
  | 'signal-analyzer'
  | 'network-analyzer'
  | 'power-sensor'
  | 'power-supply';

export type InstrumentProfileId =
  | 'keysight-n5182b'
  | 'keysight-n9020b'
  | 'keysight-e5080b'
  | 'keysight-u2061xa'
  | 'keysight-n6705c';

export interface InstrumentReference {
  readonly title: string;
  readonly organization: string;
  readonly url: string;
  readonly documentNumber: string;
  /** Keysight website asset identifier when it differs from the publication number. */
  readonly assetId?: string;
  readonly revision: string;
  readonly section: string;
}

interface InstrumentProfileBase {
  readonly vendor: 'Keysight Technologies';
  readonly firmwareScope: string;
  readonly supportedOptions: readonly string[];
  readonly references: readonly InstrumentReference[];
}

export type InstrumentProfile = InstrumentProfileBase & (
  | {
    readonly id: 'keysight-n5182b';
    readonly kind: 'signal-generator';
    readonly family: 'MXG X-Series';
    readonly model: 'N5182B';
  }
  | {
    readonly id: 'keysight-e5080b';
    readonly kind: 'network-analyzer';
    readonly family: 'ENA Series';
    readonly model: 'E5080B';
  }
  | {
    readonly id: 'keysight-n9020b';
    readonly kind: 'signal-analyzer';
    readonly family: 'MXA X-Series';
    readonly model: 'N9020B';
  }
  | {
    readonly id: 'keysight-u2061xa';
    readonly kind: 'power-sensor';
    readonly family: 'U/L2050/60 X-Series';
    readonly model: 'U2061XA';
  }
  | {
    readonly id: 'keysight-n6705c';
    readonly kind: 'power-supply';
    readonly family: 'N6700 Modular Power System';
    readonly model: 'N6705C + N6752A';
  }
);

export type InstrumentFamily = InstrumentProfile['family'];
export type InstrumentModel = InstrumentProfile['model'];
export type InstrumentScpiForm = 'write' | 'query';
export type InstrumentScpiSafetyClass =
  | 'identity'
  | 'configuration'
  | 'calibration'
  | 'measurement'
  | 'acquisition'
  | 'safety'
  | 'queue';

/**
 * Shared provenance contract for the small, deterministic SCPI subsets used
 * by the browser simulators. It documents applicability; it is not a claim
 * that the Wiki implements the instrument's complete command tree.
 */
export interface InstrumentScpiCommandDefinition {
  readonly id: string;
  readonly longForm: string;
  readonly shortForm: string;
  readonly forms: readonly InstrumentScpiForm[];
  readonly stateEffect: string;
  readonly safetyClass: InstrumentScpiSafetyClass;
  readonly supportedModels: readonly InstrumentModel[];
  readonly firmwareScope: string;
  readonly optionScope: string;
  readonly source: InstrumentReference;
}

export type MxgCommandId =
  | 'identify'
  | 'options'
  | 'clear-status'
  | 'operation-complete'
  | 'reset'
  | 'system-error-next'
  | 'frequency-cw'
  | 'power-amplitude'
  | 'rf-output'
  | 'modulation-output'
  | 'arb-waveform'
  | 'arb-sample-clock'
  | 'arb-runtime-scaling'
  | 'arb-trigger-source'
  | 'arb-state'
  | 'waveform-data';

export type ScpiOperation = 'write' | 'query' | 'both';
export type ScpiSafetyClass = 'read-only' | 'configuration' | 'rf-enable';
export type ScpiCompletion = 'immediate' | 'overlapped';
export type ScpiMockSupport = 'session' | 'encoding-only';

export interface ScpiParameterSpec {
  readonly name: string;
  readonly kind: 'boolean' | 'frequency' | 'power' | 'percentage' | 'string' | 'binary-block';
  readonly unit?: 'Hz' | 'dBm' | '%';
  readonly values?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly note?: string;
}

export interface ScpiResponseSpec {
  readonly kind: 'string' | 'numeric' | 'boolean' | 'error-record';
  readonly unit?: 'Hz' | 'dBm' | '%';
  readonly note?: string;
}

export interface ScpiCommandDefinition {
  readonly id: MxgCommandId;
  readonly canonical: string;
  readonly short: string;
  readonly operation: ScpiOperation;
  readonly parameters: readonly ScpiParameterSpec[];
  readonly response?: ScpiResponseSpec;
  readonly stateEffects: readonly string[];
  readonly safety: ScpiSafetyClass;
  readonly completion: ScpiCompletion;
  readonly mockSupport: ScpiMockSupport;
  readonly supportedModels: readonly ['N5182B'];
  readonly requiredAnyOfOptions: readonly string[];
  readonly source: InstrumentReference;
}

export type ScpiProgramPhase =
  | 'connect'
  | 'safe-state'
  | 'configure'
  | 'verify'
  | 'synchronize'
  | 'rf-enable'
  | 'cleanup';

export interface ScpiProgramStep {
  readonly id: string;
  readonly phase: ScpiProgramPhase;
  readonly operation: 'write' | 'query' | 'binary-write' | 'host-action';
  readonly commandId: MxgCommandId | null;
  readonly message: string;
  readonly purpose: string;
  readonly safety: ScpiSafetyClass;
  /**
   * Optional bounded-query contract for queue drains. The caller repeats the
   * query no more than `maximumQueries` times and stops only after the parsed
   * response code equals `untilResponseCode`.
   */
  readonly repeatQueryUntil?: {
    readonly maximumQueries: number;
    readonly untilResponseCode: number;
  };
}

export interface ScpiError {
  readonly code: number;
  readonly message: string;
}

export interface PendingOperation {
  readonly id: number;
  readonly kind: 'reset' | 'waveform-select' | 'waveform-upload';
  readonly description: string;
}

export interface ScpiTranscriptEntry {
  readonly index: number;
  readonly direction: 'write' | 'read';
  readonly message: string;
  readonly commandId: MxgCommandId | null;
  readonly outcome: 'accepted' | 'response' | 'error' | 'would-time-out';
  /** The error raised by this exact command, retained after the queue is drained. */
  readonly error: ScpiError | null;
}

export interface ParsedScpiCommand {
  readonly commandId: MxgCommandId;
  readonly form: 'write' | 'query';
  readonly raw: string;
  readonly argument: string | null;
}

export type ScpiParseResult =
  | { readonly ok: true; readonly command: ParsedScpiCommand }
  | { readonly ok: false; readonly error: ScpiError };

export interface MxgWaveformRecord {
  readonly id: string;
  readonly memoryPath: string;
  readonly sampleCount: number;
  readonly sampleRateHz: Hertz;
  readonly durationSeconds: Seconds;
  readonly peakEnvelope: number;
  readonly rmsEnvelope: number;
  readonly crestFactorDb: number | null;
  readonly byteLength: number;
}

export type MxgArbTriggerSource = 'KEY' | 'EXT' | 'BUS';

export interface MxgState {
  readonly frequencyHz: Hertz;
  readonly powerDbm: DBm;
  readonly rfOutputEnabled: boolean;
  readonly modulationEnabled: boolean;
  readonly arbEnabled: boolean;
  readonly selectedWaveformPath: string | null;
  readonly arbSampleClockRateHz: Hertz;
  readonly arbRuntimeScalingPercent: number;
  readonly arbTriggerSource: MxgArbTriggerSource;
  /** Test-program intent used by the PA safety model; not an N5182B SCPI state. */
  readonly plannedDutyCyclePercent: number;
  readonly waveformMemory: readonly MxgWaveformRecord[];
}

export interface PaSafetyEnvelope {
  readonly dutMaxInputDbm: DBm;
  /** Signed aggregate gain from the MXG RF connector to the DUT input plane. */
  readonly sourceToDutGainDb: Decibels;
  /** Positive worst-case uncertainty applied to the source-to-DUT path estimate. */
  readonly pathUncertaintyDb: Decibels;
  readonly guardMarginDb: Decibels;
  readonly maximumDutyCyclePercent: number;
  readonly requireRfOffForStimulusChange: boolean;
}

export interface PaSafetyDecision {
  readonly allowed: boolean;
  /** Conservative peak estimate at the DUT input plane. */
  readonly estimatedDutInputDbm: DBm;
  /** Average estimate before waveform crest factor and path uncertainty are added. */
  readonly estimatedDutAverageDbm: DBm;
  readonly waveformCrestFactorDb: Decibels;
  readonly permittedDutInputDbm: DBm;
  readonly headroomDb: Decibels;
  readonly reasons: readonly string[];
}

export interface PaPowerBudgetInput {
  /** Average RF power at the MXG RF connector. */
  readonly sourceAveragePowerDbm: DBm;
  /** Positive waveform peak-to-average ratio used for the physical peak estimate. */
  readonly waveformCrestFactorDb: Decibels;
  readonly envelope: PaSafetyEnvelope;
}

export interface MxgSession {
  readonly profile: InstrumentProfile;
  readonly installedOptions: readonly string[];
  readonly instrumentState: MxgState;
  readonly outputQueue: readonly string[];
  readonly errorQueue: readonly ScpiError[];
  readonly pendingOperations: readonly PendingOperation[];
  readonly transcript: readonly ScpiTranscriptEntry[];
  readonly safetyEnvelope: PaSafetyEnvelope | null;
}

export interface ScpiReadResult {
  readonly session: MxgSession;
  readonly status: 'response' | 'would-time-out';
  readonly response: string | null;
}

export interface ScpiQueryResult extends ScpiReadResult {}

export interface IqWaveformAsset {
  readonly id: string;
  readonly name: string;
  readonly sampleRateHz: Hertz;
  readonly samples: readonly Complex[];
  readonly normalization: 'none' | 'peak-component';
  readonly playback: 'continuous' | 'single';
}

export interface IqWaveformMetrics {
  readonly sampleCount: number;
  readonly sampleRateHz: Hertz;
  readonly durationSeconds: Seconds;
  readonly peakComponent: number;
  readonly peakEnvelope: number;
  readonly rmsEnvelope: number;
  readonly crestFactorDb: number | null;
}

export interface EncodedIqWaveform {
  readonly payload: Uint8Array;
  readonly metrics: IqWaveformMetrics;
  readonly scaleApplied: number;
  readonly byteOrder: 'big-endian';
  readonly encoding: 'signed-int16-interleaved-iq';
}

export interface WaveformTransfer {
  readonly memoryPath: string;
  readonly payload: Uint8Array;
  readonly definiteBlock: Uint8Array;
  readonly message: Uint8Array;
}
