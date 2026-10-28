import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import { Readable } from 'node:stream';

import {
  type CourseDetailDto,
  type CourseDto,
  type CourseSummaryDto,
  createCourseRequestSchema,
  exportCoursesQuerySchema,
  idSchema,
  listCoursesQuerySchema,
  updateCourseRequestSchema,
} from '@aiops-lms/contracts';
import {
  CurrentPrincipal,
  type Page,
  parseInput,
  RawResponse,
  Roles,
  toPage,
} from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';

import { CreateCourseUseCase } from '../../../application/use-cases/courses/create-course.use-case.js';
import { DeleteCourseUseCase } from '../../../application/use-cases/courses/delete-course.use-case.js';
import { ExportCoursesCsvUseCase } from '../../../application/use-cases/courses/export-courses-csv.use-case.js';
import { GetCourseSummaryUseCase } from '../../../application/use-cases/courses/get-course-summary.use-case.js';
import { GetCourseUseCase } from '../../../application/use-cases/courses/get-course.use-case.js';
import { ListCoursesUseCase } from '../../../application/use-cases/courses/list-courses.use-case.js';
import { UpdateCourseUseCase } from '../../../application/use-cases/courses/update-course.use-case.js';
import {
  presentCourse,
  presentCourseDetail,
  presentCourseSummary,
} from '../shared/course.presenter.js';

@Controller(`${PUBLIC_PREFIX}/courses`)
export class CourseController {
  constructor(
    @Inject(CreateCourseUseCase) private readonly createCourse: CreateCourseUseCase,
    @Inject(UpdateCourseUseCase) private readonly updateCourse: UpdateCourseUseCase,
    @Inject(DeleteCourseUseCase) private readonly deleteCourse: DeleteCourseUseCase,
    @Inject(ListCoursesUseCase) private readonly listCourses: ListCoursesUseCase,
    @Inject(GetCourseUseCase) private readonly getCourse: GetCourseUseCase,
    @Inject(GetCourseSummaryUseCase) private readonly getSummary: GetCourseSummaryUseCase,
    @Inject(ExportCoursesCsvUseCase) private readonly exportCsv: ExportCoursesCsvUseCase,
  ) {}

  @Roles('admin', 'instructor')
  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<CourseDto> {
    const input = parseInput(createCourseRequestSchema, body);
    return presentCourse(
      await this.createCourse.execute(principal, {
        name: input.name,
        descriptionMarkdown: input.description_markdown ?? null,
      }),
    );
  }

  @Get()
  async list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: unknown,
  ): Promise<Page<CourseDto>> {
    const input = parseInput(listCoursesQuerySchema, query);
    const result = await this.listCourses.execute(
      principal,
      { status: input.status, search: input.search },
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentCourse);
  }

  // `summary` và `export` phải đứng trước `:course_id` để không bị coi là id.
  @Roles('admin', 'instructor')
  @Get('summary')
  async summary(@CurrentPrincipal() principal: Principal): Promise<CourseSummaryDto> {
    return presentCourseSummary(await this.getSummary.execute(principal));
  }

  /** CSV streaming (BOM UTF-8, CRLF): không bọc envelope. */
  @RawResponse()
  @Roles('admin', 'instructor')
  @Get('export')
  export(@CurrentPrincipal() principal: Principal, @Query() query: unknown): StreamableFile {
    const input = parseInput(exportCoursesQuerySchema, query);
    const chunks = this.exportCsv.execute(principal, input.status);
    return new StreamableFile(Readable.from(chunks, { objectMode: false }), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="courses.csv"',
    });
  }

  @Get(':course_id')
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
  ): Promise<CourseDetailDto> {
    return presentCourseDetail(
      await this.getCourse.execute(principal, parseInput(idSchema, courseId)),
    );
  }

  @Roles('admin', 'instructor')
  @Patch(':course_id')
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Body() body: unknown,
  ): Promise<CourseDto> {
    const input = parseInput(updateCourseRequestSchema, body);
    return presentCourse(
      await this.updateCourse.execute(principal, parseInput(idSchema, courseId), {
        name: input.name,
        descriptionMarkdown: input.description_markdown,
        status: input.status,
      }),
    );
  }

  @Roles('admin', 'instructor')
  @Delete(':course_id')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
  ): Promise<void> {
    await this.deleteCourse.execute(principal, parseInput(idSchema, courseId));
  }
}
