import { GetMyAttemptUseCase } from '../../src/application/use-cases/student-quizzes/get-my-attempt.use-case.js';
import { GetStudentQuizUseCase } from '../../src/application/use-cases/student-quizzes/get-student-quiz.use-case.js';
import { ListMyAttemptsUseCase } from '../../src/application/use-cases/student-quizzes/list-my-attempts.use-case.js';
import { ListStudentLessonQuizzesUseCase } from '../../src/application/use-cases/student-quizzes/list-student-lesson-quizzes.use-case.js';
import { SaveAttemptAnswersUseCase } from '../../src/application/use-cases/student-quizzes/save-attempt-answers.use-case.js';
import { StartQuizAttemptUseCase } from '../../src/application/use-cases/student-quizzes/start-quiz-attempt.use-case.js';
import { SubmitQuizAttemptUseCase } from '../../src/application/use-cases/student-quizzes/submit-quiz-attempt.use-case.js';
import type { Course, Lesson, Quiz } from '../../src/domain/course.js';
import { QuizGrader } from '../../src/domain/quiz-grader.js';
import { clock, createWorld, NOW, principals } from '../support/in-memory.js';
import { enroll, seedCourse, seedLesson, seedQuiz, type World } from '../support/seed.js';

const studentId = principals.student.id;

interface Fixture {
  world: World;
  course: Course;
  lesson: Lesson;
  quiz: Quiz;
  list: ListStudentLessonQuizzesUseCase;
  get: GetStudentQuizUseCase;
  start: StartQuizAttemptUseCase;
  save: SaveAttemptAnswersUseCase;
  submit: SubmitQuizAttemptUseCase;
  history: ListMyAttemptsUseCase;
  detail: GetMyAttemptUseCase;
}

async function setup(): Promise<Fixture> {
  const world = createWorld();
  const course = seedCourse(world);
  const lesson = await seedLesson(world, course.id);
  const quiz = await seedQuiz(world, lesson.id, 'PUBLISHED');
  await enroll(world, course.id, studentId);
  return {
    world,
    course,
    lesson,
    quiz,
    list: new ListStudentLessonQuizzesUseCase(world.lessons, world.enrollments, world.quizzes),
    get: new GetStudentQuizUseCase(world.quizzes, world.lessons, world.enrollments),
    start: new StartQuizAttemptUseCase(
      world.quizzes,
      world.lessons,
      world.enrollments,
      world.attempts,
      world.ids,
      clock,
    ),
    save: new SaveAttemptAnswersUseCase(world.attempts, world.quizzes),
    submit: new SubmitQuizAttemptUseCase(world.attempts, world.quizzes, new QuizGrader(), clock),
    history: new ListMyAttemptsUseCase(
      world.quizzes,
      world.lessons,
      world.enrollments,
      world.attempts,
    ),
    detail: new GetMyAttemptUseCase(world.attempts, world.quizzes),
  };
}

describe('student quiz use cases', () => {
  it('ListStudentLessonQuizzes và GetStudentQuiz: chỉ quiz PUBLISHED của khóa đã ghi danh', async () => {
    const { world, lesson, quiz, list, get } = await setup();
    const draft = await seedQuiz(world, lesson.id, 'DRAFT');

    expect((await list.execute(studentId, lesson.id)).map((item) => item.id)).toEqual([quiz.id]);
    expect((await get.execute(studentId, quiz.id)).id).toBe(quiz.id);
    await expect(get.execute(studentId, draft.id)).rejects.toMatchObject({ status: 404 });
    await expect(get.execute(principals.otherStudent.id, quiz.id)).rejects.toMatchObject({
      code: 'STUDENT_NOT_ENROLLED',
    });
    await expect(list.execute(principals.otherStudent.id, lesson.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      list.execute(studentId, '00000000-0000-4000-8000-0000000000ff'),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('StartQuizAttempt: lượt mới rồi tiếp tục lượt đang làm, nộp xong thì mở lượt mới', async () => {
    const { quiz, start, submit } = await setup();

    const first = await start.execute(studentId, quiz.id);
    expect(first).toMatchObject({
      resumed: false,
      attempt: { status: 'IN_PROGRESS', startedAt: NOW },
    });
    const again = await start.execute(studentId, quiz.id);
    expect(again).toMatchObject({ resumed: true });
    expect(again.attempt.id).toBe(first.attempt.id);

    await submit.execute(studentId, first.attempt.id);
    const next = await start.execute(studentId, quiz.id);
    expect(next.resumed).toBe(false);
    expect(next.attempt.id).not.toBe(first.attempt.id);
    await expect(start.execute(principals.otherStudent.id, quiz.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('SaveAttemptAnswers: kiểm tra câu hỏi/lựa chọn thuộc quiz, thay toàn bộ, bỏ câu trống', async () => {
    const { quiz, start, save } = await setup();
    const { attempt } = await start.execute(studentId, quiz.id);
    const [single, multiple] = quiz.questions;

    const saved = await save.execute(studentId, attempt.id, [
      { questionId: single!.id, optionIds: [single!.options[0]!.id] },
      { questionId: multiple!.id, optionIds: [] },
    ]);
    expect(saved.answers).toEqual([
      { questionId: single!.id, optionIds: [single!.options[0]!.id] },
    ]);
    expect((await save.execute(studentId, attempt.id, [])).answers).toEqual([]);

    const invalid = [
      [{ questionId: '00000000-0000-4000-8000-0000000000ff', optionIds: [] }],
      [{ questionId: single!.id, optionIds: ['00000000-0000-4000-8000-0000000000ff'] }],
      [{ questionId: single!.id, optionIds: [single!.options[0]!.id, single!.options[1]!.id] }],
      [
        {
          questionId: multiple!.id,
          optionIds: [multiple!.options[0]!.id, multiple!.options[0]!.id],
        },
      ],
      [
        { questionId: single!.id, optionIds: [single!.options[0]!.id] },
        { questionId: single!.id, optionIds: [single!.options[1]!.id] },
      ],
    ];
    for (const answers of invalid) {
      await expect(save.execute(studentId, attempt.id, answers)).rejects.toMatchObject({
        status: 400,
      });
    }
    // Nhiều lựa chọn hợp lệ cho câu MULTIPLE_CHOICE.
    expect(
      (
        await save.execute(studentId, attempt.id, [
          {
            questionId: multiple!.id,
            optionIds: [multiple!.options[0]!.id, multiple!.options[1]!.id],
          },
        ])
      ).answers,
    ).toHaveLength(1);
    await expect(save.execute(principals.otherStudent.id, attempt.id, [])).rejects.toMatchObject({
      status: 404,
    });
  });

  it('SubmitQuizAttempt: chấm bằng QuizGrader, chốt max_score, nộp lại hoặc lưu sau nộp thì 409', async () => {
    const { world, quiz, start, save, submit } = await setup();
    const { attempt } = await start.execute(studentId, quiz.id);
    const [single, multiple] = quiz.questions;
    await save.execute(studentId, attempt.id, [
      { questionId: single!.id, optionIds: [single!.options[0]!.id] },
      { questionId: multiple!.id, optionIds: [multiple!.options[0]!.id] },
    ]);

    const result = await submit.execute(studentId, attempt.id);
    expect(result.attempt).toMatchObject({
      status: 'SUBMITTED',
      score: 1,
      maxScore: 3,
      submittedAt: NOW,
    });

    // Sửa quiz sau đó không đổi điểm tối đa đã chốt.
    world.quizzes.rows.set(quiz.id, { ...quiz, questions: [] });
    expect((await world.attempts.findById(attempt.id))?.maxScore).toBe(3);

    await expect(submit.execute(studentId, attempt.id)).rejects.toMatchObject({
      code: 'QUIZ_ATTEMPT_ALREADY_SUBMITTED',
      status: 409,
    });
    await expect(save.execute(studentId, attempt.id, [])).rejects.toMatchObject({
      code: 'QUIZ_ATTEMPT_ALREADY_SUBMITTED',
    });
    await expect(submit.execute(principals.otherStudent.id, attempt.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('ListMyAttempts và GetMyAttempt: chỉ lượt của chính học viên', async () => {
    const { quiz, start, submit, history, detail } = await setup();
    const first = (await start.execute(studentId, quiz.id)).attempt;
    await submit.execute(studentId, first.id);
    await start.execute(studentId, quiz.id);

    expect(await history.execute(studentId, quiz.id, 1, 10)).toMatchObject({ total: 2 });
    expect((await history.execute(studentId, quiz.id, 2, 1)).items).toHaveLength(1);
    await expect(history.execute(principals.otherStudent.id, quiz.id, 1, 10)).rejects.toMatchObject(
      {
        status: 403,
      },
    );

    const found = await detail.execute(studentId, first.id);
    expect(found.attempt.id).toBe(first.id);
    expect(found.quiz.id).toBe(quiz.id);
    await expect(detail.execute(principals.otherStudent.id, first.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
