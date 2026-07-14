export type CellularGeneration = 'GSM' | 'LTE' | 'NR';

export type CellularSectionId =
  | 'foundations'
  | 'pamid'
  | 'gsm'
  | 'lte'
  | 'nr'
  | 'diagnostics';

export interface SpecClauseReference {
  readonly specification: string;
  readonly version: string;
  readonly clause: string;
  readonly title: string;
  readonly url: string;
  readonly applicability: string;
  readonly kind: 'normative' | 'conformance' | 'industry-reference' | 'public-overview';
}

export interface CellularLessonMeta {
  readonly slug: string;
  readonly section: CellularSectionId;
  readonly order: number;
  readonly title: string;
  readonly question: string;
  readonly progressId: `cellular:${string}:${string}`;
}

export interface TimeHierarchyLevel {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
  readonly durationSeconds: number;
}

export interface TimeHierarchy {
  readonly generation: CellularGeneration;
  readonly levels: readonly TimeHierarchyLevel[];
}

export interface GsmBurstField {
  readonly id: string;
  readonly label: string;
  readonly symbolPeriods: number;
  readonly role: string;
}

export interface GsmBurstDefinition {
  readonly id: 'normal' | 'access' | 'frequency-correction' | 'synchronization' | 'dummy';
  readonly label: string;
  readonly fields: readonly GsmBurstField[];
  readonly occupiedSymbolPeriods: number;
  readonly guardSymbolPeriods: number;
}

export interface ModulationProfile {
  readonly id: string;
  readonly bitsPerSymbol: number;
  readonly envelopeClass: 'constant-ideal' | 'varying';
  readonly rfSensitivity: string;
}

export interface ResourceAllocationProfile {
  readonly generation: 'LTE' | 'NR';
  readonly channelBandwidthMHz: number;
  readonly subcarrierSpacingKHz: number;
  readonly totalResourceBlocks: number;
  readonly startResourceBlock: number;
  readonly resourceBlockCount: number;
}

export type PamidBlockKind =
  | 'transceiver'
  | 'input-match'
  | 'pa'
  | 'supply'
  | 'filter'
  | 'duplexer'
  | 'coupler'
  | 'switch'
  | 'antenna'
  | 'receiver';

export interface PamidBlock {
  readonly id: string;
  readonly label: string;
  readonly kind: PamidBlockKind;
  readonly role: string;
  readonly controlledBy?: string;
}

export interface PamidTopology {
  readonly id: 'gsm-pa-asm' | 'fdd-pamid' | 'tdd-txm';
  readonly label: string;
  readonly duplex: 'TDMA' | 'FDD' | 'TDD';
  readonly blocks: readonly PamidBlock[];
  readonly txPath: readonly string[];
  readonly rxPath: readonly string[];
}

export interface PamidControlState {
  readonly band: string;
  readonly path: 'TX' | 'RX' | 'IDLE';
  readonly gainMode: 'low' | 'mid' | 'high';
  readonly supplyMode: 'fixed' | 'APT' | 'ET';
  readonly triggerArmed: boolean;
}

export interface RfRequirementExample {
  readonly metric: string;
  readonly condition: string;
  readonly value: number;
  readonly unit: string;
  readonly source: SpecClauseReference;
  readonly normative: boolean;
}

export interface DiagnosticCause {
  readonly stage: 'source' | 'transceiver' | 'pamid' | 'load' | 'fixture' | 'analyzer';
  readonly priority: 1 | 2 | 3;
  readonly hypothesis: string;
}

export interface DiscriminatingMeasurement {
  readonly action: string;
  readonly separates: string;
  readonly expectedEvidence: string;
}

export interface DiagnosticSignature {
  readonly id: string;
  readonly symptom: string;
  readonly observedViews: readonly string[];
  readonly likelyStages: readonly DiagnosticCause[];
  readonly controlChecks: readonly string[];
  readonly discriminatingMeasurements: readonly DiscriminatingMeasurement[];
  readonly falsePositives: readonly string[];
  readonly relatedHrefs: readonly string[];
}
