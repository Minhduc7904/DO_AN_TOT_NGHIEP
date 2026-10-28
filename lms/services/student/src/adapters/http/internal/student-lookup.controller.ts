import { InternalApi, type Page, parseInput, toPage } from '@aiops-lms/common/http';
import {
  createStudentRequestSchema,
  idSchema,
  INTERNAL_PREFIX,
  listStudentsQuerySchema,
  type StudentDto,
} from '@aiops-lms/contracts/http';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';

import { CreateStudentUseCase } from '../../../application/use-cases/students/create-student.use-case.js';
import { GetStudentUseCase } from '../../../application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../../application/use-cases/students/list-students.use-case.js';
import { presentStudent } from '../shared/student.presenter.js';

/** Bề mặt nội bộ cho service khác (auth → student); không qua Gateway, cần service token. */
@Controller(`${INTERNAL_PREFIX}/students`)
export class StudentInternalController {
  constructor(
    @Inject(CreateStudentUseCase) private readonly createStudent: CreateStudentUseCase,
    @Inject(GetStudentUseCase) private readonly getStudent: GetStudentUseCase,
    @Inject(ListStudentsUseCase) private readonly listStudents: ListStudentsUseCase,
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

  /** Student `ACTIVE` theo trang (id tăng dần) để notification-worker snapshot recipient. */
  @InternalApi({ scopes: ['student:profile:read'] })
  @Get()
  async list(@Query() query: unknown): Promise<Page<StudentDto>> {
    const pagination = parseInput(listStudentsQuerySchema, query);
    const result = await this.listStudents.execute(pagination.page, pagination.page_size, 'ACTIVE');
    return toPage(result, pagination, presentStudent);
  }

  /** Kiểm tra hồ sơ trước khi cấp token; 404 khi chưa có hồ sơ. */
  @InternalApi({ scopes: ['student:profile:read'] })
  @Get(':student_id')
  async get(@Param('student_id') studentId: string): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(parseInput(idSchema, studentId)));
  }
}
