import { api, waitFor } from '../lib/api.js';
import { utf8 } from '../lib/bytes.js';
import {
  runIteration,
  seedInstructorSession,
  think,
  uniqueName,
  uploadMedia,
  vuState,
} from './session.js';

const J = 'w6';

const NOTE = utf8(
  'Quy hoạch động chia bài toán lớn thành các bài toán con gối nhau và lưu kết quả để dùng lại.',
);

function lessonPath(courseId, lessonId) {
  return `/api/v1/courses/${courseId}/lessons/${lessonId}`;
}

/** Mỗi VU dùng một khóa học riêng cho W6, tạo ở lượt đầu. */
function ensureCourse(token) {
  const current = vuState();
  if (!current.w6CourseId) {
    current.w6CourseId = api('POST', '/api/v1/courses', {
      journey: J,
      token,
      expected: [201],
      body: { name: uniqueName('Khóa học AI k6'), description_markdown: 'Khóa học cho W6' },
    }).data.id;
  }
  return current.w6CourseId;
}

/**
 * W6 — AI soạn bài: tạo bài học, đính kèm tài liệu TXT cần trích xuất, đồng bộ tài liệu AI, chờ
 * `EXTRACTED`, rồi chạy luân phiên job `SYNTHESIZE_LESSON` và `GENERATE_QUIZ` tới khi kết thúc.
 * Provider đã được `setup()` cấu hình trỏ tới LLM stub.
 */
export function w6AiLesson() {
  runIteration(J, (current) => {
    const { rng } = current;
    const { token } = seedInstructorSession(J);
    const courseId = ensureCourse(token);
    const lesson = api('POST', `/api/v1/courses/${courseId}/lessons`, {
      journey: J,
      name: 'POST /api/v1/courses/:course_id/lessons',
      token,
      expected: [201],
      body: { title: uniqueName('Bài AI'), content_markdown: 'Bản nháp' },
    }).data;
    const base = lessonPath(courseId, lesson.id);
    think(rng);

    const { mediaId } = uploadDocument(token);
    api('POST', '/api/v1/media/usages', {
      journey: J,
      token,
      expected: [201],
      body: {
        media_id: mediaId,
        owner_kind: 'COURSE',
        owner_id: lesson.id,
        usage_type: 'LESSON_ATTACHMENT',
      },
    });
    api('POST', `${base}/ai-documents/sync`, {
      journey: J,
      name: 'POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-documents/sync',
      token,
      expected: [200, 201, 202],
    });
    const document = waitFor(J, 'tài liệu AI EXTRACTED', () => {
      const items = api('GET', `${base}/ai-documents`, {
        journey: J,
        name: 'GET /api/v1/courses/:course_id/lessons/:lesson_id/ai-documents',
        token,
      }).data;
      const found = (items ?? []).find((item) => item.media_id === mediaId);
      return found && found.status !== 'EXTRACTING' && found.status !== 'PENDING' ? found : null;
    });
    if (!document || document.status !== 'EXTRACTED') return;
    think(rng);

    const done = current.counters.w6 ?? 0;
    current.counters.w6 = done + 1;
    const synthesize = done % 2 === 0;
    const job = api('POST', `${base}/ai-jobs`, {
      journey: J,
      name: 'POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs',
      token,
      expected: [202],
      body: synthesize
        ? { job_type: 'SYNTHESIZE_LESSON', media_ids: [mediaId], overwrite_content: true }
        : { job_type: 'GENERATE_QUIZ', media_ids: [mediaId], question_count: 2 },
    }).data;
    waitFor(J, 'job AI kết thúc', () => {
      const status = api('GET', `${base}/ai-jobs/${job.id}`, {
        journey: J,
        name: 'GET /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs/:job_id',
        token,
      }).data.job.status;
      return status === 'COMPLETED' || status === 'FAILED' ? status : null;
    });
    think(rng);
  });
}

function uploadDocument(token) {
  return uploadMedia(J, token, {
    content: NOTE,
    fileName: 'ghi-chu-k6.txt',
    mimeType: 'text/plain',
    extractText: true,
  });
}
