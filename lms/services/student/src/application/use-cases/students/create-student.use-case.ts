import { AppError } from '@aiops-lms/common/errors';

import type { Student } from '../../../domain/student.js';
import type { NewStudent, StudentRepository } from '../../ports/student-repository.js';

/** Tạo hồ sơ student cùng `id` với tài khoản auth (gọi nội bộ từ `auth`). */
export class CreateStudentUseCase {
  constructor(private readonly students: StudentRepository) {}

  async execute(input: NewStudent): Promise<Student> {
    const created = await this.students.create({ ...input, email: input.email.toLowerCase() });
    if (!created) throw AppError.conflict('Student đã tồn tại');
    return created;
  }
}
