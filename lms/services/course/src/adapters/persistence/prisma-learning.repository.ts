import { Injectable } from '@nestjs/common';

import type { Enrollment, LessonProgress } from '../../domain/course.js';
import type {
  EnrollmentRepository,
  NewEnrollment,
  ProgressRepository,
  ProgressUpdate,
} from '../../application/ports/learning-repository.js';
import type { LessonProgress as ProgressRow } from './generated/client.js';
import { isUniqueViolation, observeDb } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

const COMPLETE = 100;

function toProgress(row: ProgressRow): LessonProgress {
  return {
    lessonId: row.lessonId,
    studentId: row.studentId,
    progressPercent: row.progressPercent.toNumber(),
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(enrollment: NewEnrollment): Promise<Enrollment | null> {
    return observeDb('enrollment.create', async () => {
      try {
        return await this.prisma.enrollment.create({ data: enrollment });
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  find(courseId: string, studentId: string): Promise<Enrollment | null> {
    return observeDb('enrollment.find', () =>
      this.prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId, studentId } } }),
    );
  }

  listByStudent(
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Enrollment[]; total: number }> {
    return observeDb('enrollment.list-by-student', async () => {
      const [items, total] = await Promise.all([
        this.prisma.enrollment.findMany({
          where: { studentId },
          orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.enrollment.count({ where: { studentId } }),
      ]);
      return { items, total };
    });
  }
}

@Injectable()
export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(update: ProgressUpdate): Promise<LessonProgress> {
    return observeDb('lesson-progress.upsert', () =>
      this.prisma.$transaction(async (tx) => {
        const key = {
          lessonId_studentId: { lessonId: update.lessonId, studentId: update.studentId },
        };
        const existing = await tx.lessonProgress.findUnique({ where: key });
        const progressPercent = Math.max(
          existing?.progressPercent.toNumber() ?? 0,
          update.progressPercent,
        );
        const completedAt =
          existing?.completedAt ?? (progressPercent >= COMPLETE ? update.now : null);

        const row = await tx.lessonProgress.upsert({
          where: key,
          create: {
            id: update.id,
            lessonId: update.lessonId,
            studentId: update.studentId,
            progressPercent,
            completedAt,
          },
          update: { progressPercent, completedAt },
        });
        return toProgress(row);
      }),
    );
  }

  listByCourse(studentId: string, courseId: string): Promise<LessonProgress[]> {
    return observeDb('lesson-progress.list-by-course', async () => {
      const rows = await this.prisma.lessonProgress.findMany({
        where: { studentId, lesson: { courseId } },
        orderBy: { lesson: { displayOrder: 'asc' } },
      });
      return rows.map(toProgress);
    });
  }
}
