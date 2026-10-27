import { AppError } from '@aiops-lms/common/errors';

import type { Student } from '../../src/domain/student.js';
import type {
  NewStudent,
  StudentRepository,
} from '../../src/application/ports/student-repository.js';
import { CreateStudentUseCase } from '../../src/application/use-cases/students/create-student.use-case.js';
import { GetStudentUseCase } from '../../src/application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../src/application/use-cases/students/list-students.use-case.js';

const ID = '2f0b0a6e-5d4b-4c0b-9a54-3d1f0b8f7a11';

class InMemoryStudents implements StudentRepository {
  readonly rows = new Map<string, Student>();

  create(student: NewStudent): Promise<Student | null> {
    const duplicate = [...this.rows.values()].some(
      (row) => row.id === student.id || row.email === student.email,
    );
    if (duplicate) return Promise.resolve(null);
    const now = new Date('2026-11-02T00:00:00Z');
    const row: Student = { ...student, status: 'ACTIVE', createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findById(id: string): Promise<Student | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  list(page: number, pageSize: number): Promise<{ items: Student[]; total: number }> {
    const all = [...this.rows.values()];
    return Promise.resolve({
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    });
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }
}

describe('student use cases', () => {
  it('tạo student với email chữ thường và báo conflict khi trùng', async () => {
    const students = new InMemoryStudents();
    const create = new CreateStudentUseCase(students);

    const created = await create.execute({ id: ID, email: 'An@Example.COM', fullName: 'An' });

    expect(created).toMatchObject({ id: ID, email: 'an@example.com', status: 'ACTIVE' });
    await expect(
      create.execute({ id: ID, email: 'other@example.com', fullName: 'An' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('lấy student theo id và báo not found khi thiếu', async () => {
    const students = new InMemoryStudents();
    await new CreateStudentUseCase(students).execute({ id: ID, email: 'a@b.co', fullName: 'A' });
    const get = new GetStudentUseCase(students);

    await expect(get.execute(ID)).resolves.toMatchObject({ id: ID });
    await expect(get.execute('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('phân trang danh sách', async () => {
    const students = new InMemoryStudents();
    const create = new CreateStudentUseCase(students);
    for (let index = 0; index < 3; index += 1) {
      await create.execute({
        id: `2f0b0a6e-5d4b-4c0b-9a54-3d1f0b8f7a1${index}`,
        email: `s${index}@b.co`,
        fullName: `S${index}`,
      });
    }

    const page = await new ListStudentsUseCase(students).execute(2, 2);

    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(1);
  });
});
