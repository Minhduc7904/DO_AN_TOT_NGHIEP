import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';

import { EnrollmentService } from '../../../application/enrollment.service.js';
import type { CoursePrincipal } from '../../../application/ports/course-client.js';
import type { EnrollmentListFilter } from '../../../application/ports/enrollment-repository.js';
import type { Enrollment } from '../../../domain/enrollment.js';

const createSchema = z.object({ course_id: z.string().trim().min(1).max(200) }).strict();
const limitSchema = z.coerce.number().int().min(1).max(100);

@Controller('api/v1/enrollments')
export class EnrollmentController {
  constructor(private readonly enrollments: EnrollmentService) {}

  @Post()
  create(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Body() body: unknown,
  ): Promise<Enrollment> {
    const principal = this.requirePrincipal(principalId, role);
    if (principal.role !== 'student') throw new ForbiddenException('Cần quyền student');
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Enrollment payload không hợp lệ');
    return this.enrollments.create(principal, parsed.data.course_id);
  }

  // Internal service-to-service contract (docs §2.3 mục 3): caller không bắt buộc
  // mang x-principal-* headers, principal cần kiểm tra đến từ query param.
  @Get('check')
  async check(
    @Query('principal_id') targetPrincipalId: string | undefined,
    @Query('course_id') targetCourseId: string | undefined,
  ): Promise<{ principal_id: string; course_id: string; enrolled: boolean }> {
    if (!targetPrincipalId?.trim() || !targetCourseId?.trim()) {
      throw new BadRequestException('principal_id và course_id là bắt buộc');
    }
    const enrolled = await this.enrollments.check(targetPrincipalId, targetCourseId);
    return { course_id: targetCourseId, enrolled, principal_id: targetPrincipalId };
  }

  @Get()
  list(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Query('principal_id') rawPrincipalId: string | undefined,
    @Query('course_id') rawCourseId: string | undefined,
    @Query('limit') rawLimit: string | undefined,
  ): Promise<{ items: Enrollment[] }> {
    const principal = this.requirePrincipal(principalId, role);
    const parsedLimit =
      rawLimit === undefined
        ? { success: true as const, data: 20 }
        : limitSchema.safeParse(rawLimit);
    if (!parsedLimit.success) throw new BadRequestException('limit không hợp lệ');

    const filter: EnrollmentListFilter =
      principal.role === 'student'
        ? { principalId: principal.id }
        : this.buildInstructorFilter(rawPrincipalId, rawCourseId);

    return this.enrollments.list(filter, parsedLimit.data).then((items) => ({ items }));
  }

  private buildInstructorFilter(
    principalId: string | undefined,
    courseId: string | undefined,
  ): EnrollmentListFilter {
    if (!principalId?.trim() && !courseId?.trim()) {
      throw new BadRequestException('Cần ít nhất principal_id hoặc course_id');
    }
    const filter: EnrollmentListFilter = {};
    if (principalId?.trim()) filter.principalId = principalId;
    if (courseId?.trim()) filter.courseId = courseId;
    return filter;
  }

  private requirePrincipal(id: string | undefined, role: string | undefined): CoursePrincipal {
    if (!id || !role) throw new UnauthorizedException('Thiếu principal context');
    if (role !== 'student' && role !== 'instructor') {
      throw new ForbiddenException('Vai trò không được phép truy cập Enrollment');
    }
    return { id, role };
  }
}
