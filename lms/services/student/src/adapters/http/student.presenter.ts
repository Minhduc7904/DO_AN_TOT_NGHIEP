import type { Student } from '../../domain/student.js';

/** JSON `snake_case` theo contract v2. */
export function presentStudent(student: Student): Record<string, unknown> {
  return {
    id: student.id,
    email: student.email,
    full_name: student.fullName,
    status: student.status,
    created_at: student.createdAt.toISOString(),
    updated_at: student.updatedAt.toISOString(),
  };
}
