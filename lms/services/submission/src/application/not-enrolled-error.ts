export class NotEnrolledError extends Error {
  constructor(
    readonly principalId: string,
    readonly courseId: string,
  ) {
    super('Student chưa enroll course này');
  }
}
