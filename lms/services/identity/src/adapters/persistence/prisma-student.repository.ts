import { observeDependency } from '@aiops-lms/common/telemetry';
import { Injectable } from '@nestjs/common';

import type { Student } from '../../domain/student.js';
import type { StudentRepository } from '../../application/ports/student-repository.js';
import type { StudentProfile, User } from './generated/client.js';
import { PrismaService } from './prisma.service.js';

const DEPENDENCY = 'identity-postgres';
const ATTRIBUTES = { 'db.system.name': 'postgresql' };

function toStudent(row: StudentProfile & { user: User }): Student {
  return {
    id: row.userId,
    email: row.user.email,
    fullName: row.user.fullName,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Student | null> {
    return observeDependency(
      DEPENDENCY,
      'student.find-by-id',
      async () => {
        const row = await this.prisma.studentProfile.findUnique({
          where: { userId: id },
          include: { user: true },
        });
        return row ? toStudent(row) : null;
      },
      { attributes: ATTRIBUTES },
    );
  }

  list(
    page: number,
    pageSize: number,
    status?: Student['status'],
  ): Promise<{ items: Student[]; total: number }> {
    return observeDependency(
      DEPENDENCY,
      'student.list',
      async () => {
        const where = status ? { status } : {};
        const [rows, total] = await Promise.all([
          this.prisma.studentProfile.findMany({
            where,
            include: { user: true },
            orderBy: status ? { userId: 'asc' } : [{ createdAt: 'desc' }, { userId: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.studentProfile.count({ where }),
        ]);
        return { items: rows.map(toStudent), total };
      },
      { attributes: ATTRIBUTES },
    );
  }
}
