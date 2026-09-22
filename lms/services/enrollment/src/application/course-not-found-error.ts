export class CourseNotFoundError extends Error {
  constructor(readonly courseId: string) {
    super('Course không tồn tại');
  }
}
