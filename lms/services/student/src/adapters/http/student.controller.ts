import {
  createStudentRequestSchema,
  idSchema,
  listStudentsQuerySchema,
  type StudentDto,
} from '@aiops-lms/contracts';
import {
  CurrentPrincipal,
  type Page,
  parseInput,
  Public,
  Roles,
  toPage,
} from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';

import { CreateStudentUseCase } from '../../application/use-cases/students/create-student.use-case.js';
import { GetStudentUseCase } from '../../application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../application/use-cases/students/list-students.use-case.js';
import { presentStudent } from './student.presenter.js';

@Controller()
export class StudentController {
  constructor(
    @Inject(CreateStudentUseCase) private readonly createStudent: CreateStudentUseCase,
    @Inject(GetStudentUseCase) private readonly getStudent: GetStudentUseCase,
    @Inject(ListStudentsUseCase) private readonly listStudents: ListStudentsUseCase,
  ) {}

  /** Nội bộ (auth → student): không qua Gateway nên không cần JWT. */
  @Public()
  @Post('internal/v1/students')
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

  @Roles('student')
  @Get('api/v1/students/me')
  async me(@CurrentPrincipal() principal: Principal): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(principal.id));
  }

  @Roles('admin', 'instructor')
  @Get('api/v1/students')
  async list(@Query() query: unknown): Promise<Page<StudentDto>> {
    const pagination = parseInput(listStudentsQuerySchema, query);
    const result = await this.listStudents.execute(pagination.page, pagination.page_size);
    return toPage(result, pagination, presentStudent);
  }

  @Roles('admin', 'instructor')
  @Get('api/v1/students/:student_id')
  async get(@Param('student_id') studentId: string): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(parseInput(idSchema, studentId)));
  }
}
