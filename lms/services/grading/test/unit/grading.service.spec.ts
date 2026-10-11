import { GradeConflictError } from '../../src/application/grade-conflict-error.js';
import { GradeEventPendingError } from '../../src/application/grade-event-pending-error.js';
import { GradeEventPublishError } from '../../src/application/grade-event-publish-error.js';
import { GradePublicationCoordinator } from '../../src/application/grade-publication.coordinator.js';
import { GradeForbiddenError } from '../../src/application/grade-forbidden-error.js';
import { GradeNotFoundError } from '../../src/application/grade-not-found-error.js';
import { GradingDependencyError } from '../../src/application/grading-dependency-error.js';
import type { GradingPrincipal } from '../../src/application/grading-principal.js';
import { GradingService } from '../../src/application/grading.service.js';
import type {
  CreateGradeRecord,
  GradeRepository,
} from '../../src/application/ports/grade-repository.js';
import type { GradeCompletedSnapshot } from '../../src/domain/grade-completed-snapshot.js';
import type {
  SubmissionClient,
  SubmissionSummary,
} from '../../src/application/ports/submission-client.js';
import { SubmissionNotFoundError } from '../../src/application/submission-not-found-error.js';
import type { Grade } from '../../src/domain/grade.js';

describe('GradingService', () => {
  const instructor: GradingPrincipal = { id: 'instructor-001', role: 'instructor' };
  const owner: GradingPrincipal = { id: 'student-001', role: 'student' };
  const otherStudent: GradingPrincipal = { id: 'student-002', role: 'student' };
  const submission: SubmissionSummary = {
    course_id: 'course-001',
    id: 'submission-001',
    principal_id: 'student-001',
  };
  let grades: Grade[];
  let submissions: SubmissionSummary[];
  let submissionLookups: string[];
  let submissionFailure: GradingDependencyError | undefined;
  let eventIds: string[];
  let published: GradeCompletedSnapshot[];
  let publishFailure: Error | undefined;
  let service: GradingService;

  beforeEach(() => {
    grades = [];
    submissions = [submission];
    submissionLookups = [];
    submissionFailure = undefined;
    eventIds = [];
    published = [];
    publishFailure = undefined;
    const repository: GradeRepository = {
      create: async (input: CreateGradeRecord) => {
        if (grades.some((grade) => grade.submission_id === input.submissionId)) {
          throw new GradeConflictError(input.submissionId);
        }
        eventIds.push(input.eventId);
        const grade: Grade = {
          completed_at: '2026-10-08T00:00:00.000Z',
          course_id: input.courseId,
          id: input.id,
          principal_id: input.principalId,
          score: input.score,
          submission_id: input.submissionId,
        };
        grades.push(grade);
        return grade;
      },
      findById: async (id) => grades.find((grade) => grade.id === id) ?? null,
    };
    const submissionClient: SubmissionClient = {
      getById: async (id) => {
        submissionLookups.push(id);
        if (submissionFailure) throw submissionFailure;
        return submissions.find((item) => item.id === id) ?? null;
      },
    };
    const publication = new GradePublicationCoordinator(
      {
        countPending: async () => 0,
        findPending: async () => [],
        markFailed: async () => undefined,
        markPublished: async () => undefined,
        recordAttempt: async () => true,
      },
      {
        publish: async (snapshot) => {
          if (publishFailure) throw publishFailure;
          published.push(snapshot);
        },
      },
    );
    service = new GradingService(repository, submissionClient, publication);
  });

  it('creates a grade for an existing Submission with a snapshot of its owner and course', async () => {
    const grade = await service.create(instructor, 'submission-001', 92.5);

    expect(grade).toMatchObject({
      course_id: 'course-001',
      principal_id: 'student-001',
      score: 92.5,
      submission_id: 'submission-001',
    });
    expect(grade.id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(submissionLookups).toEqual(['submission-001']);
  });

  it('publishes one event snapshot whose event_id is the one stored with the grade', async () => {
    const grade = await service.create(instructor, 'submission-001', 92.5);

    expect(eventIds).toHaveLength(1);
    expect(eventIds[0]).toMatch(/^[0-9a-f-]{36}$/u);
    expect(published).toEqual([
      {
        completedAt: grade.completed_at,
        courseId: 'course-001',
        eventId: eventIds[0],
        gradeId: grade.id,
        principalId: 'student-001',
        score: 92.5,
        submissionId: 'submission-001',
      },
    ]);
  });

  it('keeps the grade and reports a pending event when publishing fails', async () => {
    publishFailure = new GradeEventPublishError('PUBLISH_TIMEOUT');

    const failure = await service.create(instructor, 'submission-001', 90).catch((error) => error);

    expect(failure).toBeInstanceOf(GradeEventPendingError);
    expect(failure).toMatchObject({ eventId: eventIds[0], reason: 'PUBLISH_TIMEOUT' });
    expect(grades).toHaveLength(1);
    expect(failure.gradeId).toBe(grades[0]?.id);
    await expect(service.create(instructor, 'submission-001', 90)).rejects.toBeInstanceOf(
      GradeConflictError,
    );
    expect(grades).toHaveLength(1);
  });

  it('rejects a student before calling Submission or persisting', async () => {
    await expect(service.create(owner, 'submission-001', 90)).rejects.toBeInstanceOf(
      GradeForbiddenError,
    );
    expect(submissionLookups).toEqual([]);
    expect(grades).toEqual([]);
  });

  it('rejects a missing Submission without persisting', async () => {
    await expect(service.create(instructor, 'missing', 90)).rejects.toBeInstanceOf(
      SubmissionNotFoundError,
    );
    expect(grades).toEqual([]);
  });

  it.each(['timeout', 'unavailable'] as const)(
    'propagates a Submission %s without persisting',
    async (kind) => {
      submissionFailure = new GradingDependencyError('grading-submission', kind);

      await expect(service.create(instructor, 'submission-001', 90)).rejects.toBe(
        submissionFailure,
      );
      expect(grades).toEqual([]);
    },
  );

  it('rejects a second grade for the same Submission', async () => {
    await service.create(instructor, 'submission-001', 90);

    await expect(service.create(instructor, 'submission-001', 70)).rejects.toBeInstanceOf(
      GradeConflictError,
    );
    expect(grades).toHaveLength(1);
    expect(grades[0]?.score).toBe(90);
  });

  it('lets the owning student and any instructor read a grade', async () => {
    const created = await service.create(instructor, 'submission-001', 90);

    await expect(service.getById(owner, created.id)).resolves.toEqual(created);
    await expect(
      service.getById({ id: 'instructor-002', role: 'instructor' }, created.id),
    ).resolves.toEqual(created);
  });

  it("forbids a student from reading another student's grade", async () => {
    const created = await service.create(instructor, 'submission-001', 90);

    await expect(service.getById(otherStudent, created.id)).rejects.toBeInstanceOf(
      GradeForbiddenError,
    );
  });

  it('reports a missing grade as not found', async () => {
    await expect(service.getById(instructor, 'missing')).rejects.toBeInstanceOf(GradeNotFoundError);
  });
});
