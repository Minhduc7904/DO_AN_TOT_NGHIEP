import { randomUUID } from 'node:crypto';

import { generateSigningKey } from '@aiops-lms/common/auth';
import { mintGatewayToken, startJwksStub } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  apiErrorSchema,
  apiListResponseSchema,
  apiResponseSchema,
  attemptDetailDtoSchema,
  attemptDtoSchema,
  courseDetailDtoSchema,
  courseDtoSchema,
  courseProgressDtoSchema,
  courseSummaryDtoSchema,
  enrolledCourseDtoSchema,
  enrollmentDtoSchema,
  lessonDtoSchema,
  lessonProgressDtoSchema,
  quizDtoSchema,
  quizSummaryDtoSchema,
  type QuizDto,
} from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/** Chạy với PostgreSQL thật đã migrate (`COURSE_DATABASE_URL`); xem `pnpm test:course:e2e`. */
describe('course service (PostgreSQL thật)', () => {
  let app: INestApplication;
  let jwks: Awaited<ReturnType<typeof startJwksStub>>;

  // Mọi request public đi qua Gateway nên mang service token của gateway kèm danh tính user.
  const signingKey = generateSigningKey();
  const gatewayToken = mintGatewayToken(signingKey, 'course');
  const asRole = (role: string, id: string): Record<string, string> => ({
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': id,
    'x-principal-role': role,
  });
  const instructorId = randomUUID();
  const otherInstructorId = randomUUID();
  const studentId = randomUUID();
  const outsiderId = randomUUID();
  const instructor = asRole('instructor', instructorId);
  const otherInstructor = asRole('instructor', otherInstructorId);
  const admin = asRole('admin', randomUUID());
  const student = asRole('student', studentId);
  const outsider = asRole('student', outsiderId);

  const unique = `${Date.now()}`;

  beforeAll(async () => {
    if (!process.env.COURSE_DATABASE_URL) {
      throw new Error('COURSE_DATABASE_URL là bắt buộc cho e2e của course');
    }
    process.env.OTEL_SDK_DISABLED = 'true';
    jwks = await startJwksStub(signingKey);
    process.env.AUTH_BASE_URL = jwks.baseUrl;
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await jwks?.close();
  });

  const http = (): ReturnType<typeof request> => request(app.getHttpServer());

  const questions = [
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

  it('luồng học đầy đủ: tạo nội dung → ghi danh → học → làm quiz', async () => {
    // ---- Giảng viên dựng khóa học (DRAFT) -------------------------------------------------
    const created = await http()
      .post('/api/v1/courses')
      .set(instructor)
      .send({ name: `Khóa học ${unique}`, description_markdown: 'Mô tả' })
      .expect(201);
    const course = apiResponseSchema(courseDtoSchema).parse(created.body);
    expect(course).toMatchObject({
      success: true,
      data: { status: 'DRAFT', instructor_id: instructorId },
      error: null,
      meta: { pagination: null },
    });
    const courseId = (course.data as { id: string }).id;

    // Khóa chưa xuất bản: học viên không ghi danh được, cũng không thấy khóa trong danh sách.
    const notEnrollable = await http()
      .post(`/api/v1/student/courses/${courseId}/enrollments`)
      .set(student)
      .expect(403);
    expect(apiErrorSchema.parse(notEnrollable.body).error.code).toBe('COURSE_NOT_ENROLLABLE');
    await http().get(`/api/v1/courses/${courseId}`).set(student).expect(404);

    // ---- Bài học: thêm cuối, trùng thứ tự, đổi thứ tự -------------------------------------
    const lessonA = await createLesson(courseId, {
      title: 'Bài A',
      content_markdown: 'Nội dung A',
    });
    const lessonB = await createLesson(courseId, { title: 'Bài B' });
    expect([lessonA.display_order, lessonB.display_order]).toEqual([1, 2]);

    const duplicateOrder = await http()
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set(instructor)
      .send({ title: 'Trùng', display_order: 1 })
      .expect(409);
    expect(apiErrorSchema.parse(duplicateOrder.body).error.code).toBe('LESSON_ORDER_CONFLICT');

    const reordered = await http()
      .put(`/api/v1/courses/${courseId}/lessons/reorder`)
      .set(instructor)
      .send({ lesson_ids: [lessonB.id, lessonA.id] })
      .expect(200);
    expect(apiResponseSchema(lessonDtoSchema.array()).parse(reordered.body).data).toMatchObject([
      { id: lessonB.id, display_order: 1 },
      { id: lessonA.id, display_order: 2 },
    ]);

    const badReorder = await http()
      .put(`/api/v1/courses/${courseId}/lessons/reorder`)
      .set(instructor)
      .send({ lesson_ids: [lessonA.id] })
      .expect(409);
    expect(apiErrorSchema.parse(badReorder.body).error.code).toBe('LESSON_ORDER_CONFLICT');

    // ---- Quyền sở hữu --------------------------------------------------------------------
    await http()
      .patch(`/api/v1/courses/${courseId}`)
      .set(otherInstructor)
      .send({ name: 'Cướp khóa' })
      .expect(403);
    await http().post('/api/v1/courses').set(student).send({ name: 'Học viên tạo' }).expect(403);

    // ---- Quiz: nháp, xuất bản cần có câu hỏi ---------------------------------------------
    const quizBase = `/api/v1/courses/${courseId}/lessons/${lessonA.id}/quizzes`;
    const emptyQuiz = await http()
      .post(quizBase)
      .set(instructor)
      .send({ title: 'Quiz trống' })
      .expect(201);
    const emptyQuizId = apiResponseSchema(quizDtoSchema).parse(emptyQuiz.body).data as QuizDto;
    const publishEmpty = await http()
      .patch(`${quizBase}/${emptyQuizId.id}`)
      .set(instructor)
      .send({ status: 'PUBLISHED' })
      .expect(400);
    expect(apiErrorSchema.parse(publishEmpty.body).error.code).toBe('VALIDATION_ERROR');

    const invalidQuiz = await http()
      .post(quizBase)
      .set(instructor)
      .send({
        title: 'Sai',
        questions: [{ ...questions[0], options: [{ option_markdown: 'x', is_correct: false }] }],
      })
      .expect(400);
    expect(apiErrorSchema.parse(invalidQuiz.body).error.details).toEqual(expect.any(Array));

    const quizResponse = await http()
      .post(quizBase)
      .set(instructor)
      .send({ title: 'Quiz chính', questions })
      .expect(201);
    const quiz = apiResponseSchema(quizDtoSchema).parse(quizResponse.body).data as QuizDto;
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0]?.options.map((option) => option.is_correct)).toEqual([false, true]);

    const quizList = await http().get(quizBase).set(instructor).expect(200);
    expect(
      apiResponseSchema(quizSummaryDtoSchema.array()).parse(quizList.body).data as unknown[],
    ).toHaveLength(2);

    // ---- Xuất bản khóa học và ghi danh ----------------------------------------------------
    await http()
      .patch(`/api/v1/courses/${courseId}`)
      .set(instructor)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const catalog = await http()
      .get('/api/v1/courses?page=1&page_size=100')
      .set(student)
      .expect(200);
    const catalogBody = apiListResponseSchema(courseDtoSchema).parse(catalog.body);
    expect(catalogBody.meta.pagination).toMatchObject({ page: 1, page_size: 100 });
    expect((catalogBody.data as { id: string }[]).map((item) => item.id)).toContain(courseId);

    const detail = await http().get(`/api/v1/courses/${courseId}`).set(student).expect(200);
    const outline = apiResponseSchema(courseDetailDtoSchema).parse(detail.body).data as {
      lessons: Record<string, unknown>[];
    };
    expect(outline.lessons).toHaveLength(2);
    expect(outline.lessons[0]).not.toHaveProperty('content_markdown');

    // Chưa ghi danh: không đọc được nội dung và không thấy quiz.
    const notEnrolled = await http()
      .get(`/api/v1/student/courses/${courseId}`)
      .set(outsider)
      .expect(403);
    expect(apiErrorSchema.parse(notEnrolled.body).error.code).toBe('STUDENT_NOT_ENROLLED');

    const enrolled = await http()
      .post(`/api/v1/student/courses/${courseId}/enrollments`)
      .set(student)
      .expect(201);
    expect(apiResponseSchema(enrollmentDtoSchema).parse(enrolled.body).data).toMatchObject({
      course_id: courseId,
      student_id: studentId,
    });
    const again = await http()
      .post(`/api/v1/student/courses/${courseId}/enrollments`)
      .set(student)
      .expect(409);
    expect(apiErrorSchema.parse(again.body).error.code).toBe('ENROLLMENT_ALREADY_EXISTS');

    const mine = await http().get('/api/v1/student/enrollments').set(student).expect(200);
    expect(
      (
        apiListResponseSchema(enrollmentDtoSchema).parse(mine.body).data as { course_id: string }[]
      ).map((item) => item.course_id),
    ).toContain(courseId);

    // ---- Học: nội dung và tiến độ ---------------------------------------------------------
    const content = await http()
      .get(`/api/v1/student/courses/${courseId}`)
      .set(student)
      .expect(200);
    const enrolledCourse = apiResponseSchema(enrolledCourseDtoSchema).parse(content.body).data as {
      lessons: { id: string; content_markdown: string | null }[];
    };
    expect(
      enrolledCourse.lessons.find((lesson) => lesson.id === lessonA.id)?.content_markdown,
    ).toBe('Nội dung A');

    const half = await http()
      .put(`/api/v1/student/lessons/${lessonA.id}/progress`)
      .set(student)
      .send({ progress_percent: 50 })
      .expect(200);
    expect(apiResponseSchema(lessonProgressDtoSchema).parse(half.body).data).toMatchObject({
      progress_percent: 50,
      completed_at: null,
    });
    const done = await http()
      .put(`/api/v1/student/lessons/${lessonA.id}/progress`)
      .set(student)
      .send({ progress_percent: 100 })
      .expect(200);
    const doneData = apiResponseSchema(lessonProgressDtoSchema).parse(done.body).data as {
      completed_at: string | null;
    };
    expect(doneData.completed_at).not.toBeNull();
    // Tiến độ không giảm.
    const back = await http()
      .put(`/api/v1/student/lessons/${lessonA.id}/progress`)
      .set(student)
      .send({ progress_percent: 10 })
      .expect(200);
    expect(apiResponseSchema(lessonProgressDtoSchema).parse(back.body).data).toMatchObject({
      progress_percent: 100,
    });

    const progress = await http()
      .get(`/api/v1/student/courses/${courseId}/progress`)
      .set(student)
      .expect(200);
    expect(apiResponseSchema(courseProgressDtoSchema).parse(progress.body).data).toMatchObject({
      total_lessons: 2,
      completed_lessons: 1,
      percent: 50,
    });

    // ---- Quiz của học viên: chỉ PUBLISHED, ẩn đáp án ---------------------------------------
    const draftOnly = await http()
      .get(`/api/v1/student/lessons/${lessonA.id}/quizzes`)
      .set(student)
      .expect(200);
    expect(apiResponseSchema(quizSummaryDtoSchema.array()).parse(draftOnly.body).data).toEqual([]);
    await http().get(`/api/v1/student/quizzes/${quiz.id}`).set(student).expect(404);

    await http()
      .patch(`${quizBase}/${quiz.id}`)
      .set(instructor)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const visible = await http()
      .get(`/api/v1/student/lessons/${lessonA.id}/quizzes`)
      .set(student)
      .expect(200);
    expect(
      apiResponseSchema(quizSummaryDtoSchema.array()).parse(visible.body).data as { id: string }[],
    ).toMatchObject([{ id: quiz.id, question_count: 2 }]);

    const studentQuiz = await http()
      .get(`/api/v1/student/quizzes/${quiz.id}`)
      .set(student)
      .expect(200);
    const studentView = apiResponseSchema(quizDtoSchema).parse(studentQuiz.body).data as QuizDto;
    expect(JSON.stringify(studentView)).not.toContain('is_correct');
    await http().get(`/api/v1/student/quizzes/${quiz.id}`).set(outsider).expect(403);

    // ---- Làm bài: start (201), resume (200), lưu, nộp -------------------------------------
    const started = await http()
      .post(`/api/v1/student/quizzes/${quiz.id}/attempts`)
      .set(student)
      .expect(201);
    const attempt = apiResponseSchema(attemptDtoSchema).parse(started.body).data as { id: string };
    const resumed = await http()
      .post(`/api/v1/student/quizzes/${quiz.id}/attempts`)
      .set(student)
      .expect(200);
    expect(
      (apiResponseSchema(attemptDtoSchema).parse(resumed.body).data as { id: string }).id,
    ).toBe(attempt.id);

    const [single, multiple] = studentView.questions;
    const optionOf = (question: typeof single, index: number): string =>
      (question as NonNullable<typeof single>).options[index]!.id;

    const tooMany = await http()
      .put(`/api/v1/student/attempts/${attempt.id}/answers`)
      .set(student)
      .send({
        answers: [
          { question_id: single!.id, option_ids: [optionOf(single, 0), optionOf(single, 1)] },
        ],
      })
      .expect(400);
    expect(apiErrorSchema.parse(tooMany.body).error.code).toBe('VALIDATION_ERROR');
    await http()
      .put(`/api/v1/student/attempts/${attempt.id}/answers`)
      .set(outsider)
      .send({ answers: [] })
      .expect(404);

    // Đúng câu 1 (chọn "4"), câu 2 thiếu một đáp án đúng => chỉ được 1.5/3.5 điểm.
    const saved = await http()
      .put(`/api/v1/student/attempts/${attempt.id}/answers`)
      .set(student)
      .send({
        answers: [
          { question_id: single!.id, option_ids: [optionOf(single, 1)] },
          { question_id: multiple!.id, option_ids: [optionOf(multiple, 0)] },
        ],
      })
      .expect(200);
    expect(apiResponseSchema(attemptDtoSchema).parse(saved.body).data).toMatchObject({
      status: 'IN_PROGRESS',
      score: null,
    });

    const submitted = await http()
      .post(`/api/v1/student/attempts/${attempt.id}/submit`)
      .set(student)
      .expect(200);
    const result = apiResponseSchema(attemptDetailDtoSchema).parse(submitted.body).data as {
      status: string;
      score: number;
      max_score: number;
      quiz: QuizDto;
    };
    expect(result).toMatchObject({ status: 'SUBMITTED', score: 1.5, max_score: 3.5 });
    expect(result.quiz.questions[0]?.options.map((option) => option.is_correct)).toEqual([
      false,
      true,
    ]);

    const resubmit = await http()
      .post(`/api/v1/student/attempts/${attempt.id}/submit`)
      .set(student)
      .expect(409);
    expect(apiErrorSchema.parse(resubmit.body).error.code).toBe('QUIZ_ATTEMPT_ALREADY_SUBMITTED');
    const saveAfter = await http()
      .put(`/api/v1/student/attempts/${attempt.id}/answers`)
      .set(student)
      .send({ answers: [] })
      .expect(409);
    expect(apiErrorSchema.parse(saveAfter.body).error.code).toBe('QUIZ_ATTEMPT_ALREADY_SUBMITTED');

    const history = await http()
      .get(`/api/v1/student/quizzes/${quiz.id}/attempts`)
      .set(student)
      .expect(200);
    expect(apiListResponseSchema(attemptDtoSchema).parse(history.body).meta.pagination?.total).toBe(
      1,
    );

    // Sau khi nộp được làm lượt mới.
    const second = await http()
      .post(`/api/v1/student/quizzes/${quiz.id}/attempts`)
      .set(student)
      .expect(201);
    expect(
      (apiResponseSchema(attemptDtoSchema).parse(second.body).data as { id: string }).id,
    ).not.toBe(attempt.id);

    // ---- Quiz đã có lượt làm: khóa cây câu hỏi và xóa -------------------------------------
    const locked = await http()
      .patch(`${quizBase}/${quiz.id}`)
      .set(instructor)
      .send({ questions })
      .expect(409);
    expect(apiErrorSchema.parse(locked.body).error.code).toBe('QUIZ_HAS_ATTEMPTS');
    await http()
      .patch(`${quizBase}/${quiz.id}`)
      .set(instructor)
      .send({ title: 'Quiz đổi tên' })
      .expect(200);
    const noDelete = await http().delete(`${quizBase}/${quiz.id}`).set(instructor).expect(409);
    expect(apiErrorSchema.parse(noDelete.body).error.code).toBe('QUIZ_HAS_ATTEMPTS');

    // Quiz chưa có lượt làm thì sửa cây câu hỏi và xóa được.
    await http()
      .patch(`${quizBase}/${emptyQuizId.id}`)
      .set(instructor)
      .send({ questions })
      .expect(200);
    await http().delete(`${quizBase}/${emptyQuizId.id}`).set(instructor).expect(204);
  });

  it('start attempt đồng thời chỉ tạo một lượt đang làm', async () => {
    const courseId = await publishedCourseWithQuiz();
    await http()
      .post(`/api/v1/student/courses/${courseId.course}/enrollments`)
      .set(student)
      .expect(201);

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        http().post(`/api/v1/student/quizzes/${courseId.quiz}/attempts`).set(student),
      ),
    );
    const ids = new Set(
      responses.map((response) => (response.body as { data: { id: string } }).data.id),
    );
    expect(
      responses
        .map((response) => response.status)
        .every((status) => status === 200 || status === 201),
    ).toBe(true);
    expect(ids.size).toBe(1);
  });

  it('danh sách theo vai trò, summary và export CSV streaming', async () => {
    const owner = asRole('instructor', randomUUID());
    for (let index = 0; index < 3; index += 1) {
      await http()
        .post('/api/v1/courses')
        .set(owner)
        .send({ name: `Xuất, "CSV" ${index} ${unique}` })
        .expect(201);
    }
    await http().post('/api/v1/courses').set(owner).send({ name: 'ab' }).expect(400);

    const own = await http().get('/api/v1/courses?page=1&page_size=2').set(owner).expect(200);
    const ownBody = apiListResponseSchema(courseDtoSchema).parse(own.body);
    expect(ownBody.meta.pagination).toEqual({ page: 1, page_size: 2, total: 3, total_pages: 2 });
    expect(ownBody.data).toHaveLength(2);

    const search = await http()
      .get(`/api/v1/courses?search=${encodeURIComponent('"csv" 1')}`)
      .set(owner)
      .expect(200);
    expect(apiListResponseSchema(courseDtoSchema).parse(search.body).meta.pagination?.total).toBe(
      1,
    );

    const summary = await http().get('/api/v1/courses/summary').set(owner).expect(200);
    expect(apiResponseSchema(courseSummaryDtoSchema).parse(summary.body).data).toEqual({
      total: 3,
      draft: 3,
      published: 0,
      archived: 0,
    });
    await http().get('/api/v1/courses/summary').set(student).expect(403);

    const csv = await http().get('/api/v1/courses/export').set(owner).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    const text = csv.text;
    expect(text.startsWith('﻿id,name,status,createdAtUtc\r\n')).toBe(true);
    const rows = text.split('\r\n').filter((line) => line.length > 0);
    expect(rows).toHaveLength(4);
    expect(text).toContain('"Xuất, ""CSV"" 0');

    // Admin xuất tất cả khóa học, nhiều hơn khóa của một giảng viên.
    const all = await http().get('/api/v1/courses/export').set(admin).expect(200);
    expect(all.text.split('\r\n').filter((line) => line.length > 0).length).toBeGreaterThan(4);
    await http().get('/api/v1/courses/export').set(student).expect(403);
  });

  it('thiếu hoặc sai danh tính trả 401 envelope lỗi', async () => {
    const missing = await http().get('/api/v1/courses').expect(401);
    expect(apiErrorSchema.parse(missing.body).error.code).toBe('SERVICE_TOKEN_MISSING');
    // Có token gateway nhưng thiếu danh tính user, và giả danh tính không kèm token gateway.
    const noPrincipal = await http()
      .get('/api/v1/courses')
      .set({ authorization: `Bearer ${gatewayToken}` })
      .expect(401);
    expect(apiErrorSchema.parse(noPrincipal.body).error.code).toBe('UNAUTHORIZED');
    await http()
      .get('/api/v1/courses')
      .set({ 'x-principal-id': randomUUID(), 'x-principal-role': 'admin' })
      .expect(401);
    await http().get('/api/v1/courses/khong-phai-uuid').set(admin).expect(400);
    await http().get(`/api/v1/courses/${randomUUID()}`).set(admin).expect(404);
  });

  async function createLesson(
    courseId: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string; display_order: number }> {
    const response = await http()
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set(instructor)
      .send(body)
      .expect(201);
    return apiResponseSchema(lessonDtoSchema).parse(response.body).data as {
      id: string;
      display_order: number;
    };
  }

  async function publishedCourseWithQuiz(): Promise<{ course: string; quiz: string }> {
    const course = await http()
      .post('/api/v1/courses')
      .set(instructor)
      .send({ name: `Đồng thời ${unique}` })
      .expect(201);
    const courseId = (course.body as { data: { id: string } }).data.id;
    const lesson = await createLesson(courseId, { title: 'Bài' });
    const quiz = await http()
      .post(`/api/v1/courses/${courseId}/lessons/${lesson.id}/quizzes`)
      .set(instructor)
      .send({ title: 'Quiz', questions })
      .expect(201);
    const quizId = (quiz.body as { data: { id: string } }).data.id;
    await http()
      .patch(`/api/v1/courses/${courseId}/lessons/${lesson.id}/quizzes/${quizId}`)
      .set(instructor)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    await http()
      .patch(`/api/v1/courses/${courseId}`)
      .set(instructor)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    return { course: courseId, quiz: quizId };
  }
});
