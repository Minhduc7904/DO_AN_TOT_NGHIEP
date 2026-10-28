import { Inject, Injectable } from '@nestjs/common';

import type { Lesson } from '../../domain/course.js';
import type {
  LessonPatch,
  LessonRepository,
  NewLesson,
} from '../../application/ports/lesson-repository.js';
import type { MediaEffect } from '../../application/ports/media-effects.js';
import {
  enqueueMediaEffects,
  OUTBOX_PRODUCER,
  type OutboxProducer,
} from '../messaging/media-effects.outbox.js';
import type { Lesson as LessonRow } from './generated/client.js';
import { isRecordNotFound, isUniqueViolation, observeDb, omitUndefined } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

function toLesson(row: LessonRow): Lesson {
  return { ...row };
}

@Injectable()
export class PrismaLessonRepository implements LessonRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_PRODUCER) private readonly producer: OutboxProducer,
  ) {}

  create(lesson: NewLesson, effects: readonly MediaEffect[] = []): Promise<Lesson | null> {
    return observeDb('lesson.create', async () => {
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          let displayOrder = lesson.displayOrder;
          if (displayOrder === undefined) {
            const last = await tx.lesson.aggregate({
              where: { courseId: lesson.courseId },
              _max: { displayOrder: true },
            });
            displayOrder = (last._max.displayOrder ?? 0) + 1;
          }
          const created = await tx.lesson.create({
            data: {
              id: lesson.id,
              courseId: lesson.courseId,
              title: lesson.title,
              contentMarkdown: lesson.contentMarkdown,
              displayOrder,
            },
          });
          await enqueueMediaEffects(tx, this.producer, effects);
          return created;
        });
        return toLesson(row);
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  findInCourse(courseId: string, lessonId: string): Promise<Lesson | null> {
    return observeDb('lesson.find-in-course', async () => {
      const row = await this.prisma.lesson.findFirst({ where: { id: lessonId, courseId } });
      return row ? toLesson(row) : null;
    });
  }

  findById(lessonId: string): Promise<Lesson | null> {
    return observeDb('lesson.find-by-id', async () => {
      const row = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
      return row ? toLesson(row) : null;
    });
  }

  listByCourse(courseId: string): Promise<Lesson[]> {
    return observeDb('lesson.list-by-course', async () => {
      const rows = await this.prisma.lesson.findMany({
        where: { courseId },
        orderBy: { displayOrder: 'asc' },
      });
      return rows.map(toLesson);
    });
  }

  update(
    lessonId: string,
    patch: LessonPatch,
    effects: readonly MediaEffect[] = [],
  ): Promise<Lesson | null> {
    return observeDb('lesson.update', async () => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const row = await tx.lesson.update({
            where: { id: lessonId },
            data: omitUndefined(patch),
          });
          await enqueueMediaEffects(tx, this.producer, effects);
          return toLesson(row);
        });
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  delete(lessonId: string, effects: readonly MediaEffect[] = []): Promise<boolean> {
    return observeDb('lesson.delete', () =>
      this.prisma.$transaction(async (tx) => {
        const result = await tx.lesson.deleteMany({ where: { id: lessonId } });
        if (result.count === 0) return false;
        await enqueueMediaEffects(tx, this.producer, effects);
        return true;
      }),
    );
  }

  reorder(courseId: string, orderedIds: readonly string[]): Promise<Lesson[]> {
    return observeDb('lesson.reorder', () =>
      this.prisma.$transaction(async (tx) => {
        // Ràng buộc unique (course_id, display_order) kiểm tra từng dòng, nên đi qua số âm để
        // hoán đổi vị trí mà không va chạm.
        for (const [index, id] of orderedIds.entries()) {
          await tx.lesson.update({ where: { id }, data: { displayOrder: -(index + 1) } });
        }
        for (const [index, id] of orderedIds.entries()) {
          await tx.lesson.update({ where: { id }, data: { displayOrder: index + 1 } });
        }
        const rows = await tx.lesson.findMany({
          where: { courseId },
          orderBy: { displayOrder: 'asc' },
        });
        return rows.map(toLesson);
      }),
    );
  }
}
