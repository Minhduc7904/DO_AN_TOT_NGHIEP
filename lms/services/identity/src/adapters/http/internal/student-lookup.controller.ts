import { InternalApi, type Page, parseInput, toPage } from '@aiops-lms/common/http';
import {
  idSchema,
  INTERNAL_PREFIX,
  listStudentsQuerySchema,
  type StudentDto,
} from '@aiops-lms/contracts/http';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { GetStudentUseCase } from '../../../application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../../application/use-cases/students/list-students.use-case.js';
import { presentStudent } from '../shared/student.presenter.js';

/** Bề mặt nội bộ cho service khác (media, notification-worker); không qua Gateway, cần service token. */
@Controller(`${INTERNAL_PREFIX}/students`)
export class StudentInternalController {
  constructor(
    @Inject(GetStudentUseCase) private readonly getStudent: GetStudentUseCase,
    @Inject(ListStudentsUseCase) private readonly listStudents: ListStudentsUseCase,
  ) {}

  /** Student `ACTIVE` theo trang (id tăng dần) để notification-worker snapshot recipient. */
  @InternalApi({ scopes: ['student:profile:read'] })
  @Get()
  async list(@Query() query: unknown): Promise<Page<StudentDto>> {
    const pagination = parseInput(listStudentsQuerySchema, query);
    const result = await this.listStudents.execute(pagination.page, pagination.page_size, 'ACTIVE');
    return toPage(result, pagination, presentStudent);
  }

  /** Kiểm tra hồ sơ trước khi dùng (avatar, gửi thông báo); 404 khi chưa có hồ sơ. */
  @InternalApi({ scopes: ['student:profile:read'] })
  @Get(':student_id')
  async get(@Param('student_id') studentId: string): Promise<StudentDto> {
    return presentStudent(await this.getStudent.execute(parseInput(idSchema, studentId)));
  }
}
