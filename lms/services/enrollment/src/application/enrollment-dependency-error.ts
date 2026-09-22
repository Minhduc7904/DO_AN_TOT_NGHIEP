export class EnrollmentDependencyError extends Error {
  constructor(
    readonly dependency: 'enrollment-postgres' | 'enrollment-course',
    readonly kind: 'timeout' | 'unavailable',
  ) {
    super(`${dependency} ${kind}`);
  }
}
