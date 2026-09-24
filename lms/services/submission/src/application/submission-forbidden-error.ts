export class SubmissionForbiddenError extends Error {
  constructor() {
    super('Không được phép truy cập submission này');
  }
}
