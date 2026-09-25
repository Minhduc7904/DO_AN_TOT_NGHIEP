export abstract class EnrollmentClient {
  abstract isEnrolled(principalId: string, courseId: string): Promise<boolean>;
}
