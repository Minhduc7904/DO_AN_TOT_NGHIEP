import { SessionEnd, UserSession } from '../lib/client.js';
import { config, seedStudentEmail } from '../lib/config.js';

/**
 * Phát lại một phiên học viên (mức 2+): mỗi trạng thái của phiên → các request ở workload-design-v1
 * mục 5.2; điều kiện chặn và cách chọn đối tượng theo mục 5.5; think time lấy từ phiên (log thật hoặc
 * mô hình), không nén (mục 13.5).
 *
 * Gán dữ liệu (mục 13.4): tài khoản seed cố định theo người dùng của log; khóa học là một khóa học viên
 * đã ghi danh (chọn theo hash của người dùng), nếu chưa ghi danh khóa nào thì ghi danh vào khóa ánh xạ
 * từ khóa Moodle. Bài học, quiz chọn theo thứ tự trong khóa.
 */

const P = '/api/v1';

function pickStable(items, key) {
  if (!items || items.length === 0) return null;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1)
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return items[hash % items.length];
}

class StudentContext {
  constructor(user, setupData, session, rng) {
    this.user = user;
    this.setup = setupData;
    this.session = session;
    this.rng = rng;
    this.enrolledIds = null;
    this.course = null;
    this.lessons = null;
    this.lessonIndex = 0;
    this.lesson = null;
    this.quizzes = null;
    this.quiz = null;
    this.attempt = null;
    this.answered = false;
  }

  /** Danh sách khóa đã ghi danh; `refresh` buộc gọi lại (màn DASH luôn tải lại, mục 5.2). */
  enrollments(refresh = false) {
    if (this.enrolledIds === null || refresh) {
      const result = this.user.call('GET', `${P}/student/enrollments?page_size=50`, {
        name: 'GET /api/v1/student/enrollments',
      });
      this.enrolledIds = (result?.data ?? []).map((item) => item.course_id ?? item.course?.id);
    }
    return this.enrolledIds;
  }

  /** Khóa của phiên: khóa đã ghi danh, nếu không có thì ghi danh vào khóa ánh xạ (mục 13.4). */
  ensureCourse() {
    if (this.course) return this.course;
    const enrolled = this.enrollments().filter(Boolean);
    const chosen = pickStable(enrolled, this.session.user_key);
    if (chosen) {
      this.course = chosen;
      return chosen;
    }
    const mapped =
      this.setup.courseMap[this.session.course_key] ??
      pickStable(Object.values(this.setup.courseMap), this.session.user_key);
    this.enroll(mapped);
    this.course = mapped;
    return mapped;
  }

  enroll(courseId) {
    this.user.call('POST', `${P}/student/courses/${courseId}/enrollments`, {
      name: 'POST /api/v1/student/courses/:course_id/enrollments',
      expected: [201, 409],
      idempotent: true,
    });
    this.enrolledIds = [...(this.enrolledIds ?? []), courseId];
  }

  openCourse() {
    const courseId = this.ensureCourse();
    this.lessons =
      this.user.call('GET', `${P}/courses/${courseId}/lessons`, {
        name: 'GET /api/v1/courses/:course_id/lessons',
      })?.data ?? [];
    this.user.call('GET', `${P}/student/courses/${courseId}/progress`, {
      name: 'GET /api/v1/student/courses/:course_id/progress',
    });
  }

  ensureLessons() {
    if (this.lessons === null) this.openCourse();
    return this.lessons;
  }

  readLesson() {
    const lessons = this.ensureLessons();
    if (lessons.length === 0) return;
    this.lesson = lessons[this.lessonIndex % lessons.length];
    this.lessonIndex += 1;
    this.quizzes = null;
    this.user.call('PUT', `${P}/student/lessons/${this.lesson.id}/progress`, {
      name: 'PUT /api/v1/student/lessons/:lesson_id/progress',
      body: { progress_percent: this.rng.pick([25, 50, 75, 100]) },
      idempotent: true,
    });
  }

  listQuiz() {
    const lessons = this.ensureLessons();
    if (lessons.length === 0) return [];
    if (!this.lesson) this.lesson = lessons[this.lessonIndex % lessons.length];
    // Ưu tiên bài có quiz: thử tối đa 3 bài kế tiếp (người dùng mở trang quiz của khóa).
    for (let tries = 0; tries < 3; tries += 1) {
      this.quizzes =
        this.user.call('GET', `${P}/student/lessons/${this.lesson.id}/quizzes`, {
          name: 'GET /api/v1/student/lessons/:lesson_id/quizzes',
        })?.data ?? [];
      if (this.quizzes.length > 0) break;
      this.lesson = lessons[(this.lessonIndex + tries + 1) % lessons.length];
    }
    return this.quizzes;
  }

  startQuiz() {
    const quizzes = this.quizzes ?? this.listQuiz();
    if (quizzes.length === 0) return this.readLesson(); // bị chặn → READ_LESSON (mục 5.5)
    this.quiz = this.user.call('GET', `${P}/student/quizzes/${quizzes[0].id}`, {
      name: 'GET /api/v1/student/quizzes/:quiz_id',
    })?.data;
    if (!this.quiz) return undefined;
    const attempt = this.user.call('POST', `${P}/student/quizzes/${this.quiz.id}/attempts`, {
      name: 'POST /api/v1/student/quizzes/:quiz_id/attempts',
      expected: [200, 201, 409],
      idempotent: true,
    });
    this.attempt = attempt && attempt.status !== 409 ? attempt.data : null;
    this.answered = false;
    return undefined;
  }

  answer() {
    if (!this.attempt) this.startQuiz();
    if (!this.attempt || !this.quiz) return;
    const questions = this.quiz.questions ?? [];
    const count = Math.min(questions.length, this.rng.int(1, 3));
    const answers = questions
      .slice(0, count)
      .filter((question) => question.options?.length)
      .map((question) => ({
        question_id: question.id,
        option_ids: question.options?.length ? [this.rng.pick(question.options).id] : [],
      }));
    if (answers.length === 0) return;
    this.user.call('PUT', `${P}/student/attempts/${this.attempt.id}/answers`, {
      name: 'PUT /api/v1/student/attempts/:attempt_id/answers',
      body: { answers },
      idempotent: true,
    });
    this.answered = true;
  }

  submit() {
    if (!this.attempt || !this.answered) this.answer(); // bị chặn → ANSWER (mục 5.5)
    if (!this.attempt) return;
    this.user.call('POST', `${P}/student/attempts/${this.attempt.id}/submit`, {
      name: 'POST /api/v1/student/attempts/:attempt_id/submit',
      expected: [200, 409],
      idempotent: true,
    });
    this.attempt = null;
  }

  notifications() {
    const inbox =
      this.user.call('GET', `${P}/notifications/me?page_size=20`, {
        name: 'GET /api/v1/notifications/me',
      })?.data ?? [];
    const roll = this.rng.next();
    const unread = inbox.find((item) => item.status === 'UNREAD' || item.read_at === null);
    if (roll < 0.7 && unread) {
      this.user.call('PATCH', `${P}/notifications/${unread.id}/read`, {
        name: 'PATCH /api/v1/notifications/:notification_id/read',
        idempotent: true,
      });
    } else if (roll < 0.9 && unread) {
      this.user.call('POST', `${P}/notifications/read-all`, { idempotent: true });
    }
  }

  browse() {
    const page = this.rng.int(1, 3);
    this.catalogue =
      this.user.call('GET', `${P}/courses?page=${page}&page_size=10`, {
        name: 'GET /api/v1/courses',
      })?.data ?? [];
  }

  viewCourse() {
    if (!this.catalogue || this.catalogue.length === 0) this.browse();
    const course = this.rng.pick(
      this.catalogue.length > 0 ? this.catalogue : [{ id: this.ensureCourse() }],
    );
    this.viewed = course.id;
    this.user.call('GET', `${P}/courses/${course.id}`, { name: 'GET /api/v1/courses/:course_id' });
  }

  enrollState() {
    const target =
      this.viewed ?? this.setup.courseMap[this.session.course_key] ?? this.ensureCourse();
    this.enroll(target);
    this.course = target;
    this.lessons = null;
  }

  viewMedia() {
    const pool = this.setup.mediaIds ?? [];
    if (pool.length === 0) return; // không có kho media của run → bỏ qua (mục 5.5)
    const mediaId = this.rng.pick(pool);
    const kind = this.rng.chance(0.7) ? 'thumbnail' : 'content';
    this.user.call('GET', `${P}/media/${mediaId}/${kind}`, {
      name: `GET /api/v1/media/:media_id/${kind}`,
      auth: false,
    });
  }
}

const STATE_HANDLERS = {
  DASH: (ctx) => {
    ctx.enrollments(true);
    ctx.user.call('GET', `${P}/notifications/me?status=UNREAD&page_size=20`, {
      name: 'GET /api/v1/notifications/me',
    });
  },
  BROWSE: (ctx) => ctx.browse(),
  VIEW_COURSE: (ctx) => ctx.viewCourse(),
  ENROLL: (ctx) => ctx.enrollState(),
  OPEN_COURSE: (ctx) => ctx.openCourse(),
  READ_LESSON: (ctx) => ctx.readLesson(),
  VIEW_MEDIA: (ctx) => ctx.viewMedia(),
  LIST_QUIZ: (ctx) => ctx.listQuiz(),
  START_QUIZ: (ctx) => ctx.startQuiz(),
  ANSWER: (ctx) => ctx.answer(),
  SUBMIT: (ctx) => ctx.submit(),
  NOTIF: (ctx) => ctx.notifications(),
  PROFILE: (ctx) => ctx.user.call('GET', `${P}/students/me`, { name: 'GET /api/v1/students/me' }),
};

export const SUPPORTED_STATES = Object.freeze([
  'LOGIN',
  'REGISTER',
  ...Object.keys(STATE_HANDLERS),
]);

/**
 * Chạy một phiên. `prelude` là các bước chèn đầu phiên (log Moodle: LOGIN, DASH; mô hình giả định:
 * LOGIN, có khi REGISTER trước). Trả `end_reason`.
 */
export function playStudentSession({
  session,
  prelude,
  plan,
  params,
  setupData,
  rng,
  sessionKey,
  deadlineMs,
}) {
  const isNewUser = prelude.includes('REGISTER');
  const email = isNewUser
    ? `replay-${config.runId}-${sessionKey}@load.test`.toLowerCase()
    : seedStudentEmail(plan.account_index);
  const password = isNewUser ? 'load-password-1' : config.seedPassword;
  const user = new UserSession({
    scenario: 'students',
    sessionKey,
    role: 'student',
    door: 'student',
    email,
    password,
    plan,
    params,
    rng,
    deadlineMs,
  });
  const ctx = new StudentContext(user, setupData, session, rng);
  let endReason = 'exit';
  try {
    for (const step of prelude) {
      user.begin(step);
      if (step === 'REGISTER') {
        user.call('POST', `${P}/auth/register`, {
          expected: [201, 409],
          body: { email, password, full_name: `Học viên phát lại ${sessionKey}` },
          idempotent: false,
        });
      } else if (step === 'LOGIN') {
        user.login();
        user.call('GET', `${P}/auth/me`, { name: 'GET /api/v1/auth/me' });
      } else {
        STATE_HANDLERS[step](ctx);
      }
    }
    session.actions.forEach((action, index) => {
      user.think(action.think_s);
      user.begin(action.state);
      // Làm mới token giữa phiên (3% phiên, mục 6.4) chạy sau begin để think time gắn đúng thao tác.
      if (plan.refresh_at_action === index) user.refresh();
      const handler = STATE_HANDLERS[action.state];
      if (!handler) throw new SessionEnd('unexpected_status', `trạng thái lạ ${action.state}`);
      handler(ctx);
      if (user.returnToDash) {
        // Phản hồi 4xx ngoài mong đợi: bỏ thao tác, quay về màn chính (mục 6.2).
        user.returnToDash = false;
        user.begin('DASH');
        STATE_HANDLERS.DASH(ctx);
      }
    });
  } catch (error) {
    if (!(error instanceof SessionEnd)) throw error;
    endReason = error.reason;
  }
  user.finish(endReason, { source_session_id: session.session_id });
  return endReason;
}
