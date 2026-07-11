export interface LessonPublicationState {
  readonly status: 'draft' | 'ready';
}

export function isPublishedLesson(data: LessonPublicationState): boolean {
  return data.status === 'ready';
}
