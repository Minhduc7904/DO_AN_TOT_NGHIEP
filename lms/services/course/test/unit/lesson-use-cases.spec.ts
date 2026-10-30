import { CreateLessonUseCase } from '../../src/application/use-cases/lessons/create-lesson.use-case.js';
import { DeleteLessonUseCase } from '../../src/application/use-cases/lessons/delete-lesson.use-case.js';
import { GetLessonUseCase } from '../../src/application/use-cases/lessons/get-lesson.use-case.js';
import { ListCourseLessonsUseCase } from '../../src/application/use-cases/lessons/list-course-lessons.use-case.js';
import { ReorderLessonsUseCase } from '../../src/application/use-cases/lessons/reorder-lessons.use-case.js';
import { UpdateLessonUseCase } from '../../src/application/use-cases/lessons/update-lesson.use-case.js';
import { createWorld, principals } from '../support/in-memory.js';
import { enroll, seedCourse, seedLesson } from '../support/seed.js';

describe('lesson use cases', () => {
  it('CreateLesson: thêm vào cuối, trùng display_order thì LESSON_ORDER_CONFLICT, người khác bị 403', async () => {
    const world = createWorld();
    const create = new CreateLessonUseCase(world.courses, world.lessons, world.ids);
    const course = seedCourse(world, 'DRAFT');

    const first = await create.execute(principals.owner, course.id, {
      title: 'A',
      contentMarkdown: null,
    });
    const second = await create.execute(principals.owner, course.id, {
      title: 'B',
      contentMarkdown: 'b',
    });
    expect([first.displayOrder, second.displayOrder]).toEqual([1, 2]);

    await expect(
      create.execute(principals.owner, course.id, {
        title: 'C',
        contentMarkdown: null,
        displayOrder: 1,
      }),
    ).rejects.toMatchObject({ code: 'LESSON_ORDER_CONFLICT', status: 409 });
    await expect(
      create.execute(principals.otherInstructor, course.id, { title: 'C', contentMarkdown: null }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      create.execute(principals.owner, '00000000-0000-4000-8000-0000000000ff', {
        title: 'C',
        contentMarkdown: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('UpdateLesson: sửa tiêu đề/nội dung, bài của khóa khác coi như không tồn tại', async () => {
    const world = createWorld();
    const update = new UpdateLessonUseCase(world.courses, world.lessons);
    const course = seedCourse(world);
    const other = seedCourse(world);
    const lesson = await seedLesson(world, course.id);

    expect(
      await update.execute(principals.owner, course.id, lesson.id, {
        title: 'Mới',
        contentMarkdown: null,
      }),
    ).toMatchObject({ title: 'Mới', contentMarkdown: null });
    await expect(
      update.execute(principals.owner, other.id, lesson.id, { title: 'x' }),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      update.execute(principals.otherInstructor, course.id, lesson.id, { title: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('DeleteLesson và GetLesson: chỉ người quản lý khóa học', async () => {
    const world = createWorld();
    const remove = new DeleteLessonUseCase(world.courses, world.lessons);
    const get = new GetLessonUseCase(world.courses, world.lessons);
    const course = seedCourse(world);
    const lesson = await seedLesson(world, course.id);

    expect((await get.execute(principals.admin, course.id, lesson.id)).contentMarkdown).toBe(
      'Nội dung',
    );
    await expect(get.execute(principals.student, course.id, lesson.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      remove.execute(principals.otherInstructor, course.id, lesson.id),
    ).rejects.toMatchObject({
      status: 403,
    });
    await remove.execute(principals.owner, course.id, lesson.id);
    await expect(get.execute(principals.owner, course.id, lesson.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('ReorderLessons: hoán đổi đúng tập; thiếu, thừa, trùng hoặc lạ thì LESSON_ORDER_CONFLICT', async () => {
    const world = createWorld();
    const reorder = new ReorderLessonsUseCase(world.courses, world.lessons);
    const course = seedCourse(world);
    const a = await seedLesson(world, course.id);
    const b = await seedLesson(world, course.id);
    const c = await seedLesson(world, course.id);

    const result = await reorder.execute(principals.owner, course.id, [c.id, a.id, b.id]);
    expect(result.map((lesson) => [lesson.id, lesson.displayOrder])).toEqual([
      [c.id, 1],
      [a.id, 2],
      [b.id, 3],
    ]);

    for (const ids of [
      [a.id, b.id],
      [a.id, a.id, b.id],
      [a.id, b.id, c.id, a.id],
      [a.id, b.id, '00000000-0000-4000-8000-0000000000ff'],
    ]) {
      await expect(reorder.execute(principals.owner, course.id, ids)).rejects.toMatchObject({
        code: 'LESSON_ORDER_CONFLICT',
      });
    }
    await expect(
      reorder.execute(principals.otherInstructor, course.id, [a.id, b.id, c.id]),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
  it('ListCourseLessons: học viên phải ghi danh, giảng viên phải sở hữu khóa, kèm nội dung theo thứ tự', async () => {
    const world = createWorld();
    const list = new ListCourseLessonsUseCase(world.courses, world.lessons, world.enrollments);
    const course = seedCourse(world, 'PUBLISHED');
    const first = await seedLesson(world, course.id);
    const second = await seedLesson(world, course.id);

    // Học viên chưa ghi danh, hoặc khóa không tồn tại: cùng một lỗi, không lộ khóa.
    await expect(list.execute(principals.student, course.id)).rejects.toMatchObject({
      code: 'STUDENT_NOT_ENROLLED',
      status: 403,
    });
    await expect(
      list.execute(principals.student, '00000000-0000-4000-8000-0000000000ff'),
    ).rejects.toMatchObject({ code: 'STUDENT_NOT_ENROLLED', status: 403 });

    await enroll(world, course.id, principals.student.id);
    const lessons = await list.execute(principals.student, course.id);
    expect(lessons.map((lesson) => lesson.id)).toEqual([first.id, second.id]);
    expect(lessons[0]?.contentMarkdown).toBe('Nội dung');
    // Ghi danh của học viên này không mở khóa cho học viên khác.
    await expect(list.execute(principals.otherStudent, course.id)).rejects.toMatchObject({
      status: 403,
    });

    expect(await list.execute(principals.owner, course.id)).toHaveLength(2);
    expect(await list.execute(principals.admin, course.id)).toHaveLength(2);
    await expect(list.execute(principals.otherInstructor, course.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      list.execute(principals.admin, '00000000-0000-4000-8000-0000000000ff'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
