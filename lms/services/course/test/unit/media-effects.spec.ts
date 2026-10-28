import { AppError } from '@aiops-lms/common/errors';

import { MediaUsageEffects, quizMarkdown } from '../../src/application/media-usage-effects.js';
import type { MediaUsageLookup } from '../../src/application/ports/media-effects.js';
import { CreateCourseUseCase } from '../../src/application/use-cases/courses/create-course.use-case.js';
import { DeleteCourseUseCase } from '../../src/application/use-cases/courses/delete-course.use-case.js';
import { UpdateCourseUseCase } from '../../src/application/use-cases/courses/update-course.use-case.js';
import { CreateLessonUseCase } from '../../src/application/use-cases/lessons/create-lesson.use-case.js';
import { DeleteLessonUseCase } from '../../src/application/use-cases/lessons/delete-lesson.use-case.js';
import { UpdateLessonUseCase } from '../../src/application/use-cases/lessons/update-lesson.use-case.js';
import { CreateQuizUseCase } from '../../src/application/use-cases/quizzes/create-quiz.use-case.js';
import { DeleteQuizUseCase } from '../../src/application/use-cases/quizzes/delete-quiz.use-case.js';
import { UpdateQuizUseCase } from '../../src/application/use-cases/quizzes/update-quiz.use-case.js';
import { createWorld, principals } from '../support/in-memory.js';
import { seedCourse, seedLesson, seedQuiz } from '../support/seed.js';

class StubLookup implements MediaUsageLookup {
  readonly asked: string[][] = [];
  failing = false;

  constructor(private readonly usagesByOwner: Record<string, string[]> = {}) {}

  findUsageIds(ownerIds: readonly string[]): Promise<string[]> {
    this.asked.push([...ownerIds]);
    if (this.failing) return Promise.reject(AppError.dependencyUnavailable('course-media'));
    return Promise.resolve(ownerIds.flatMap((id) => this.usagesByOwner[id] ?? []));
  }
}

function ref(
  courseId: string,
  lessonId: string,
  quizId: string,
): {
  courseId: string;
  lessonId: string;
  quizId: string;
} {
  return { courseId, lessonId, quizId };
}

const questions = [
  {
    questionMarkdown: 'Câu ![](/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content)',
    questionType: 'SINGLE_CHOICE' as const,
    points: 1,
    options: [
      { optionMarkdown: 'A', isCorrect: true },
      { optionMarkdown: 'B', isCorrect: false },
    ],
  },
];

describe('tác động media của course', () => {
  it('quizMarkdown gộp mô tả, câu hỏi và đáp án', async () => {
    const world = createWorld();
    const course = seedCourse(world, 'DRAFT');
    const lesson = await seedLesson(world, course.id);
    const quiz = await seedQuiz(world, lesson.id);

    const text = quizMarkdown('Mô tả', quiz.questions);

    expect(text).toContain('Mô tả');
    expect(text).toContain('Câu 1');
    expect(text).toContain('Lựa chọn 2');
    expect(quizMarkdown(null, [])).toBe('');
  });

  it('create/update course: đồng bộ markdown mô tả, bỏ qua khi không đụng tới mô tả', async () => {
    const world = createWorld();
    const create = new CreateCourseUseCase(world.courses, world.ids);
    const update = new UpdateCourseUseCase(world.courses);

    const course = await create.execute(principals.owner, {
      name: 'Khóa',
      descriptionMarkdown: 'Mô tả',
    });
    await create.execute(principals.owner, { name: 'Khóa 2', descriptionMarkdown: null });
    await update.execute(principals.owner, course.id, { name: 'Tên mới' });
    await update.execute(principals.owner, course.id, { descriptionMarkdown: null });

    expect(world.courses.effects).toEqual([
      {
        kind: 'sync-markdown-usage',
        ownerId: course.id,
        usageType: 'COURSE_DESCRIPTION',
        markdown: 'Mô tả',
        actorId: principals.owner.id,
      },
      {
        kind: 'sync-markdown-usage',
        ownerId: course.id,
        usageType: 'COURSE_DESCRIPTION',
        markdown: null,
        actorId: principals.owner.id,
      },
    ]);
  });

  it('create/update lesson: đồng bộ nội dung bài học với người thao tác', async () => {
    const world = createWorld();
    const course = seedCourse(world, 'DRAFT');
    const create = new CreateLessonUseCase(world.courses, world.lessons, world.ids);
    const update = new UpdateLessonUseCase(world.courses, world.lessons);

    const lesson = await create.execute(principals.owner, course.id, {
      title: 'Bài',
      contentMarkdown: 'Nội dung',
    });
    await update.execute(principals.admin, course.id, lesson.id, { title: 'Chỉ đổi tên' });
    await update.execute(principals.admin, course.id, lesson.id, { contentMarkdown: 'Mới' });

    const marked = world.lessons.effects.filter(
      (effect) => effect.kind === 'sync-markdown-usage' && effect.ownerId === lesson.id,
    );
    expect(
      marked.map((effect) => effect.kind === 'sync-markdown-usage' && effect.markdown),
    ).toEqual(['Nội dung', 'Mới']);
    expect(marked[1]).toMatchObject({ usageType: 'LESSON_CONTENT', actorId: principals.admin.id });
  });

  it('create/update quiz: markdown gồm cả câu hỏi/đáp án; update giữ phần không đổi', async () => {
    const world = createWorld();
    const course = seedCourse(world, 'DRAFT');
    const lesson = await seedLesson(world, course.id);
    const create = new CreateQuizUseCase(world.courses, world.lessons, world.quizzes, world.ids);
    const update = new UpdateQuizUseCase(world.courses, world.lessons, world.quizzes, world.ids);

    const quiz = await create.execute(principals.owner, course.id, lesson.id, {
      title: 'Quiz',
      descriptionMarkdown: 'Mô tả quiz',
      questions,
    });
    await update.execute(principals.owner, ref(course.id, lesson.id, quiz.id), {
      title: 'Đổi tên',
    });
    await update.execute(principals.owner, ref(course.id, lesson.id, quiz.id), {
      descriptionMarkdown: 'Mô tả mới',
    });

    expect(world.quizzes.effects).toHaveLength(2);
    const [created, updated] = world.quizzes.effects;
    expect(created).toMatchObject({ ownerId: quiz.id, usageType: 'QUIZ_CONTENT' });
    expect(created?.kind === 'sync-markdown-usage' && created.markdown).toContain(
      '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content',
    );
    expect(updated?.kind === 'sync-markdown-usage' && updated.markdown).toContain('Mô tả mới');
    expect(updated?.kind === 'sync-markdown-usage' && updated.markdown).toContain('Câu');
  });

  it('delete course: gom usage của course, mọi bài học và quiz rồi gửi một lần', async () => {
    const world = createWorld();
    const course = seedCourse(world, 'DRAFT');
    const lesson = await seedLesson(world, course.id);
    const quiz = await seedQuiz(world, lesson.id);
    const lookup = new StubLookup({
      [course.id]: ['u-course'],
      [lesson.id]: ['u-lesson'],
      [quiz.id]: ['u-quiz'],
    });
    const del = new DeleteCourseUseCase(
      world.courses,
      world.lessons,
      world.quizzes,
      new MediaUsageEffects(lookup),
    );

    await del.execute(principals.owner, course.id);

    expect(lookup.asked).toEqual([[course.id, lesson.id, quiz.id]]);
    expect(world.courses.effects).toEqual([
      { kind: 'delete-usages', usageIds: ['u-course', 'u-lesson', 'u-quiz'] },
    ]);
  });

  it('delete lesson/quiz: chỉ hỏi owner của phần bị xóa; không có usage thì không gửi command', async () => {
    const world = createWorld();
    const course = seedCourse(world, 'DRAFT');
    const lesson = await seedLesson(world, course.id);
    const quiz = await seedQuiz(world, lesson.id);
    const lookup = new StubLookup({ [quiz.id]: ['u-quiz'] });
    const media = new MediaUsageEffects(lookup);

    await new DeleteQuizUseCase(world.courses, world.lessons, world.quizzes, media).execute(
      principals.owner,
      { courseId: course.id, lessonId: lesson.id, quizId: quiz.id },
    );
    await new DeleteLessonUseCase(world.courses, world.lessons, world.quizzes, media).execute(
      principals.owner,
      course.id,
      lesson.id,
    );

    expect(lookup.asked).toEqual([[quiz.id], [lesson.id]]);
    expect(world.quizzes.effects).toEqual([{ kind: 'delete-usages', usageIds: ['u-quiz'] }]);
    expect(world.lessons.effects).toEqual([]);
  });

  it('media không trả lời thì xóa thất bại và không có gì bị xóa', async () => {
    const world = createWorld();
    const course = seedCourse(world, 'DRAFT');
    const lookup = new StubLookup();
    lookup.failing = true;
    const del = new DeleteCourseUseCase(
      world.courses,
      world.lessons,
      world.quizzes,
      new MediaUsageEffects(lookup),
    );

    await expect(del.execute(principals.owner, course.id)).rejects.toMatchObject({ status: 503 });
    expect(world.courses.rows.has(course.id)).toBe(true);
  });
});
