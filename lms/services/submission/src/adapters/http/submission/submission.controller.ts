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

import { SubmissionService } from '../../../application/submission.service.js';
import type { SubmissionPrincipal } from '../../../application/ports/course-client.js';
import type { Submission } from '../../../domain/submission.js';

const createSchema = z
  .object({
    content: z.string().min(1).max(1_000_000),
    course_id: z.string().trim().min(1).max(200),
  })
  .strict();

@Controller('api/v1/submissions')
export class SubmissionController {
  constructor(private readonly submissions: SubmissionService) {}

  @Post()
  create(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Body() body: unknown,
  ): Promise<Submission> {
    const principal = this.requirePublicPrincipal(principalId, role);
    if (principal.role !== 'student') throw new ForbiddenException('Cần quyền student');
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Submission payload không hợp lệ');
    return this.submissions.create(principal, parsed.data.course_id, parsed.data.content);
  }

  @Get(':submission_id')
  getById(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Param('submission_id') id: string,
  ): Promise<Submission> {
    if (!id.trim() || id.length > 200) {
      throw new BadRequestException('submission_id không hợp lệ');
    }
    return this.submissions.getById(id, this.resolvePrincipal(principalId, role));
  }

  private requirePublicPrincipal(
    id: string | undefined,
    role: string | undefined,
  ): SubmissionPrincipal {
    const principal = this.resolvePrincipal(id, role);
    if (!principal) throw new UnauthorizedException('Thiếu principal context');
    return principal;
  }

  private resolvePrincipal(
    id: string | undefined,
    role: string | undefined,
  ): SubmissionPrincipal | undefined {
    if (!id && !role) return undefined;
    if (!id || !role) throw new UnauthorizedException('Principal context không đầy đủ');
    if (role !== 'student' && role !== 'instructor') {
      throw new ForbiddenException('Vai trò không được phép truy cập Submission');
    }
    return { id, role };
  }
}
