import { sleep } from 'k6';
import crypto from 'k6/crypto';

import { buildMultipart, PNG_1X1, utf8 } from '../lib/bytes.js';
import { SessionEnd, UserSession } from '../lib/client.js';
import { config, seedInstructorEmail } from '../lib/config.js';
import { drawThink, nextInstructorState } from '../lib/staff-plan.js';

/**
 * Giảng viên và admin mức 2 (workload-design-v1 mục 4.2–4.3, 5.7–5.8, 6.4). Máy trạng thái và tham
 * số là GIẢ ĐỊNH của đề tài (`params/staff-assumed-v1.json`); request và payload chép từ hành trình
 * mức 1 (`journeys/`) và regression của LMS.
 */

const P = '/api/v1';
const NOTE = utf8(
  'Quy hoạch động chia bài toán lớn thành các bài toán con gối nhau và lưu kết quả để dùng lại.',
);
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

function sha256Hex(bytes) {
  return crypto.sha256(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    'hex',
  );
}

/** upload-intent → POST thẳng MinIO → upload-complete. Trả `media_id` hoặc null nếu bỏ qua. */
export function uploadFile(user, { content, fileName, mimeType, extractText = false }) {
  const intent = user.call('POST', `${P}/media/upload-intents`, {
    expected: [201],
    idempotent: false,
    body: {
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: content.length,
      checksum_sha256: sha256Hex(content),
      ...(extractText ? { extract_text: true } : {}),
    },
  });
  if (!intent) return null;
  const multipart = buildMultipart(
    intent.data.upload.fields,
    { name: fileName, type: mimeType, content },
    `----k6-${config.runId}-${Date.now()}`,
  );
  user.call('POST', intent.data.upload.url, {
    name: 'POST minio presigned upload',
    body: multipart.body,
    raw: { contentType: multipart.contentType },
    expected: [201, 204],
    idempotent: true,
  });
  user.call('POST', `${P}/media/${intent.data.media_id}/upload-complete`, {
    name: 'POST /api/v1/media/:media_id/upload-complete',
    idempotent: true,
  });
  return intent.data.media_id;
}

/**
 * Thăm dò việc nền (mục 6.4): gọi `probe` theo chu kỳ tới khi trả khác null hoặc hết giờ. Hết giờ thì
 * ghi `background_wait_timeout` và trả null (không phải think time).
 */
function poll(user, rng, wait, label, probe) {
  const deadline = Date.now() + wait.timeout_s * 1000;
  for (;;) {
    const value = probe();
    if (value !== null && value !== undefined) return value;
    if (Date.now() + wait.interval_s * 1000 > deadline) {
      user.log({
        method: 'WAIT',
        endpoint: label,
        status: null,
        outcome: 'background_wait_timeout',
      });
      return null;
    }
    if (Date.now() + wait.interval_s * 1000 >= user.deadlineMs) throw new SessionEnd('run_end');
    sleep(wait.interval_s + rng.uniform(0, wait.jitter_s));
  }
}

class InstructorContext {
  constructor(user, staff, rng, setupData) {
    Object.assign(this, { user, staff, rng, setupData });
    this.course = null;
    this.lesson = null;
    this.quiz = null;
    this.mediaId = null;
    this.mediaIsText = false;
    this.createdCourse = null;
    this.jobsDone = 0;
  }

  courses() {
    const list =
      this.user.call('GET', `${P}/courses?page_size=20`, { name: 'GET /api/v1/courses' })?.data ??
      [];
    this.user.call('GET', `${P}/courses/summary`, { name: 'GET /api/v1/courses/summary' });
    const own = list.filter((course) => course.instructor_id === this.user.principalId);
    if (!this.course && own.length > 0) this.course = this.rng.pick(own);
  }

  ensureCourse() {
    if (!this.course) this.createCourse();
    return this.course;
  }

  createCourse() {
    const course = this.user.call('POST', `${P}/courses`, {
      expected: [201],
      idempotent: false,
      body: {
        name: `Khóa học ${config.runId} ${this.user.sessionKey}`,
        description_markdown: 'Khóa học do workload mức 2 tạo',
      },
    })?.data;
    if (course) {
      this.course = course;
      this.createdCourse = course.id;
      this.lesson = null;
    }
  }

  lessons() {
    return (
      this.user.call('GET', `${P}/courses/${this.ensureCourse().id}/lessons`, {
        name: 'GET /api/v1/courses/:course_id/lessons',
      })?.data ?? []
    );
  }

  ensureLesson() {
    if (this.lesson) return this.lesson;
    const lessons = this.lessons();
    if (lessons.length > 0) this.lesson = this.rng.pick(lessons);
    else this.addLesson();
    return this.lesson;
  }

  addLesson() {
    const lesson = this.user.call('POST', `${P}/courses/${this.ensureCourse().id}/lessons`, {
      name: 'POST /api/v1/courses/:course_id/lessons',
      expected: [201],
      idempotent: false,
      body: {
        title: `Bài ${this.user.sessionKey}-${this.user.actions}`,
        content_markdown: 'Bản nháp',
      },
    })?.data;
    if (lesson) this.lesson = lesson;
  }

  editLesson() {
    const lesson = this.ensureLesson();
    if (!lesson) return;
    const image =
      this.mediaId && !this.mediaIsText ? `\n\n![ảnh](/api/v1/media/${this.mediaId}/content)` : '';
    this.user.call('PATCH', `${P}/courses/${this.course.id}/lessons/${lesson.id}`, {
      name: 'PATCH /api/v1/courses/:course_id/lessons/:lesson_id',
      idempotent: true,
      body: { content_markdown: `Nội dung cập nhật ${this.user.actions}${image}` },
    });
  }

  reorder() {
    const lessons = this.lessons();
    if (lessons.length < 2) return;
    const ids = lessons.map((item) => item.id);
    [ids[ids.length - 1], ids[ids.length - 2]] = [ids[ids.length - 2], ids[ids.length - 1]];
    this.user.call('PUT', `${P}/courses/${this.course.id}/lessons/reorder`, {
      name: 'PUT /api/v1/courses/:course_id/lessons/reorder',
      idempotent: true,
      body: { lesson_ids: ids },
    });
  }

  createQuiz() {
    const lesson = this.ensureLesson();
    if (!lesson) return;
    this.quiz = this.user.call(
      'POST',
      `${P}/courses/${this.course.id}/lessons/${lesson.id}/quizzes`,
      {
        name: 'POST /api/v1/courses/:course_id/lessons/:lesson_id/quizzes',
        expected: [201],
        idempotent: false,
        body: { title: `Quiz ${this.user.sessionKey}`, questions: QUESTIONS },
      },
    )?.data;
  }

  publishQuiz() {
    if (!this.quiz || !this.lesson) return;
    this.user.call(
      'PATCH',
      `${P}/courses/${this.course.id}/lessons/${this.lesson.id}/quizzes/${this.quiz.id}`,
      {
        name: 'PATCH /api/v1/courses/:course_id/lessons/:lesson_id/quizzes/:quiz_id',
        idempotent: true,
        expected: [200, 409],
        body: { status: 'PUBLISHED' },
      },
    );
    this.quiz = null;
  }

  publishCourse() {
    if (!this.course || this.course.status === 'PUBLISHED') return;
    this.user.call('PATCH', `${P}/courses/${this.course.id}`, {
      name: 'PATCH /api/v1/courses/:course_id',
      idempotent: true,
      body: { status: 'PUBLISHED' },
    });
    this.course = { ...this.course, status: 'PUBLISHED' };
  }

  upload(forceText = false) {
    const isText = forceText || !this.rng.chance(this.staff.instructor.upload_png_share);
    this.mediaId = uploadFile(
      this.user,
      isText
        ? {
            content: NOTE,
            fileName: 'tai-lieu.txt',
            mimeType: 'text/plain',
            extractText: forceText,
          }
        : { content: PNG_1X1, fileName: 'anh.png', mimeType: 'image/png' },
    );
    this.mediaIsText = isText;
    if (this.mediaId && !isText) {
      poll(this.user, this.rng, this.staff.background_wait.thumbnail, 'thumbnail READY', () => {
        const library =
          this.user.call('GET', `${P}/media/library?page_size=20`, {
            name: 'GET /api/v1/media/library',
          })?.data ?? [];
        const entry = library.find((item) => item.id === this.mediaId);
        return entry && entry.thumbnail_status !== 'PENDING' ? entry : null;
      });
    }
  }

  library() {
    this.user.call('GET', `${P}/media/library?page_size=20`, { name: 'GET /api/v1/media/library' });
  }

  attach() {
    if (!this.mediaId) return;
    const lesson = this.ensureLesson();
    if (!lesson) return;
    this.user.call('POST', `${P}/media/usages`, {
      expected: [201],
      idempotent: false,
      body: {
        media_id: this.mediaId,
        owner_kind: 'COURSE',
        owner_id: lesson.id,
        usage_type: 'LESSON_ATTACHMENT',
      },
    });
  }

  aiSync() {
    // Thiếu tiền đề (chưa có media, bài học, khóa tự tạo): giảng viên rời đi.
    if (!this.mediaId || !this.lesson || !this.createdCourse) throw new SessionEnd('exit');
    const base = `${P}/courses/${this.course.id}/lessons/${this.lesson.id}`;
    this.user.call('POST', `${base}/ai-documents/sync`, {
      name: 'POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-documents/sync',
      expected: [200, 201, 202],
      idempotent: true,
    });
    const document = poll(
      this.user,
      this.rng,
      this.staff.background_wait.ai_document,
      'tài liệu AI EXTRACTED',
      () => {
        const items =
          this.user.call('GET', `${base}/ai-documents`, {
            name: 'GET /api/v1/courses/:course_id/lessons/:lesson_id/ai-documents',
          })?.data ?? [];
        const found = items.find((item) => item.media_id === this.mediaId);
        return found && found.status !== 'EXTRACTING' && found.status !== 'PENDING' ? found : null;
      },
    );
    // Bỏ chờ hoặc trích xuất lỗi: giảng viên rời đi, việc nền tiếp tục (mục 6.4).
    // `background_wait_timeout` đã ghi ở nhật ký thao tác; end_reason theo mục 6.1 là `exit`.
    if (!document || document.status !== 'EXTRACTED') throw new SessionEnd('exit');
  }

  aiJob() {
    const base = `${P}/courses/${this.course.id}/lessons/${this.lesson.id}`;
    const synthesize = this.jobsDone === 0 ? this.rng.chance(0.6) : !this.lastWasSynthesize;
    this.lastWasSynthesize = synthesize;
    this.jobsDone += 1;
    const job = this.user.call('POST', `${base}/ai-jobs`, {
      name: 'POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs',
      expected: [202],
      idempotent: false,
      body: synthesize
        ? { job_type: 'SYNTHESIZE_LESSON', media_ids: [this.mediaId], overwrite_content: true }
        : { job_type: 'GENERATE_QUIZ', media_ids: [this.mediaId], question_count: 2 },
    })?.data;
    if (!job) return;
    const status = poll(
      this.user,
      this.rng,
      this.staff.background_wait.ai_job,
      'job AI kết thúc',
      () => {
        const current = this.user.call('GET', `${base}/ai-jobs/${job.id}`, {
          name: 'GET /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs/:job_id',
        })?.data?.job;
        return current && (current.status === 'COMPLETED' || current.status === 'FAILED')
          ? current
          : null;
      },
    );
    if (!status) throw new SessionEnd('exit');
  }

  exportCsv() {
    this.user.call('GET', `${P}/courses/export`, { name: 'GET /api/v1/courses/export' });
  }
}

const INSTRUCTOR_HANDLERS = {
  I_COURSES: (ctx) => ctx.courses(),
  I_CREATE_COURSE: (ctx) => ctx.createCourse(),
  I_ADD_LESSON: (ctx) => ctx.addLesson(),
  I_EDIT_LESSON: (ctx) => ctx.editLesson(),
  I_REORDER: (ctx) => ctx.reorder(),
  I_CREATE_QUIZ: (ctx) => ctx.createQuiz(),
  I_PUBLISH_QUIZ: (ctx) => ctx.publishQuiz(),
  I_PUBLISH_COURSE: (ctx) => ctx.publishCourse(),
  I_UPLOAD: (ctx) => ctx.upload(false),
  I_UPLOAD_TXT: (ctx) => ctx.upload(true),
  I_ATTACH: (ctx) => ctx.attach(),
  I_LIBRARY: (ctx) => ctx.library(),
  I_AI_SYNC: (ctx) => ctx.aiSync(),
  I_AI_JOB: (ctx) => ctx.aiJob(),
  I_EXPORT: (ctx) => ctx.exportCsv(),
};

export function playInstructorSession({
  plan,
  staff,
  reaction,
  rng,
  sessionKey,
  deadlineMs,
  setupData,
}) {
  const user = new UserSession({
    scenario: 'instructors',
    sessionKey,
    role: 'instructor',
    door: 'instructor',
    email: seedInstructorEmail(plan.account_index),
    password: config.seedPassword,
    plan,
    params: reaction,
    rng,
    deadlineMs,
  });
  const ctx = new InstructorContext(user, staff, rng, setupData);
  let endReason = 'goal_done';
  try {
    user.begin('I_LOGIN');
    user.login();
    user.call('GET', `${P}/auth/me`, { name: 'GET /api/v1/auth/me' });
    let state = 'I_LOGIN';
    for (let step = 0; step < staff.instructor.max_actions; step += 1) {
      const next = nextInstructorState(staff, plan.goal, state, rng, step);
      if (next === 'EXIT') break;
      user.think(drawThink(rng, staff.think, next));
      user.begin(next);
      INSTRUCTOR_HANDLERS[next](ctx);
      state = next;
    }
  } catch (error) {
    if (!(error instanceof SessionEnd)) throw error;
    endReason = error.reason;
  }
  user.finish(endReason);
  return endReason;
}

function adminUser({ scenario, plan, reaction, rng, sessionKey, deadlineMs }) {
  return new UserSession({
    scenario,
    sessionKey,
    role: 'admin',
    door: 'admin',
    email: config.admin.email,
    password: config.admin.password,
    plan,
    params: reaction,
    rng,
    deadlineMs,
  });
}

function accounts(user, rng, role) {
  return (
    user.call('GET', `${P}/auth/accounts?role=${role}&page=${rng.int(1, 10)}&page_size=100`, {
      name: 'GET /api/v1/auth/accounts',
    })?.data ?? []
  );
}

/** A1 (thông báo đơn) hoặc A2 (xem tài khoản), mục 5.8. */
export function playAdminAdhoc({ plan, staff, reaction, rng, sessionKey, deadlineMs }) {
  const user = adminUser({ scenario: 'admin_adhoc', plan, reaction, rng, sessionKey, deadlineMs });
  let endReason = 'goal_done';
  try {
    user.begin('A_LOGIN');
    user.login();
    user.think(drawThink(rng, staff.think, 'A_ACCOUNTS'));
    user.begin('A_ACCOUNTS');
    const students = accounts(user, rng, 'student').filter((item) =>
      item.email.endsWith('@seed.test'),
    );
    if (plan.goal === 'A1') {
      const sends = rng.int(1, 3);
      for (let index = 0; index < sends && students.length > 0; index += 1) {
        user.think(drawThink(rng, staff.think, 'A_NOTIFY'));
        user.begin('A_NOTIFY');
        user.call('POST', `${P}/notifications`, {
          expected: [201],
          idempotent: false,
          body: {
            student_id: rng.pick(students).id,
            title: `Thông báo ${config.runId} ${sessionKey}-${index}`,
            content_markdown: 'Thông báo do workload mức 2 gửi',
          },
        });
      }
    } else if (rng.chance(0.5)) {
      user.think(drawThink(rng, staff.think, 'A_ACCOUNTS'));
      user.begin('A_ACCOUNTS');
      accounts(user, rng, 'instructor');
    }
  } catch (error) {
    if (!(error instanceof SessionEnd)) throw error;
    endReason = error.reason;
  }
  user.finish(endReason);
}

/** A3: đợt thông báo hàng loạt, thăm dò tới khi xong hoặc hết 3 phút. */
export function playAdminBatch({ plan, staff, reaction, rng, sessionKey, deadlineMs }) {
  const user = adminUser({ scenario: 'admin_batch', plan, reaction, rng, sessionKey, deadlineMs });
  let endReason = 'goal_done';
  try {
    user.begin('A_LOGIN');
    user.login();
    user.begin('A_BATCH');
    const batch = user.call('POST', `${P}/notification-batches`, {
      expected: [201],
      idempotent: false,
      body: {
        title: `Đợt thông báo ${config.runId} ${sessionKey}`,
        content_markdown: 'Đợt thông báo do workload mức 2 tạo',
        batch_size: staff.admin.batch_size,
      },
    })?.data;
    if (batch) {
      poll(user, rng, staff.background_wait.batch, 'đợt thông báo xong', () => {
        const current = user.call('GET', `${P}/notification-batches/${batch.id}`, {
          name: 'GET /api/v1/notification-batches/:batch_id',
        })?.data;
        user.call('GET', `${P}/notification-batches/${batch.id}/delivery-status`, {
          name: 'GET /api/v1/notification-batches/:batch_id/delivery-status',
        });
        return current && !['PENDING', 'PROCESSING', 'DISPATCHING'].includes(current.status)
          ? current
          : null;
      });
    }
  } catch (error) {
    if (!(error instanceof SessionEnd)) throw error;
    endReason = error.reason;
  }
  user.finish(endReason);
}

/** A4: kích hoạt job dọn media (tạo ở setup), thăm dò tới khi run xong hoặc hết 2 phút. */
export function playAdminCleanup({ plan, staff, reaction, rng, sessionKey, deadlineMs, jobId }) {
  const user = adminUser({
    scenario: 'admin_cleanup',
    plan,
    reaction,
    rng,
    sessionKey,
    deadlineMs,
  });
  let endReason = 'goal_done';
  try {
    user.begin('A_LOGIN');
    user.login();
    user.begin('A_CLEANUP');
    const run = user.call('POST', `${P}/scheduler/jobs/${jobId}/runs`, {
      name: 'POST /api/v1/scheduler/jobs/:job_id/runs',
      expected: [201],
      idempotent: true,
      body: { idempotency_key: `${config.runId}-${sessionKey}` },
    })?.data;
    if (run) {
      poll(user, rng, staff.background_wait.cleanup, 'run dọn media xong', () => {
        const runs =
          user.call('GET', `${P}/scheduler/jobs/${jobId}/runs?page_size=20`, {
            name: 'GET /api/v1/scheduler/jobs/:job_id/runs',
          })?.data ?? [];
        const found = runs.find((item) => item.id === run.id);
        return found && (found.status === 'SUCCEEDED' || found.status === 'FAILED') ? found : null;
      });
    }
  } catch (error) {
    if (!(error instanceof SessionEnd)) throw error;
    endReason = error.reason;
  }
  user.finish(endReason);
}
