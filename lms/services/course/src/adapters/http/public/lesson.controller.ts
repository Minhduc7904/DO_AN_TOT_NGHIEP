import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import {
  createLessonRequestSchema,
  idSchema,
  type LessonDto,
  reorderLessonsRequestSchema,
  updateLessonRequestSchema,
} from '@aiops-lms/contracts';
import { CurrentPrincipal, parseInput, Roles } from '@aiops-lms/common/http';
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
  Put,
} from '@nestjs/common';

import { CreateLessonUseCase } from '../../../application/use-cases/lessons/create-lesson.use-case.js';
import { DeleteLessonUseCase } from '../../../application/use-cases/lessons/delete-lesson.use-case.js';
import { GetLessonUseCase } from '../../../application/use-cases/lessons/get-lesson.use-case.js';
import { ListCourseLessonsUseCase } from '../../../application/use-cases/lessons/list-course-lessons.use-case.js';
import { ReorderLessonsUseCase } from '../../../application/use-cases/lessons/reorder-lessons.use-case.js';
import { UpdateLessonUseCase } from '../../../application/use-cases/lessons/update-lesson.use-case.js';
import { presentLesson } from '../shared/course.presenter.js';

@Roles('admin', 'instructor')
@Controller(`${PUBLIC_PREFIX}/courses/:course_id/lessons`)
export class LessonController {
  constructor(
    @Inject(CreateLessonUseCase) private readonly createLesson: CreateLessonUseCase,
    @Inject(UpdateLessonUseCase) private readonly updateLesson: UpdateLessonUseCase,
    @Inject(DeleteLessonUseCase) private readonly deleteLesson: DeleteLessonUseCase,
    @Inject(GetLessonUseCase) private readonly getLesson: GetLessonUseCase,
    @Inject(ListCourseLessonsUseCase) private readonly listLessons: ListCourseLessonsUseCase,
    @Inject(ReorderLessonsUseCase) private readonly reorderLessons: ReorderLessonsUseCase,
  ) {}

  /** Học viên chỉ đọc được khi đã ghi danh; admin và giảng viên khi được quản lý khóa học. */
  @Roles('admin', 'instructor', 'student')
  @Get()
  async list(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
  ): Promise<LessonDto[]> {
    const lessons = await this.listLessons.execute(principal, parseInput(idSchema, courseId));
    return lessons.map(presentLesson);
  }

  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Body() body: unknown,
  ): Promise<LessonDto> {
    const input = parseInput(createLessonRequestSchema, body);
    return presentLesson(
      await this.createLesson.execute(principal, parseInput(idSchema, courseId), {
        title: input.title,
        contentMarkdown: input.content_markdown ?? null,
        displayOrder: input.display_order,
      }),
    );
  }

  // `reorder` đứng trước `:lesson_id` để không bị coi là id.
  @Put('reorder')
  async reorder(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Body() body: unknown,
  ): Promise<LessonDto[]> {
    const input = parseInput(reorderLessonsRequestSchema, body);
    const lessons = await this.reorderLessons.execute(
      principal,
      parseInput(idSchema, courseId),
      input.lesson_ids,
    );
    return lessons.map(presentLesson);
  }

  @Get(':lesson_id')
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
  ): Promise<LessonDto> {
    return presentLesson(
      await this.getLesson.execute(
        principal,
        parseInput(idSchema, courseId),
        parseInput(idSchema, lessonId),
      ),
    );
  }

  @Patch(':lesson_id')
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Body() body: unknown,
  ): Promise<LessonDto> {
    const input = parseInput(updateLessonRequestSchema, body);
    return presentLesson(
      await this.updateLesson.execute(
        principal,
        parseInput(idSchema, courseId),
        parseInput(idSchema, lessonId),
        { title: input.title, contentMarkdown: input.content_markdown },
      ),
    );
  }

  @Delete(':lesson_id')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
  ): Promise<void> {
    await this.deleteLesson.execute(
      principal,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
    );
  }
}
