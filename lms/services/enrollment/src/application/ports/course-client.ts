export interface CoursePrincipal {
  id: string;
  role: string;
}

export abstract class CourseClient {
  abstract exists(courseId: string, principal: CoursePrincipal): Promise<boolean>;
}
