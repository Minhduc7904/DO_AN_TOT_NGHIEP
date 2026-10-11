export class GradeEventPendingError extends Error {
  constructor(
    readonly gradeId: string,
    readonly eventId: string,
    readonly reason: string,
  ) {
    super('Grade đã được lưu nhưng event chưa publish; hệ thống sẽ tự thử lại');
  }
}
