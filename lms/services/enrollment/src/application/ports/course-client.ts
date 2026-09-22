export interface CoursePrincipal {
  id: string;
  role: string;
}

export interface CourseClientContext {
  traceparent?: string;
  tracestate?: string;
}

export abstract class CourseClient {
  abstract exists(
    courseId: string,
    principal: CoursePrincipal,
    context?: CourseClientContext,
  ): Promise<boolean>;
}
