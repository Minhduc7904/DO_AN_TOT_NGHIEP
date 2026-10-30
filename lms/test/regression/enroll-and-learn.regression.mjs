import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  attemptDetailDtoSchema,
  attemptDtoSchema,
  courseDetailDtoSchema,
  courseProgressDtoSchema,
  enrollmentDtoSchema,
  lessonDtoSchema,
  lessonProgressDtoSchema,
  quizDtoSchema,
} from '../../contracts/dist/index.js';
import {
  call,
  createPublishedCourse,
  expectData,
  expectError,
  expectList,
  loginInstructor,
  registerStudent,
} from './support/api.mjs';

const QUESTIONS = [
  {
    question_markdown: '2 + 2 = ?',
    question_type: 'SINGLE_CHOICE',
    points: 1.5,
    options: [
      { option_markdown: '3', is_correct: false },
      { option_markdown: '4', is_correct: true },
    ],
  },
  {
    question_markdown: 'Số nguyên tố?',
    question_type: 'MULTIPLE_CHOICE',
    points: 2,
    options: [
      { option_markdown: '2', is_correct: true },
      { option_markdown: '3', is_correct: true },
      { option_markdown: '4', is_correct: false },
    ],
  },
];

test('enroll-and-learn: ghi danh, học, tiến độ và làm quiz', async (t) => {
  const instructor = await loginInstructor();
  const student = await registerStudent('hoc-vien');
  const outsider = await registerStudent('ngoai-lop');
  const { courseId, lessons } = await createPublishedCourse(instructor.token, { lessonCount: 2 });
  const [lessonA] = lessons;
  let quiz;
  let attempt;

  await t.test('giảng viên thêm quiz; học viên chưa ghi danh không đọc được nội dung', async () => {
    const created = await call(
      'POST',
      `/api/v1/courses/${courseId}/lessons/${lessonA.id}/quizzes`,
      {
        token: instructor.token,
        body: { title: 'Quiz học', questions: QUESTIONS },
      },
    );
    quiz = expectData(created, 201, quizDtoSchema, 'tạo quiz');
    // Chi tiết khóa báo chưa ghi danh; danh sách bài học theo khóa bị chặn.
    const before = expectData(
      await call('GET', `/api/v1/courses/${courseId}`, { token: student.token }),
      200,
      courseDetailDtoSchema,
      'chi tiết khóa học',
    );
    assert.deepEqual(before.enrollment, { status: 'NOT_ENROLLED', enrolled_at: null });
    expectError(
      await call('GET', `/api/v1/courses/${courseId}/lessons`, { token: student.token }),
      403,
      'STUDENT_NOT_ENROLLED',
    );
  });

  await t.test('ghi danh 201, ghi danh lại 409, danh sách khóa đã ghi danh', async () => {
    const enrolled = await call('POST', `/api/v1/student/courses/${courseId}/enrollments`, {
      token: student.token,
    });
    const enrollment = expectData(enrolled, 201, enrollmentDtoSchema, 'ghi danh');
    assert.equal(enrollment.course_id, courseId);
    assert.equal(enrollment.student_id, student.id);

    expectError(
      await call('POST', `/api/v1/student/courses/${courseId}/enrollments`, {
        token: student.token,
      }),
      409,
      'ENROLLMENT_ALREADY_EXISTS',
    );
    const mine = await call('GET', '/api/v1/student/enrollments', { token: student.token });
    assert.ok(
      expectList(mine, enrollmentDtoSchema).items.some((item) => item.course_id === courseId),
    );

    const after = expectData(
      await call('GET', `/api/v1/courses/${courseId}`, { token: student.token }),
      200,
      courseDetailDtoSchema,
      'chi tiết khóa học',
    );
    assert.equal(after.enrollment.status, 'ENROLLED');
    assert.ok(after.enrollment.enrolled_at);
    const lessons = expectData(
      await call('GET', `/api/v1/courses/${courseId}/lessons`, { token: student.token }),
      200,
      lessonDtoSchema.array(),
      'danh sách bài học',
    );
    assert.equal(lessons.length, 2);
    assert.equal(lessons[0].content_markdown, 'Nội dung bài 1');
  });

  await t.test('tiến độ chỉ tăng, không giảm', async () => {
    const progressPath = `/api/v1/student/lessons/${lessonA.id}/progress`;
    const half = await call('PUT', progressPath, {
      token: student.token,
      body: { progress_percent: 50 },
    });
    assert.equal(expectData(half, 200, lessonProgressDtoSchema).completed_at, null);
    const done = await call('PUT', progressPath, {
      token: student.token,
      body: { progress_percent: 100 },
    });
    assert.notEqual(expectData(done, 200, lessonProgressDtoSchema).completed_at, null);
    const back = await call('PUT', progressPath, {
      token: student.token,
      body: { progress_percent: 10 },
    });
    assert.equal(expectData(back, 200, lessonProgressDtoSchema).progress_percent, 100);

    const progress = expectData(
      await call('GET', `/api/v1/student/courses/${courseId}/progress`, { token: student.token }),
      200,
      courseProgressDtoSchema,
    );
    assert.deepEqual(
      {
        total: progress.total_lessons,
        done: progress.completed_lessons,
        percent: progress.percent,
      },
      { total: 2, done: 1, percent: 50 },
    );
  });

  await t.test('quiz chỉ hiện khi PUBLISHED và ẩn đáp án đúng', async () => {
    const before = await call('GET', `/api/v1/student/lessons/${lessonA.id}/quizzes`, {
      token: student.token,
    });
    assert.deepEqual(expectData(before, 200), []);
    expectError(
      await call('GET', `/api/v1/student/quizzes/${quiz.id}`, { token: student.token }),
      404,
    );

    const published = await call(
      'PATCH',
      `/api/v1/courses/${courseId}/lessons/${lessonA.id}/quizzes/${quiz.id}`,
      {
        token: instructor.token,
        body: { status: 'PUBLISHED' },
      },
    );
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const view = expectData(
      await call('GET', `/api/v1/student/quizzes/${quiz.id}`, { token: student.token }),
      200,
      quizDtoSchema,
    );
    assert.equal(
      JSON.stringify(view).includes('is_correct'),
      false,
      'không lộ đáp án đúng khi chưa nộp',
    );
    expectError(
      await call('GET', `/api/v1/student/quizzes/${quiz.id}`, { token: outsider.token }),
      403,
    );
    quiz = view;
  });

  await t.test('làm bài: start 201, resume 200, lưu đáp án, nộp chấm đúng điểm', async () => {
    const started = await call('POST', `/api/v1/student/quizzes/${quiz.id}/attempts`, {
      token: student.token,
    });
    attempt = expectData(started, 201, attemptDtoSchema, 'bắt đầu làm bài');
    const resumed = await call('POST', `/api/v1/student/quizzes/${quiz.id}/attempts`, {
      token: student.token,
    });
    assert.equal(expectData(resumed, 200, attemptDtoSchema).id, attempt.id);

    const [single, multiple] = quiz.questions;
    expectError(
      await call('PUT', `/api/v1/student/attempts/${attempt.id}/answers`, {
        token: student.token,
        body: {
          answers: [
            { question_id: single.id, option_ids: single.options.map((option) => option.id) },
          ],
        },
      }),
      400,
      'VALIDATION_ERROR',
    );

    // Câu 1 đúng ("4"); câu 2 thiếu một đáp án đúng nên 0 điểm: 1.5/3.5.
    const saved = await call('PUT', `/api/v1/student/attempts/${attempt.id}/answers`, {
      token: student.token,
      body: {
        answers: [
          { question_id: single.id, option_ids: [single.options[1].id] },
          { question_id: multiple.id, option_ids: [multiple.options[0].id] },
        ],
      },
    });
    assert.equal(expectData(saved, 200, attemptDtoSchema).status, 'IN_PROGRESS');

    const submitted = expectData(
      await call('POST', `/api/v1/student/attempts/${attempt.id}/submit`, { token: student.token }),
      200,
      attemptDetailDtoSchema,
      'nộp bài',
    );
    assert.deepEqual(
      { status: submitted.status, score: submitted.score, max: submitted.max_score },
      { status: 'SUBMITTED', score: 1.5, max: 3.5 },
    );
    assert.deepEqual(
      submitted.quiz.questions[0].options.map((option) => option.is_correct),
      [false, true],
      'sau khi nộp mới thấy đáp án đúng',
    );

    expectError(
      await call('POST', `/api/v1/student/attempts/${attempt.id}/submit`, { token: student.token }),
      409,
      'QUIZ_ATTEMPT_ALREADY_SUBMITTED',
    );
  });

  await t.test('quiz đã có lượt làm: khóa cây câu hỏi và không xóa được', async () => {
    const quizPath = `/api/v1/courses/${courseId}/lessons/${lessonA.id}/quizzes/${quiz.id}`;
    expectError(
      await call('PATCH', quizPath, { token: instructor.token, body: { questions: QUESTIONS } }),
      409,
      'QUIZ_HAS_ATTEMPTS',
    );
    expectError(
      await call('DELETE', quizPath, { token: instructor.token }),
      409,
      'QUIZ_HAS_ATTEMPTS',
    );
  });
});
