import { randomUUID } from 'node:crypto';

import type { Grade } from '../domain/grade.js';
import { GradeForbiddenError } from './grade-forbidden-error.js';
import { GradeNotFoundError } from './grade-not-found-error.js';
import type { GradingPrincipal } from './grading-principal.js';
import { GradeRepository } from './ports/grade-repository.js';
import { SubmissionClient } from './ports/submission-client.js';
import { SubmissionNotFoundError } from './submission-not-found-error.js';

export class GradingService {
  constructor(
    private readonly repository: GradeRepository,
    private readonly submissionClient: SubmissionClient,
  ) {}

  async create(principal: GradingPrincipal, submissionId: string, score: number): Promise<Grade> {
    if (principal.role !== 'instructor') throw new GradeForbiddenError();
    const submission = await this.submissionClient.getById(submissionId);
    if (!submission) throw new SubmissionNotFoundError(submissionId);

    // principal_id và course_id là snapshot từ Submission, không phải principal của instructor.
    return this.repository.create({
      courseId: submission.course_id,
      id: randomUUID(),
      principalId: submission.principal_id,
      score,
      submissionId: submission.id,
    });
  }

  async getById(principal: GradingPrincipal, id: string): Promise<Grade> {
    const grade = await this.repository.findById(id);
    if (!grade) throw new GradeNotFoundError(id);
    if (principal.role === 'student' && grade.principal_id !== principal.id) {
      throw new GradeForbiddenError();
    }
    return grade;
  }
}
