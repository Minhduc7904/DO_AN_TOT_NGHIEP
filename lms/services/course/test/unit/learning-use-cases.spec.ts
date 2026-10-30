import { EnrollCourseUseCase } from '../../src/application/use-cases/learning/enroll-course.use-case.js';
import { GetMyCourseProgressUseCase } from '../../src/application/use-cases/learning/get-my-course-progress.use-case.js';
import { ListMyEnrollmentsUseCase } from '../../src/application/use-cases/learning/list-my-enrollments.use-case.js';
import { UpdateLessonProgressUseCase } from '../../src/application/use-cases/learning/update-lesson-progress.use-case.js';
import { clock, createWorld, NOW, principals } from '../support/in-memory.js';
import { enroll, seedCourse, seedLesson } from '../support/seed.js';

const studentId = principals.student.id;

describe('learning use cases', () => {
  it('EnrollCourse: chỉ ghi danh khóa PUBLISHED, trùng thì ENROLLMENT_ALREADY_EXISTS', async () => {
    const world = createWorld();
    const enrollCourse = new EnrollCourseUseCase(world.courses, world.enrollments, world.ids);
    const published = seedCourse(world, 'PUBLISHED');

    expect(await enrollCourse.execute(studentId, published.id)).toMatchObject({
      courseId: published.id,
      studentId,
    });
    await expect(enrollCourse.execute(studentId, published.id)).rejects.toMatchObject({
      code: 'ENROLLMENT_ALREADY_EXISTS',
      status: 409,
    });
    for (const status of ['DRAFT', 'ARCHIVED'] as const) {
      await expect(
        enrollCourse.execute(studentId, seedCourse(world, status).id),
      ).rejects.toMatchObject({
        code: 'COURSE_NOT_ENROLLABLE',
        status: 403,
      });
    }
    await expect(
      enrollCourse.execute(studentId, '00000000-0000-4000-8000-0000000000ff'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('ListMyEnrollments: chỉ ghi danh của chính học viên, có phân trang', async () => {
    const world = createWorld();
    const list = new ListMyEnrollmentsUseCase(world.enrollments);
    for (let index = 0; index < 3; index += 1) await enroll(world, seedCourse(world).id, studentId);
    await enroll(world, seedCourse(world).id, principals.otherStudent.id);

    expect(await list.execute(studentId, 1, 2)).toMatchObject({ total: 3 });
    expect((await list.execute(studentId, 2, 2)).items).toHaveLength(1);
  });

  it('UpdateLessonProgress: tiến độ chỉ tăng, 100% đánh dấu hoàn thành, cần ghi danh', async () => {
    const world = createWorld();
    const update = new UpdateLessonProgressUseCase(
      world.lessons,
      world.enrollments,
      world.progress,
      world.ids,
      clock,
    );
    const course = seedCourse(world);
    const lesson = await seedLesson(world, course.id);
    await enroll(world, course.id, studentId);

    expect(await update.execute(studentId, lesson.id, 40)).toMatchObject({
      progressPercent: 40,
      completedAt: null,
    });
    expect(await update.execute(studentId, lesson.id, 20)).toMatchObject({ progressPercent: 40 });
    expect(await update.execute(studentId, lesson.id, 100)).toMatchObject({
      progressPercent: 100,
      completedAt: NOW,
    });
    await expect(update.execute(principals.otherStudent.id, lesson.id, 10)).rejects.toMatchObject({
      code: 'STUDENT_NOT_ENROLLED',
    });
    await expect(
      update.execute(studentId, '00000000-0000-4000-8000-0000000000ff', 10),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('GetMyCourseProgress: phần trăm theo số bài đã hoàn thành, khóa không có bài thì 0%', async () => {
    const world = createWorld();
    const progress = new GetMyCourseProgressUseCase(
      world.lessons,
      world.enrollments,
      world.progress,
    );
    const update = new UpdateLessonProgressUseCase(
      world.lessons,
      world.enrollments,
      world.progress,
      world.ids,
      clock,
    );
    const course = seedCourse(world);
    const lessons = [
      await seedLesson(world, course.id),
      await seedLesson(world, course.id),
      await seedLesson(world, course.id),
    ];
    await enroll(world, course.id, studentId);

    await update.execute(studentId, lessons[0]!.id, 100);
    await update.execute(studentId, lessons[1]!.id, 30);
    expect(await progress.execute(studentId, course.id)).toMatchObject({
      totalLessons: 3,
      completedLessons: 1,
      percent: 33.33,
    });

    const empty = seedCourse(world);
    await enroll(world, empty.id, studentId);
    expect(await progress.execute(studentId, empty.id)).toMatchObject({
      totalLessons: 0,
      percent: 0,
    });
    await expect(progress.execute(principals.otherStudent.id, course.id)).rejects.toMatchObject({
      status: 403,
    });
  });
});
