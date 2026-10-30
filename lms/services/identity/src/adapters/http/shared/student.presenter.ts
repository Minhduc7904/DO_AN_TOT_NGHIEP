import { type StudentDto, userAvatarUrl } from '@aiops-lms/contracts';

import type { Student } from '../../../domain/student.js';

/** Domain → DTO `snake_case` theo contract v2. */
export function presentStudent(student: Student): StudentDto {
  return {
    id: student.id,
    email: student.email,
    full_name: student.fullName,
    status: student.status,
    avatar_url: userAvatarUrl(student.id),
    created_at: student.createdAt.toISOString(),
    updated_at: student.updatedAt.toISOString(),
  };
}
