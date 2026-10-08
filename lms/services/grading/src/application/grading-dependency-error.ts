export type GradingDependency = 'grading-submission' | 'grading-postgres';

export class GradingDependencyError extends Error {
  constructor(
    readonly dependency: GradingDependency,
    readonly kind: 'timeout' | 'unavailable',
  ) {
    super(`${dependency} ${kind}`);
  }
}
