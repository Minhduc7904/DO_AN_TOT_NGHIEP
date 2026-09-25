export class SubmissionNotFoundError extends Error {
  constructor(readonly submissionId: string) {
    super('Không tìm thấy submission');
  }
}
