export class GradeConflictError extends Error {
  constructor(readonly submissionId: string) {
    super('Submission đã có grade hoàn tất');
  }
}
