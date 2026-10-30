import type { Student } from '../../domain/student.js';

export interface StudentRepository {
  /** Hồ sơ student ghép với email và họ tên của tài khoản; `null` khi chưa có. */
  findById(id: string): Promise<Student | null>;
  /** `status` lọc theo trạng thái và chuyển sang thứ tự `id` ổn định cho việc duyệt toàn bộ. */
  list(
    page: number,
    pageSize: number,
    status?: Student['status'],
  ): Promise<{ items: Student[]; total: number }>;
}

export const STUDENT_REPOSITORY = Symbol('StudentRepository');
