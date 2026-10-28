import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { Course } from './course.js';

/** Admin toàn quyền; giảng viên chỉ quản lý khóa học của mình; học viên không quản lý nội dung. */
export function assertCanManageCourse(principal: Principal, course: Course): void {
  if (principal.role === 'admin') return;
  if (principal.role === 'instructor' && course.instructorId === principal.id) return;
  throw AppError.forbidden();
}
