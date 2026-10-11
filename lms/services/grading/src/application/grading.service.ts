import { randomUUID } from 'node:crypto';

import type { Grade } from '../domain/grade.js';
import { GradeEventPendingError } from './grade-event-pending-error.js';
import { GradeEventPublishError } from './grade-event-publish-error.js';
import { GradeForbiddenError } from './grade-forbidden-error.js';
import { GradeNotFoundError } from './grade-not-found-error.js';
import { GradePublicationCoordinator } from './grade-publication.coordinator.js';
import type { GradingPrincipal } from './grading-principal.js';
import { GradeRepository } from './ports/grade-repository.js';
import { SubmissionClient } from './ports/submission-client.js';
import { SubmissionNotFoundError } from './submission-not-found-error.js';

export class GradingService {
  constructor(
    private readonly repository: GradeRepository,
    private readonly submissionClient: SubmissionClient,
    private readonly publication: GradePublicationCoordinator,
  ) {}

  async create(principal: GradingPrincipal, submissionId: string, score: number): Promise<Grade> {
    if (principal.role !== 'instructor') throw new GradeForbiddenError();
    const submission = await this.submissionClient.getById(submissionId);
    if (!submission) throw new SubmissionNotFoundError(submissionId);

    // principal_id và course_id là snapshot từ Submission, không phải principal của instructor.
    // event_id được sinh một lần và lưu cùng grade (trạng thái pending) nên ổn định qua mọi lần retry.
    const eventId = randomUUID();
    const grade = await this.repository.create({
      courseId: submission.course_id,
      eventId,
      id: randomUUID(),
      principalId: submission.principal_id,
      score,
      submissionId: submission.id,
    });
    try {
      await this.publication.publish({
        completedAt: grade.completed_at,
        courseId: grade.course_id,
        eventId,
        gradeId: grade.id,
        principalId: grade.principal_id,
        score: grade.score,
        submissionId: grade.submission_id,
      });
    } catch (error) {
      // Grade đã được lưu ở trạng thái pending; background worker sẽ publish lại với cùng event_id.
      throw new GradeEventPendingError(
        grade.id,
        eventId,
        error instanceof GradeEventPublishError ? error.code : 'UNEXPECTED',
      );
    }
    return grade;
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
