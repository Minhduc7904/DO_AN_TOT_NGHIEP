import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';

import { GradeNotFoundError } from '../../../application/grade-not-found-error.js';
import type { GradingPrincipal } from '../../../application/grading-principal.js';
import { GradingService } from '../../../application/grading.service.js';
import { toGradeRepresentation, type GradeRepresentation } from '../../../domain/grade.js';

// Cột `score` là numeric(7,4): từ chối giá trị có hơn 4 chữ số thập phân thay vì để PostgreSQL làm tròn âm thầm.
const hasAtMostFourDecimals = (value: number): boolean =>
  Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6;

const createSchema = z
  .object({
    score: z.number().min(0).max(100).refine(hasAtMostFourDecimals),
    submission_id: z.string().trim().min(1).max(200),
  })
  .strict();
const gradeIdSchema = z.uuid();

@Controller('api/v1/grades')
export class GradingController {
  constructor(private readonly grading: GradingService) {}

  @Post()
  async create(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Body() body: unknown,
  ): Promise<GradeRepresentation> {
    const principal = this.requirePrincipal(principalId, role);
    if (principal.role !== 'instructor') throw new ForbiddenException('Cần quyền instructor');
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Grade payload không hợp lệ');
    const grade = await this.grading.create(
      principal,
      parsed.data.submission_id,
      parsed.data.score,
    );
    return toGradeRepresentation(grade);
  }

  @Get(':grade_id')
  async getById(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Param('grade_id') id: string,
  ): Promise<GradeRepresentation> {
    const principal = this.requirePrincipal(principalId, role);
    // Grade ID là UUID; giá trị khác không thể tồn tại nên trả 404 thay vì để PostgreSQL báo lỗi cast.
    if (!gradeIdSchema.safeParse(id).success) throw new GradeNotFoundError(id);
    return toGradeRepresentation(await this.grading.getById(principal, id));
  }

  private requirePrincipal(id: string | undefined, role: string | undefined): GradingPrincipal {
    if (!id || !role) throw new UnauthorizedException('Thiếu principal context');
    if (role !== 'student' && role !== 'instructor') {
      throw new ForbiddenException('Vai trò không được phép truy cập Grading');
    }
    return { id, role };
  }
}
