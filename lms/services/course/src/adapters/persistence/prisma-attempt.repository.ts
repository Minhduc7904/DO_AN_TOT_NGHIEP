import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { AttemptAnswer, QuizAttempt } from '../../domain/course.js';
import type {
  AttemptRepository,
  AttemptResult,
  NewAttempt,
} from '../../application/ports/attempt-repository.js';
import type { Prisma } from './generated/client.js';
import { isUniqueViolation, observeDb } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

const WITH_ANSWERS = { answers: true } satisfies Prisma.QuizAttemptInclude;

type AttemptRow = Prisma.QuizAttemptGetPayload<{ include: typeof WITH_ANSWERS }>;

function toAttempt(row: AttemptRow): QuizAttempt {
  const byQuestion = new Map<string, string[]>();
  for (const answer of row.answers) {
    byQuestion.set(answer.questionId, [
      ...(byQuestion.get(answer.questionId) ?? []),
      answer.selectedOptionId,
    ]);
  }
  const answers: AttemptAnswer[] = [...byQuestion].map(([questionId, optionIds]) => ({
    questionId,
    optionIds,
  }));
  return {
    id: row.id,
    quizId: row.quizId,
    studentId: row.studentId,
    status: row.status,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    score: row.score?.toNumber() ?? null,
    maxScore: row.maxScore?.toNumber() ?? null,
    answers,
  };
}

@Injectable()
export class PrismaAttemptRepository implements AttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInProgress(quizId: string, studentId: string): Promise<QuizAttempt | null> {
    return observeDb('quiz-attempt.find-in-progress', async () => {
      const row = await this.prisma.quizAttempt.findFirst({
        where: { quizId, studentId, status: 'IN_PROGRESS' },
        include: WITH_ANSWERS,
      });
      return row ? toAttempt(row) : null;
    });
  }

  create(attempt: NewAttempt): Promise<QuizAttempt | null> {
    return observeDb('quiz-attempt.create', async () => {
      try {
        return toAttempt(
          await this.prisma.quizAttempt.create({ data: attempt, include: WITH_ANSWERS }),
        );
      } catch (error) {
        // Partial unique index `quiz_attempts_one_in_progress`.
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  findById(attemptId: string): Promise<QuizAttempt | null> {
    return observeDb('quiz-attempt.find-by-id', async () => {
      const row = await this.prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: WITH_ANSWERS,
      });
      return row ? toAttempt(row) : null;
    });
  }

  replaceAnswers(
    attemptId: string,
    answers: readonly AttemptAnswer[],
  ): Promise<QuizAttempt | null> {
    return observeDb('quiz-attempt.replace-answers', () =>
      this.prisma.$transaction(async (tx) => {
        // Khóa dòng lượt làm bài bằng một cập nhật có điều kiện: nộp bài đồng thời sẽ thua.
        const locked = await tx.quizAttempt.updateMany({
          where: { id: attemptId, status: 'IN_PROGRESS' },
          data: { updatedAt: new Date() },
        });
        if (locked.count === 0) return null;

        await tx.quizAttemptAnswer.deleteMany({ where: { attemptId } });
        await tx.quizAttemptAnswer.createMany({
          data: answers.flatMap((answer) =>
            answer.optionIds.map((selectedOptionId) => ({
              id: randomUUID(),
              attemptId,
              questionId: answer.questionId,
              selectedOptionId,
            })),
          ),
        });
        const row = await tx.quizAttempt.findUniqueOrThrow({
          where: { id: attemptId },
          include: WITH_ANSWERS,
        });
        return toAttempt(row);
      }),
    );
  }

  submit(attemptId: string, result: AttemptResult): Promise<QuizAttempt | null> {
    return observeDb('quiz-attempt.submit', () =>
      this.prisma.$transaction(async (tx) => {
        const updated = await tx.quizAttempt.updateMany({
          where: { id: attemptId, status: 'IN_PROGRESS' },
          data: {
            status: 'SUBMITTED',
            submittedAt: result.submittedAt,
            score: result.score,
            maxScore: result.maxScore,
          },
        });
        if (updated.count === 0) return null;
        const row = await tx.quizAttempt.findUniqueOrThrow({
          where: { id: attemptId },
          include: WITH_ANSWERS,
        });
        return toAttempt(row);
      }),
    );
  }

  listByQuiz(
    quizId: string,
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: QuizAttempt[]; total: number }> {
    return observeDb('quiz-attempt.list-by-quiz', async () => {
      const where = { quizId, studentId };
      const [rows, total] = await Promise.all([
        this.prisma.quizAttempt.findMany({
          where,
          orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: WITH_ANSWERS,
        }),
        this.prisma.quizAttempt.count({ where }),
      ]);
      return { items: rows.map(toAttempt), total };
    });
  }
}
