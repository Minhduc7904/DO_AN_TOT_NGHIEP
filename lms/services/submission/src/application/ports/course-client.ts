export interface SubmissionPrincipal {
  id: string;
  role: 'student' | 'instructor';
}

export abstract class CourseClient {
  abstract exists(courseId: string, principal: SubmissionPrincipal): Promise<boolean>;
}
