export class CourseDependencyError extends Error {
  constructor(
    readonly dependency: 'course-postgres' | 'course-redis',
    readonly kind: 'timeout' | 'unavailable',
  ) {
    super(`${dependency} ${kind}`);
  }
}
