import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  courseDetailDtoSchema,
  courseDtoSchema,
  courseSummaryDtoSchema,
  lessonDtoSchema,
  quizDtoSchema,
} from '../../contracts/dist/index.js';
import {
  call,
  expectData,
  expectError,
  expectList,
  loginInstructor,
  registerStudent,
  unique,
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
];

test('course-authoring: giảng viên dựng khóa học, bài học, quiz và xuất bản', async (t) => {
  const instructor = await loginInstructor();
  const student = await registerStudent('tac-gia');
  const name = unique('Khóa học tác giả');
  let courseId;
  const lessons = [];

  await t.test('tạo khóa học DRAFT; student không được tạo (403)', async () => {
    const created = await call('POST', '/api/v1/courses', {
      token: instructor.token,
      body: { name, description_markdown: 'Mô tả' },
    });
    const course = expectData(created, 201, courseDtoSchema, 'tạo khóa học');
    assert.equal(course.status, 'DRAFT');
    assert.equal(course.instructor_id, instructor.id);
    courseId = course.id;

    expectError(
      await call('POST', '/api/v1/courses', { token: student.token, body: { name } }),
      403,
    );
  });

  await t.test('thêm bài học, trùng thứ tự bị 409, sắp xếp lại và sửa nội dung', async () => {
    for (const title of ['Bài A', 'Bài B']) {
      const lesson = await call('POST', `/api/v1/courses/${courseId}/lessons`, {
        token: instructor.token,
        body: { title, content_markdown: `Nội dung ${title}` },
      });
      lessons.push(expectData(lesson, 201, lessonDtoSchema, 'tạo bài học'));
    }
    assert.deepEqual(
      lessons.map((lesson) => lesson.display_order),
      [1, 2],
    );

    const duplicate = await call('POST', `/api/v1/courses/${courseId}/lessons`, {
      token: instructor.token,
      body: { title: 'Trùng thứ tự', display_order: 1 },
    });
    expectError(duplicate, 409, 'LESSON_ORDER_CONFLICT');

    const reordered = await call('PUT', `/api/v1/courses/${courseId}/lessons/reorder`, {
      token: instructor.token,
      body: { lesson_ids: [lessons[1].id, lessons[0].id] },
    });
    assert.equal(reordered.status, 200, JSON.stringify(reordered.body));
    const detail = expectData(
      await call('GET', `/api/v1/courses/${courseId}`, { token: instructor.token }),
      200,
      courseDetailDtoSchema,
      'chi tiết khóa học',
    );
    assert.equal('lessons' in detail, false, 'chi tiết khóa học không kèm bài học');
    assert.equal(detail.enrollment, null, 'giảng viên không có trạng thái ghi danh');
    const ordered = expectData(
      await call('GET', `/api/v1/courses/${courseId}/lessons`, { token: instructor.token }),
      200,
      lessonDtoSchema.array(),
      'danh sách bài học',
    );
    assert.deepEqual(
      ordered.map((lesson) => lesson.id),
      [lessons[1].id, lessons[0].id],
    );

    const edited = await call('PATCH', `/api/v1/courses/${courseId}/lessons/${lessons[0].id}`, {
      token: instructor.token,
      body: { title: 'Bài A đã sửa' },
    });
    assert.equal(expectData(edited, 200, lessonDtoSchema).title, 'Bài A đã sửa');
  });

  await t.test('quiz DRAFT: tạo, sửa cây câu hỏi, danh sách phân trang', async () => {
    const quizBase = `/api/v1/courses/${courseId}/lessons/${lessons[0].id}/quizzes`;
    const created = await call('POST', quizBase, {
      token: instructor.token,
      body: { title: 'Quiz cộng', questions: QUESTIONS },
    });
    const quiz = expectData(created, 201, quizDtoSchema, 'tạo quiz');
    assert.equal(quiz.status, 'DRAFT');
    assert.equal(quiz.question_count, 1);

    const updated = await call('PATCH', `${quizBase}/${quiz.id}`, {
      token: instructor.token,
      body: { title: 'Quiz cộng (sửa)' },
    });
    assert.equal(expectData(updated, 200, quizDtoSchema).title, 'Quiz cộng (sửa)');
  });

  await t.test('xuất bản; danh sách, tìm kiếm, tổng hợp và export CSV', async () => {
    const published = await call('PATCH', `/api/v1/courses/${courseId}`, {
      token: instructor.token,
      body: { status: 'PUBLISHED' },
    });
    assert.equal(expectData(published, 200, courseDtoSchema).status, 'PUBLISHED');

    const searched = await call(
      'GET',
      `/api/v1/courses?search=${encodeURIComponent(name)}&page=1&page_size=5`,
      { token: instructor.token },
    );
    const { items, pagination } = expectList(searched, courseDtoSchema);
    assert.ok(items.some((course) => course.id === courseId));
    assert.equal(pagination.page_size, 5);

    const summary = expectData(
      await call('GET', '/api/v1/courses/summary', { token: instructor.token }),
      200,
      courseSummaryDtoSchema,
    );
    assert.ok(summary.published >= 1);
    assert.equal(summary.total, summary.draft + summary.published + summary.archived);

    const exported = await call('GET', '/api/v1/courses/export', {
      token: instructor.token,
      raw: true,
    });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-type') ?? '', /text\/csv/u);
    assert.ok(exported.bytes.toString('utf8').includes(name), 'CSV phải chứa khóa vừa tạo');
  });

  await t.test(
    'quiz chưa có câu hỏi không xuất bản được; id sai định dạng 400, không tồn tại 404',
    async () => {
      const quizBase = `/api/v1/courses/${courseId}/lessons/${lessons[1].id}/quizzes`;
      const empty = await call('POST', quizBase, {
        token: instructor.token,
        body: { title: 'Quiz rỗng' },
      });
      const emptyId = expectData(empty, 201, quizDtoSchema, 'tạo quiz rỗng').id;
      expectError(
        await call('PATCH', `${quizBase}/${emptyId}`, {
          token: instructor.token,
          body: { status: 'PUBLISHED' },
        }),
        400,
        'VALIDATION_ERROR',
      );
      expectError(
        await call('GET', '/api/v1/courses/khong-phai-uuid', { token: instructor.token }),
        400,
        'VALIDATION_ERROR',
      );
      expectError(
        await call('GET', '/api/v1/courses/00000000-0000-4000-8000-0000000000ff', {
          token: instructor.token,
        }),
        404,
      );
    },
  );

  await t.test('xóa khóa học', async () => {
    const response = await call('DELETE', `/api/v1/courses/${courseId}`, {
      token: instructor.token,
    });
    assert.ok([200, 204].includes(response.status), `xóa khóa học trả ${response.status}`);
    expectError(await call('GET', `/api/v1/courses/${courseId}`, { token: instructor.token }), 404);
  });
});
