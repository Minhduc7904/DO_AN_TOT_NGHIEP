export class EnrollmentConflictError extends Error {
  constructor(
    readonly principalId: string,
    readonly courseId: string,
  ) {
    super('Đã enroll course này');
  }
}
