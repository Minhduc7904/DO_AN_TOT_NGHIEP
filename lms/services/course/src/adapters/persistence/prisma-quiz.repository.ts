import { Inject, Injectable } from '@nestjs/common';

import type { Quiz, QuizQuestion, QuizSummary } from '../../domain/course.js';
import { courseErrors } from '../../domain/errors.js';
import type {
  NewQuiz,
  QuizPatch,
  QuizRepository,
} from '../../application/ports/quiz-repository.js';
import type { MediaEffect } from '../../application/ports/media-effects.js';
import {
  enqueueMediaEffects,
  OUTBOX_PRODUCER,
  type OutboxProducer,
} from '../messaging/media-effects.outbox.js';
import type { Prisma, Quiz as QuizRow } from './generated/client.js';
import { isRecordNotFound, isUniqueViolation, observeDb, omitUndefined } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

const WITH_TREE = {
  questions: {
    orderBy: { displayOrder: 'asc' },
    include: { options: { orderBy: { displayOrder: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;

type QuizWithTree = Prisma.QuizGetPayload<{ include: typeof WITH_TREE }>;

function toQuiz(row: QuizWithTree): Quiz {
  return {
    id: row.id,
    lessonId: row.lessonId,
    title: row.title,
    descriptionMarkdown: row.descriptionMarkdown,
    displayOrder: row.displayOrder,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    questions: row.questions.map((question) => ({
      id: question.id,
      questionMarkdown: question.questionMarkdown,
      questionType: question.questionType,
      points: question.points.toNumber(),
      displayOrder: question.displayOrder,
      options: question.options.map((option) => ({
        id: option.id,
        optionMarkdown: option.optionMarkdown,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
    })),
  };
}

function questionData(
  question: QuizQuestion,
): Omit<Prisma.QuizQuestionCreateWithoutQuizInput, 'answers'> {
  return {
    id: question.id,
    questionMarkdown: question.questionMarkdown,
    questionType: question.questionType,
    points: question.points,
    displayOrder: question.displayOrder,
    options: {
      create: question.options.map((option) => ({
        id: option.id,
        optionMarkdown: option.optionMarkdown,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
    },
  };
}

function toSummary(row: QuizRow & { _count: { questions: number } }): QuizSummary {
  const { _count: count, ...quiz } = row;
  return { ...quiz, questionCount: count.questions };
}

@Injectable()
export class PrismaQuizRepository implements QuizRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_PRODUCER) private readonly producer: OutboxProducer,
  ) {}

  create(quiz: NewQuiz, effects: readonly MediaEffect[] = []): Promise<Quiz | null> {
    return observeDb('quiz.create', async () => {
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const last = await tx.quiz.aggregate({
            where: { lessonId: quiz.lessonId },
            _max: { displayOrder: true },
          });
          const created = await tx.quiz.create({
            data: {
              id: quiz.id,
              lessonId: quiz.lessonId,
              title: quiz.title,
              descriptionMarkdown: quiz.descriptionMarkdown,
              displayOrder: (last._max.displayOrder ?? 0) + 1,
              questions: { create: quiz.questions.map(questionData) },
            },
            include: WITH_TREE,
          });
          await enqueueMediaEffects(tx, this.producer, effects);
          return created;
        });
        return toQuiz(row);
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  findInLesson(lessonId: string, quizId: string): Promise<Quiz | null> {
    return observeDb('quiz.find-in-lesson', async () => {
      const row = await this.prisma.quiz.findFirst({
        where: { id: quizId, lessonId },
        include: WITH_TREE,
      });
      return row ? toQuiz(row) : null;
    });
  }

  findById(quizId: string): Promise<Quiz | null> {
    return observeDb('quiz.find-by-id', async () => {
      const row = await this.prisma.quiz.findUnique({ where: { id: quizId }, include: WITH_TREE });
      return row ? toQuiz(row) : null;
    });
  }

  listByLesson(lessonId: string, publishedOnly: boolean): Promise<QuizSummary[]> {
    return observeDb('quiz.list-by-lesson', async () => {
      const rows = await this.prisma.quiz.findMany({
        where: { lessonId, ...(publishedOnly ? { status: 'PUBLISHED' as const } : {}) },
        orderBy: { displayOrder: 'asc' },
        include: { _count: { select: { questions: true } } },
      });
      return rows.map(toSummary);
    });
  }

  update(
    quizId: string,
    patch: QuizPatch,
    effects: readonly MediaEffect[] = [],
  ): Promise<Quiz | null> {
    return observeDb('quiz.update', async () => {
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          if (patch.questions) {
            // Kiểm tra lại trong transaction: lượt làm bài có thể phát sinh sau bước kiểm tra
            // của use case, và thay cây câu hỏi sẽ xóa luôn câu trả lời đã chấm.
            if ((await tx.quizAttempt.count({ where: { quizId } })) > 0) {
              throw courseErrors.quizHasAttempts();
            }
            await tx.quizQuestion.deleteMany({ where: { quizId } });
            for (const question of patch.questions) {
              await tx.quizQuestion.create({ data: { ...questionData(question), quizId } });
            }
          }
          const updated = await tx.quiz.update({
            where: { id: quizId },
            data: omitUndefined({
              title: patch.title,
              descriptionMarkdown: patch.descriptionMarkdown,
              status: patch.status,
            }),
            include: WITH_TREE,
          });
          await enqueueMediaEffects(tx, this.producer, effects);
          return updated;
        });
        return toQuiz(row);
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  delete(quizId: string, effects: readonly MediaEffect[] = []): Promise<boolean> {
    return observeDb('quiz.delete', () =>
      this.prisma.$transaction(async (tx) => {
        const result = await tx.quiz.deleteMany({ where: { id: quizId } });
        if (result.count === 0) return false;
        await enqueueMediaEffects(tx, this.producer, effects);
        return true;
      }),
    );
  }

  hasAttempts(quizId: string): Promise<boolean> {
    return observeDb('quiz.has-attempts', async () => {
      const attempt = await this.prisma.quizAttempt.findFirst({
        where: { quizId },
        select: { id: true },
      });
      return attempt !== null;
    });
  }
}
