import exec from 'k6/execution';

import { api } from '../lib/api.js';
import { runIteration, seedInstructorSession, think, uniqueName } from './session.js';

const J = 'w2';

const QUESTIONS = [
  {
    question_markdown: '2 + 2 = ?',
    question_type: 'SINGLE_CHOICE',
    points: 1,
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

/**
 * W2 — giảng viên soạn khóa học: tạo khóa, hai bài học, một quiz, xuất bản quiz và khóa học, tìm
 * kiếm, xem tổng hợp; thỉnh thoảng xuất CSV. Khóa học được giữ lại như người dùng thật.
 */
export function w2CourseAuthoring() {
  runIteration(J, ({ rng }) => {
    const { token } = seedInstructorSession(J);
    const name = uniqueName('Khóa học k6');
    const course = api('POST', '/api/v1/courses', {
      journey: J,
      token,
      expected: [201],
      body: { name, description_markdown: 'Khóa học do workload k6 tạo' },
    }).data;
    think(rng);

    const lessons = [];
    for (const title of ['Bài mở đầu', 'Bài luyện tập']) {
      lessons.push(
        api('POST', `/api/v1/courses/${course.id}/lessons`, {
          journey: J,
          name: 'POST /api/v1/courses/:course_id/lessons',
          token,
          expected: [201],
          body: { title, content_markdown: `Nội dung ${title}` },
        }).data,
      );
      think(rng);
    }

    const quizBase = `/api/v1/courses/${course.id}/lessons/${lessons[0].id}/quizzes`;
    const quiz = api('POST', quizBase, {
      journey: J,
      name: 'POST /api/v1/courses/:course_id/lessons/:lesson_id/quizzes',
      token,
      expected: [201],
      body: { title: 'Quiz luyện tập', questions: QUESTIONS },
    }).data;
    api('PATCH', `${quizBase}/${quiz.id}`, {
      journey: J,
      name: 'PATCH /api/v1/courses/:course_id/lessons/:lesson_id/quizzes/:quiz_id',
      token,
      body: { status: 'PUBLISHED' },
    });
    think(rng);

    api('PATCH', `/api/v1/courses/${course.id}`, {
      journey: J,
      name: 'PATCH /api/v1/courses/:course_id',
      token,
      body: { status: 'PUBLISHED' },
    });
    api('GET', `/api/v1/courses?search=${encodeURIComponent(name)}&page_size=5`, {
      journey: J,
      name: 'GET /api/v1/courses?search',
      token,
    });
    api('GET', '/api/v1/courses/summary', { journey: J, token });
    if (exec.vu.iterationInScenario % 10 === 9) {
      api('GET', '/api/v1/courses/export', { journey: J, token });
    }
    think(rng);
  });
}
