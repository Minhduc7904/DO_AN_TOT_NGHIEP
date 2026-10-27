import type { Student } from '../../domain/student.js';

export interface NewStudent {
  id: string;
  email: string;
  fullName: string;
}

export interface StudentRepository {
  /** Trả `null` khi `id` hoặc email đã tồn tại. */
  create(student: NewStudent): Promise<Student | null>;
  findById(id: string): Promise<Student | null>;
  list(page: number, pageSize: number): Promise<{ items: Student[]; total: number }>;
  /** Kiểm tra truy cập CSDL; ném lỗi khi không sẵn sàng. */
  ping(): Promise<void>;
}

export const STUDENT_REPOSITORY = Symbol('StudentRepository');
