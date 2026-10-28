import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import { csvRow } from '../../../domain/csv.js';
import type { CourseStatus } from '../../../domain/course.js';
import type { CourseFilter, CourseRepository } from '../../ports/course-repository.js';

export const EXPORT_CHUNK_SIZE = 500;
const UTF8_BOM = '﻿';

export class ExportCoursesCsvUseCase {
  constructor(private readonly courses: CourseRepository) {}

  /**
   * Sinh CSV theo từng khối bằng keyset (`id` tăng dần): bộ nhớ không phụ thuộc số khóa học và
   * không giữ một truy vấn dài trên DB. Khối đầu mang BOM UTF-8 và dòng tiêu đề.
   */
  execute(principal: Principal, status?: CourseStatus): AsyncGenerator<string, void, undefined> {
    if (principal.role === 'student') throw AppError.forbidden();
    const filter: CourseFilter = { status };
    if (principal.role === 'instructor') filter.instructorId = principal.id;
    return this.stream(filter);
  }

  private async *stream(filter: CourseFilter): AsyncGenerator<string, void, undefined> {
    yield UTF8_BOM + csvRow(['id', 'name', 'status', 'createdAtUtc']);
    let afterId: string | null = null;
    for (;;) {
      const batch = await this.courses.listAfter(filter, afterId, EXPORT_CHUNK_SIZE);
      if (batch.length === 0) return;
      yield batch
        .map((course) =>
          csvRow([course.id, course.name, course.status, course.createdAt.toISOString()]),
        )
        .join('');
      if (batch.length < EXPORT_CHUNK_SIZE) return;
      afterId = batch[batch.length - 1]?.id ?? null;
    }
  }
}
