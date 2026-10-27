import { CurrentPrincipal, parseInput, Public, Roles, z } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';

import { CreateStudentUseCase } from '../../application/use-cases/students/create-student.use-case.js';
import { GetStudentUseCase } from '../../application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../application/use-cases/students/list-students.use-case.js';
import { presentStudent } from './student.presenter.js';

const idSchema = z.uuid();
const createSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  full_name: z.string().trim().min(1).max(200),
});
const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

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
  async create(@Body() body: unknown): Promise<Record<string, unknown>> {
    const input = parseInput(createSchema, body);
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
  async me(@CurrentPrincipal() principal: Principal): Promise<Record<string, unknown>> {
    return presentStudent(await this.getStudent.execute(principal.id));
  }

  @Roles('admin', 'instructor')
  @Get('api/v1/students')
  async list(@Query() query: unknown): Promise<Record<string, unknown>> {
    const { page, page_size } = parseInput(listSchema, query);
    const result = await this.listStudents.execute(page, page_size);
    return {
      items: result.items.map(presentStudent),
      page,
      page_size,
      total: result.total,
    };
  }

  @Roles('admin', 'instructor')
  @Get('api/v1/students/:student_id')
  async get(@Param('student_id') studentId: string): Promise<Record<string, unknown>> {
    return presentStudent(await this.getStudent.execute(parseInput(idSchema, studentId)));
  }
}
