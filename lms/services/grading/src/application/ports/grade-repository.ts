import type { Grade } from '../../domain/grade.js';

export interface CreateGradeRecord {
  id: string;
  eventId: string;
  submissionId: string;
  principalId: string;
  courseId: string;
  score: number;
}

export abstract class GradeRepository {
  abstract create(input: CreateGradeRecord): Promise<Grade>;
  abstract findById(id: string): Promise<Grade | null>;
}
