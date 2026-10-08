export interface SubmissionSummary {
  id: string;
  principal_id: string;
  course_id: string;
}

export abstract class SubmissionClient {
  abstract getById(submissionId: string): Promise<SubmissionSummary | null>;
}
