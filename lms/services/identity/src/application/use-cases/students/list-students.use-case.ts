import type { Student } from '../../../domain/student.js';
import type { StudentRepository } from '../../ports/student-repository.js';

export class ListStudentsUseCase {
  constructor(private readonly students: StudentRepository) {}

  execute(
    page: number,
    pageSize: number,
    status?: Student['status'],
  ): Promise<{ items: Student[]; total: number }> {
    return this.students.list(page, pageSize, status);
  }
}
