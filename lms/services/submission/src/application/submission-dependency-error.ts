export type SubmissionDependency =
  'submission-course' | 'submission-enrollment' | 'submission-storage' | 'submission-postgres';

export class SubmissionDependencyError extends Error {
  constructor(
    readonly dependency: SubmissionDependency,
    readonly kind: 'timeout' | 'unavailable',
  ) {
    super(`${dependency} ${kind}`);
  }
}
