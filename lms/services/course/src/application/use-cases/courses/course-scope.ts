import type { Principal } from '@aiops-lms/common/ports';

import type { CourseStatus } from '../../../domain/course.js';
import type { CourseFilter } from '../../ports/course-repository.js';

export interface CourseQuery {
  status?: CourseStatus | undefined;
  search?: string | undefined;
}

/**
 * Phạm vi khóa học nhìn thấy theo vai trò: admin thấy tất cả, giảng viên chỉ thấy khóa của mình,
 * học viên chỉ thấy khóa đã xuất bản (bỏ qua bộ lọc trạng thái khác).
 */
export function scopeCourseFilter(principal: Principal, query: CourseQuery): CourseFilter {
  const filter: CourseFilter = { search: query.search };
  if (principal.role === 'student') return { ...filter, status: 'PUBLISHED' };
  if (principal.role === 'instructor') filter.instructorId = principal.id;
  filter.status = query.status;
  return filter;
}
