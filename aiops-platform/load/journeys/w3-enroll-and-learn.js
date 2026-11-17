import exec from 'k6/execution';

import { api } from '../lib/api.js';
import { runIteration, seedStudentSession, think, vuState } from './session.js';

const J = 'w3';

/**
 * W3 — học viên ghi danh và học: duyệt danh mục, xem chi tiết, ghi danh (đã ghi danh thì 409), đọc
 * bài học, cập nhật tiến độ, làm và nộp một quiz đã xuất bản nếu bài có quiz. Đổi học viên seed sau
 * mỗi 5 lượt để dữ liệu không dồn vào một tài khoản.
 */
export function w3EnrollAndLearn() {
  runIteration(J, ({ rng }) => {
    if (exec.vu.iterationInScenario % 5 === 0) delete vuState().sessions.student;
    const { token } = seedStudentSession(J);

    const catalogue = api('GET', `/api/v1/courses?page=${rng.int(1, 3)}&page_size=10`, {
      journey: J,
      name: 'GET /api/v1/courses',
      token,
    }).data;
    if (!catalogue || catalogue.length === 0) return;
    const course = rng.pick(catalogue);
    think(rng);

    api('GET', `/api/v1/courses/${course.id}`, {
      journey: J,
      name: 'GET /api/v1/courses/:course_id',
      token,
    });
    api('POST', `/api/v1/student/courses/${course.id}/enrollments`, {
      journey: J,
      name: 'POST /api/v1/student/courses/:course_id/enrollments',
      token,
      expected: [201, 409],
    });
    think(rng);

    const lessons = api('GET', `/api/v1/courses/${course.id}/lessons`, {
      journey: J,
      name: 'GET /api/v1/courses/:course_id/lessons',
      token,
    }).data;
    if (!lessons || lessons.length === 0) return;
    const lesson = rng.pick(lessons);
    think(rng);

    api('PUT', `/api/v1/student/lessons/${lesson.id}/progress`, {
      journey: J,
      name: 'PUT /api/v1/student/lessons/:lesson_id/progress',
      token,
      body: { progress_percent: rng.pick([25, 50, 75, 100]) },
    });
    api('GET', `/api/v1/student/courses/${course.id}/progress`, {
      journey: J,
      name: 'GET /api/v1/student/courses/:course_id/progress',
      token,
    });
    think(rng);

    const quizzes = api('GET', `/api/v1/student/lessons/${lesson.id}/quizzes`, {
      journey: J,
      name: 'GET /api/v1/student/lessons/:lesson_id/quizzes',
      token,
    }).data;
    if (!quizzes || quizzes.length === 0) return;
    const quiz = api('GET', `/api/v1/student/quizzes/${rng.pick(quizzes).id}`, {
      journey: J,
      name: 'GET /api/v1/student/quizzes/:quiz_id',
      token,
    }).data;
    const attempt = api('POST', `/api/v1/student/quizzes/${quiz.id}/attempts`, {
      journey: J,
      name: 'POST /api/v1/student/quizzes/:quiz_id/attempts',
      token,
      expected: [200, 201, 409],
    });
    if (attempt.status === 409) return;
    think(rng);

    const answers = quiz.questions.map((question) => ({
      question_id: question.id,
      option_ids: [rng.pick(question.options).id],
    }));
    api('PUT', `/api/v1/student/attempts/${attempt.data.id}/answers`, {
      journey: J,
      name: 'PUT /api/v1/student/attempts/:attempt_id/answers',
      token,
      body: { answers },
    });
    think(rng);
    api('POST', `/api/v1/student/attempts/${attempt.data.id}/submit`, {
      journey: J,
      name: 'POST /api/v1/student/attempts/:attempt_id/submit',
      token,
      expected: [200, 409],
    });
    think(rng);
  });
}
