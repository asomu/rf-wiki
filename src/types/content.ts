export interface Reference {
  readonly title: string;
  readonly url: string;
  readonly organization: string;
  readonly release?: string;
}

export interface ConceptLinks {
  readonly prerequisites: readonly string[];
  readonly related: readonly string[];
  readonly next: readonly string[];
}

export interface EquipmentContext {
  readonly instrumentFamily: string;
  readonly application?: string;
  readonly terminologyNotes: readonly string[];
  readonly referencePlane: string;
  readonly limitations: readonly string[];
}

export interface LessonMeta {
  readonly slug: string;
  readonly title: string;
  readonly question: string;
  readonly module: string;
  readonly order: number;
  readonly estimatedMinutes: number;
  readonly concepts: ConceptLinks;
  readonly references: readonly Reference[];
  readonly equipment?: EquipmentContext;
}
