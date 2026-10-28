import { InternalApi, parseInput } from '@aiops-lms/common/http';
import {
  createStudentRequestSchema,
  idSchema,
  INTERNAL_PREFIX,
  type StudentDto,
} from '@aiops-lms/contracts/http';
import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';

import { CreateStudentUseCase } from '../../../application/use-cases/students/create-student.use-case.js';
import { GetStudentUseCase } from '../../../application/use-cases/students/get-student.use-case.js';
import { presentStudent } from '../shared/student.presenter.js';

/** Bề mặt nội bộ cho service khác (auth → student); không qua Gateway, cần service token. */
@Controller(`${INTERNAL_PREFIX}/students`)
export class StudentInternalController {
  constructor(
    @Inject(CreateStudentUseCase) private readonly createStudent: CreateStudentUseCase,
    @Inject(GetStudentUseCase) private readonly getStudent: GetStudentUseCase,
  ) {}

  @InternalApi({ scopes: ['student:profile:write'] })
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown): Promise<StudentDto> {
    const input = parseInput(createStudentRequestSchema, body);
    return presentStudent(
      await this.createStudent.execute({
        id: input.id,
        email: input.email,
        fullName: input.full_name,
      }),
    );
  }

  /** Kiểm tra hồ sơ trước khi cấp token; 404 khi chưa có hồ sơ. */
  @InternalApi({ scopes: ['student:profile:read'] })
  @Get(':student_id')
  async get(@Param('student_id') studentId: string): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(parseInput(idSchema, studentId)));
  }
}
