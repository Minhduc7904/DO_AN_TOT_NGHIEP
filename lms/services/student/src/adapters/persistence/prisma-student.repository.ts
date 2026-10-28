import { observeDependency } from '@aiops-lms/common/telemetry';
import { Injectable } from '@nestjs/common';

import type { Student } from '../../domain/student.js';
import type { NewStudent, StudentRepository } from '../../application/ports/student-repository.js';
import type { Student as StudentRow } from './generated/client.js';
import { PrismaService } from './prisma.service.js';

const DEPENDENCY = 'student-postgres';
const UNIQUE_VIOLATION = 'P2002';

function toDomain(row: StudentRow): Student {
  return { ...row };
}

@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(student: NewStudent): Promise<Student | null> {
    return observeDependency(
      DEPENDENCY,
      'student.create',
      async () => {
        try {
          return toDomain(
            await this.prisma.student.create({
              data: { id: student.id, email: student.email, fullName: student.fullName },
            }),
          );
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === UNIQUE_VIOLATION) {
            return null;
          }
          throw error;
        }
      },
      { attributes: { 'db.system.name': 'postgresql' } },
    );
  }

  findById(id: string): Promise<Student | null> {
    return observeDependency(
      DEPENDENCY,
      'student.find-by-id',
      async () => {
        const row = await this.prisma.student.findUnique({ where: { id } });
        return row ? toDomain(row) : null;
      },
      { attributes: { 'db.system.name': 'postgresql' } },
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
          this.prisma.student.findMany({
            where,
            orderBy: status ? { id: 'asc' } : [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.student.count({ where }),
        ]);
        return { items: rows.map(toDomain), total };
      },
      { attributes: { 'db.system.name': 'postgresql' } },
    );
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
