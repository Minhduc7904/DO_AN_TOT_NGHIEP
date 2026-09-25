import type { Submission } from '../../domain/submission.js';

export interface CreateSubmissionRecord {
  id: string;
  principalId: string;
  courseId: string;
  storageObjectKey: string;
}

export abstract class SubmissionRepository {
  abstract create(input: CreateSubmissionRecord): Promise<Submission>;
  abstract findById(id: string): Promise<Submission | null>;
}
