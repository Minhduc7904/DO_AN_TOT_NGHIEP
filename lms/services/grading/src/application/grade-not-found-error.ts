export class GradeNotFoundError extends Error {
  constructor(readonly gradeId: string) {
    super('Không tìm thấy grade');
  }
}
