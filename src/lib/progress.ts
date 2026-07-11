export const PROGRESS_STORAGE_KEY = 'rf-wiki:v1:progress';

export interface LabCompletion {
  readonly completed: true;
  readonly completedAt?: string;
}

export type LearningProgress = Readonly<Record<string, LabCompletion>>;

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProgressModuleDefinition {
  readonly id: string;
  readonly completionLabIds: readonly string[];
}

export interface ModuleProgressSummary {
  readonly completedModuleIds: readonly string[];
  readonly completedCount: number;
  readonly nextModuleId?: string;
}

function isLabCompletion(value: unknown): value is LabCompletion {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.completed === true && (
    record.completedAt === undefined || typeof record.completedAt === 'string'
  );
}

export function parseLearningProgress(raw: string | null): LearningProgress {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, LabCompletion] => (
        isLabCompletion(entry[1])
      )),
    );
  } catch {
    return {};
  }
}

export function readLearningProgress(storage: Pick<ProgressStorage, 'getItem'>): LearningProgress {
  try {
    return parseLearningProgress(storage.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function isLabComplete(progress: LearningProgress, labId: string): boolean {
  return progress[labId]?.completed === true;
}

export function persistLabCompletion(
  storage: ProgressStorage,
  labId: string,
  completedAt = new Date().toISOString(),
): boolean {
  try {
    const previous = readLearningProgress(storage);
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      ...previous,
      [labId]: { completed: true, completedAt },
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearLabCompletion(storage: ProgressStorage, labId: string): boolean {
  try {
    const previous = { ...readLearningProgress(storage) };
    if (!(labId in previous)) return true;

    delete previous[labId];
    if (Object.keys(previous).length === 0) storage.removeItem(PROGRESS_STORAGE_KEY);
    else storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(previous));
    return true;
  } catch {
    return false;
  }
}

export function summarizeModuleProgress(
  modules: readonly ProgressModuleDefinition[],
  progress: LearningProgress,
): ModuleProgressSummary {
  const completedModuleIds = modules
    .filter((module) => (
      module.completionLabIds.length > 0 &&
      module.completionLabIds.every((labId) => isLabComplete(progress, labId))
    ))
    .map((module) => module.id);
  const completed = new Set(completedModuleIds);
  const nextModuleId = modules.find((module) => !completed.has(module.id))?.id;

  return {
    completedModuleIds,
    completedCount: completedModuleIds.length,
    ...(nextModuleId === undefined ? {} : { nextModuleId }),
  };
}
