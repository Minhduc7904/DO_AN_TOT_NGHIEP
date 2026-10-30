import {
  idSchema,
  listStudentsQuerySchema,
  PUBLIC_PREFIX,
  type StudentDto,
} from '@aiops-lms/contracts/http';
import { CurrentPrincipal, type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { GetStudentUseCase } from '../../../application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../../application/use-cases/students/list-students.use-case.js';
import { presentStudent } from '../shared/student.presenter.js';

/** Bề mặt public: chỉ Gateway gọi, danh tính user do Gateway chuyển qua `x-principal-*`. */
@Controller(`${PUBLIC_PREFIX}/students`)
export class StudentController {
  constructor(
    @Inject(GetStudentUseCase) private readonly getStudent: GetStudentUseCase,
    @Inject(ListStudentsUseCase) private readonly listStudents: ListStudentsUseCase,
  ) {}

  @Roles('student')
  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(principal.id));
  }

  @Roles('admin', 'instructor')
  @Get()
  async list(@Query() query: unknown): Promise<Page<StudentDto>> {
    const pagination = parseInput(listStudentsQuerySchema, query);
    const result = await this.listStudents.execute(pagination.page, pagination.page_size);
    return toPage(result, pagination, presentStudent);
  }

  @Roles('admin', 'instructor')
  @Get(':student_id')
  async get(@Param('student_id') studentId: string): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(parseInput(idSchema, studentId)));
  }
}
