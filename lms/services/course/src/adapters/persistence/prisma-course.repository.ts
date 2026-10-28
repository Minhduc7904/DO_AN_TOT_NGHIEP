import { Inject, Injectable } from '@nestjs/common';

import type { Course } from '../../domain/course.js';
import type {
  CourseCounts,
  CourseFilter,
  CoursePatch,
  CourseRepository,
  NewCourse,
} from '../../application/ports/course-repository.js';
import type { MediaEffect } from '../../application/ports/media-effects.js';
import {
  enqueueMediaEffects,
  OUTBOX_PRODUCER,
  type OutboxProducer,
} from '../messaging/media-effects.outbox.js';
import type { Course as CourseRow, Prisma } from './generated/client.js';
import { isRecordNotFound, observeDb, omitUndefined } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

export function toCourse(row: CourseRow): Course {
  return { ...row };
}

function whereOf(filter: CourseFilter): Prisma.CourseWhereInput {
  return omitUndefined({
    status: filter.status,
    instructorId: filter.instructorId,
    name: filter.search ? { contains: filter.search, mode: 'insensitive' as const } : undefined,
  });
}

@Injectable()
export class PrismaCourseRepository implements CourseRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_PRODUCER) private readonly producer: OutboxProducer,
  ) {}

  create(course: NewCourse, effects: readonly MediaEffect[] = []): Promise<Course> {
    return observeDb('course.create', () =>
      this.prisma.$transaction(async (tx) => {
        const row = await tx.course.create({ data: course });
        await enqueueMediaEffects(tx, this.producer, effects);
        return toCourse(row);
      }),
    );
  }

  findById(id: string): Promise<Course | null> {
    return observeDb('course.find-by-id', async () => {
      const row = await this.prisma.course.findUnique({ where: { id } });
      return row ? toCourse(row) : null;
    });
  }

  update(
    id: string,
    patch: CoursePatch,
    effects: readonly MediaEffect[] = [],
  ): Promise<Course | null> {
    return observeDb('course.update', async () => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const row = await tx.course.update({ where: { id }, data: omitUndefined(patch) });
          await enqueueMediaEffects(tx, this.producer, effects);
          return toCourse(row);
        });
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  delete(id: string, effects: readonly MediaEffect[] = []): Promise<boolean> {
    return observeDb('course.delete', () =>
      this.prisma.$transaction(async (tx) => {
        const result = await tx.course.deleteMany({ where: { id } });
        if (result.count === 0) return false;
        await enqueueMediaEffects(tx, this.producer, effects);
        return true;
      }),
    );
  }

  list(
    filter: CourseFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: Course[]; total: number }> {
    return observeDb('course.list', async () => {
      const where = whereOf(filter);
      const [rows, total] = await Promise.all([
        this.prisma.course.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.course.count({ where }),
      ]);
      return { items: rows.map(toCourse), total };
    });
  }

  count(filter: CourseFilter): Promise<CourseCounts> {
    return observeDb('course.count', async () => {
      const groups = await this.prisma.course.groupBy({
        by: ['status'],
        where: whereOf(filter),
        _count: { _all: true },
      });
      const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
      const draft = byStatus.get('DRAFT') ?? 0;
      const published = byStatus.get('PUBLISHED') ?? 0;
      const archived = byStatus.get('ARCHIVED') ?? 0;
      return { total: draft + published + archived, draft, published, archived };
    });
  }

  listAfter(filter: CourseFilter, afterId: string | null, limit: number): Promise<Course[]> {
    return observeDb('course.list-after', async () => {
      const rows = await this.prisma.course.findMany({
        where: { ...whereOf(filter), ...(afterId ? { id: { gt: afterId } } : {}) },
        orderBy: { id: 'asc' },
        take: limit,
      });
      return rows.map(toCourse);
    });
  }
}
