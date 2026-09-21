import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';

import { CourseService } from '../../../application/course.service.js';
import type { Course } from '../../../domain/course.js';

const createSchema = z.object({ title: z.string().trim().min(1).max(200) }).strict();
const limitSchema = z.coerce.number().int().min(1).max(100);

@Controller('api/v1/courses')
export class CourseController {
  constructor(private readonly courses: CourseService) {}

  @Post()
  create(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Body() body: unknown,
  ): Promise<Course> {
    this.requirePrincipal(principalId, role);
    if (role !== 'instructor') throw new ForbiddenException('Cần quyền instructor');
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Course payload không hợp lệ');
    return this.courses.create(parsed.data.title);
  }

  @Get()
  list(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Query('limit') rawLimit: string | undefined,
  ): Promise<{ items: Course[] }> {
    this.requirePrincipal(principalId, role);
    const parsed =
      rawLimit === undefined
        ? { success: true as const, data: 20 }
        : limitSchema.safeParse(rawLimit);
    if (!parsed.success) throw new BadRequestException('limit không hợp lệ');
    return this.courses.list(parsed.data);
  }

  @Get(':course_id')
  async get(
    @Headers('x-principal-id') principalId: string | undefined,
    @Headers('x-principal-role') role: string | undefined,
    @Param('course_id') id: string,
  ): Promise<Course> {
    this.requirePrincipal(principalId, role);
    if (!id.trim()) throw new BadRequestException('course_id không hợp lệ');
    const course = await this.courses.findById(id);
    if (!course) throw new NotFoundException('Không tìm thấy course');
    return course;
  }

  private requirePrincipal(id: string | undefined, role: string | undefined): void {
    if (!id || !role) throw new UnauthorizedException('Thiếu principal context');
    if (role !== 'student' && role !== 'instructor') {
      throw new ForbiddenException('Vai trò không được phép truy cập Course');
    }
  }
}
