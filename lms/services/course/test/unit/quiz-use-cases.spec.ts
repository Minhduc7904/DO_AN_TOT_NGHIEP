import { CreateQuizUseCase } from '../../src/application/use-cases/quizzes/create-quiz.use-case.js';
import { DeleteQuizUseCase } from '../../src/application/use-cases/quizzes/delete-quiz.use-case.js';
import { GetQuizUseCase } from '../../src/application/use-cases/quizzes/get-quiz.use-case.js';
import { ListLessonQuizzesUseCase } from '../../src/application/use-cases/quizzes/list-lesson-quizzes.use-case.js';
import { UpdateQuizUseCase } from '../../src/application/use-cases/quizzes/update-quiz.use-case.js';
import type { QuestionDraft } from '../../src/domain/quiz-content.js';
import { createWorld, principals } from '../support/in-memory.js';
import { seedCourse, seedLesson, seedQuiz } from '../support/seed.js';

const questions: QuestionDraft[] = [
  {
    questionMarkdown: 'Câu 1',
    questionType: 'SINGLE_CHOICE',
    points: 1,
    options: [
      { optionMarkdown: 'A', isCorrect: true },
      { optionMarkdown: 'B', isCorrect: false },
    ],
  },
];

async function setup(): Promise<{
  world: ReturnType<typeof createWorld>;
  ref: { courseId: string; lessonId: string };
}> {
  const world = createWorld();
  const course = seedCourse(world, 'DRAFT');
  const lesson = await seedLesson(world, course.id);
  return { world, ref: { courseId: course.id, lessonId: lesson.id } };
}

describe('quiz use cases', () => {
  it('CreateQuiz: quiz DRAFT với cây câu hỏi có id và thứ tự; nội dung sai thì 400', async () => {
    const { world, ref } = await setup();
    const create = new CreateQuizUseCase(world.courses, world.lessons, world.quizzes, world.ids);

    const quiz = await create.execute(principals.owner, ref.courseId, ref.lessonId, {
      title: '  Quiz  ',
      descriptionMarkdown: null,
      questions,
    });
    expect(quiz).toMatchObject({ title: 'Quiz', status: 'DRAFT', displayOrder: 1 });
    expect(quiz.questions[0]).toMatchObject({ displayOrder: 1 });
    expect(quiz.questions[0]?.options.map((option) => option.displayOrder)).toEqual([1, 2]);

    await expect(
      create.execute(principals.owner, ref.courseId, ref.lessonId, {
        title: 'x',
        descriptionMarkdown: null,
        questions: [],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      create.execute(principals.owner, ref.courseId, ref.lessonId, {
        title: 'Quiz',
        descriptionMarkdown: null,
        questions: [{ ...questions[0]!, points: -1 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      create.execute(principals.otherInstructor, ref.courseId, ref.lessonId, {
        title: 'Quiz',
        descriptionMarkdown: null,
        questions: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('UpdateQuiz: sửa tiêu đề, thay cây câu hỏi, xuất bản cần câu hỏi, khóa khi đã có lượt làm', async () => {
    const { world, ref } = await setup();
    const update = new UpdateQuizUseCase(world.courses, world.lessons, world.quizzes, world.ids);
    const empty = await seedQuiz(world, ref.lessonId, 'DRAFT');
    world.quizzes.rows.set(empty.id, { ...empty, questions: [] });
    const quizRef = { ...ref, quizId: empty.id };

    await expect(
      update.execute(principals.owner, quizRef, { status: 'PUBLISHED' }),
    ).rejects.toMatchObject({
      status: 400,
    });
    // Thay cây câu hỏi và xuất bản trong cùng một lần cập nhật.
    const updated = await update.execute(principals.owner, quizRef, {
      questions,
      status: 'PUBLISHED',
    });
    expect(updated).toMatchObject({ status: 'PUBLISHED' });
    expect(updated.questions).toHaveLength(1);

    expect(
      await update.execute(principals.owner, quizRef, {
        title: 'Tên mới',
        descriptionMarkdown: 'mô tả',
      }),
    ).toMatchObject({
      title: 'Tên mới',
      descriptionMarkdown: 'mô tả',
    });
    await expect(update.execute(principals.owner, quizRef, { title: 'x' })).rejects.toMatchObject({
      status: 400,
    });

    world.quizzes.attemptedQuizIds.add(empty.id);
    await expect(update.execute(principals.owner, quizRef, { questions })).rejects.toMatchObject({
      code: 'QUIZ_HAS_ATTEMPTS',
      status: 409,
    });
    // Đổi metadata và hủy xuất bản vẫn được khi đã có lượt làm.
    expect(await update.execute(principals.owner, quizRef, { status: 'DRAFT' })).toMatchObject({
      status: 'DRAFT',
    });
    await expect(
      update.execute(principals.otherInstructor, quizRef, { title: 'Quiz' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      update.execute(
        principals.owner,
        { ...quizRef, quizId: '00000000-0000-4000-8000-0000000000ff' },
        {},
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('DeleteQuiz: chặn khi đã có lượt làm bài', async () => {
    const { world, ref } = await setup();
    const remove = new DeleteQuizUseCase(world.courses, world.lessons, world.quizzes);
    const quiz = await seedQuiz(world, ref.lessonId, 'DRAFT');
    const quizRef = { ...ref, quizId: quiz.id };

    world.quizzes.attemptedQuizIds.add(quiz.id);
    await expect(remove.execute(principals.owner, quizRef)).rejects.toMatchObject({
      code: 'QUIZ_HAS_ATTEMPTS',
    });
    world.quizzes.attemptedQuizIds.clear();
    await expect(remove.execute(principals.otherInstructor, quizRef)).rejects.toMatchObject({
      status: 403,
    });
    await remove.execute(principals.owner, quizRef);
    expect(world.quizzes.rows.has(quiz.id)).toBe(false);
  });

  it('GetQuiz và ListLessonQuizzes: người quản lý thấy cả quiz DRAFT kèm đáp án', async () => {
    const { world, ref } = await setup();
    const get = new GetQuizUseCase(world.courses, world.lessons, world.quizzes);
    const list = new ListLessonQuizzesUseCase(world.courses, world.lessons, world.quizzes);
    const draft = await seedQuiz(world, ref.lessonId, 'DRAFT');
    await seedQuiz(world, ref.lessonId, 'PUBLISHED');

    const quiz = await get.execute(principals.admin, { ...ref, quizId: draft.id });
    expect(quiz.questions[0]?.options.some((option) => option.isCorrect)).toBe(true);
    expect(await list.execute(principals.owner, ref.courseId, ref.lessonId)).toHaveLength(2);
    await expect(
      list.execute(principals.student, ref.courseId, ref.lessonId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      get.execute(principals.owner, { ...ref, quizId: '00000000-0000-4000-8000-0000000000ff' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
