export class SubmissionNotFoundError extends Error {
  constructor(readonly submissionId: string) {
    super('Submission không tồn tại');
  }
}
