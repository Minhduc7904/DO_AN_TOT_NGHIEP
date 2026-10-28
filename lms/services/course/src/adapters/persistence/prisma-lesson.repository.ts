import { Injectable } from '@nestjs/common';

import type { Lesson } from '../../domain/course.js';
import type {
  LessonPatch,
  LessonRepository,
  NewLesson,
} from '../../application/ports/lesson-repository.js';
import type { Lesson as LessonRow } from './generated/client.js';
import { isRecordNotFound, isUniqueViolation, observeDb, omitUndefined } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

function toLesson(row: LessonRow): Lesson {
  return { ...row };
}

@Injectable()
export class PrismaLessonRepository implements LessonRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(lesson: NewLesson): Promise<Lesson | null> {
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
          return tx.lesson.create({
            data: {
              id: lesson.id,
              courseId: lesson.courseId,
              title: lesson.title,
              contentMarkdown: lesson.contentMarkdown,
              displayOrder,
            },
          });
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

  update(lessonId: string, patch: LessonPatch): Promise<Lesson | null> {
    return observeDb('lesson.update', async () => {
      try {
        return toLesson(
          await this.prisma.lesson.update({ where: { id: lessonId }, data: omitUndefined(patch) }),
        );
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  delete(lessonId: string): Promise<boolean> {
    return observeDb('lesson.delete', async () => {
      const result = await this.prisma.lesson.deleteMany({ where: { id: lessonId } });
      return result.count > 0;
    });
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
