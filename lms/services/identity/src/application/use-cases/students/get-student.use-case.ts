import { AppError } from '@aiops-lms/common/errors';

import type { Student } from '../../../domain/student.js';
import type { StudentRepository } from '../../ports/student-repository.js';

export class GetStudentUseCase {
  constructor(private readonly students: StudentRepository) {}

  async execute(studentId: string): Promise<Student> {
    const student = await this.students.findById(studentId);
    if (!student) throw AppError.notFound('Không tìm thấy student');
    return student;
  }
}
