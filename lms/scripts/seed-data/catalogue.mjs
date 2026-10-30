// Danh mục khai báo mọi database và bảng seeder hỗ trợ. Thêm bảng mới = thêm một mục vào `datasets`;
// runner, TUI, kiểm tra và fingerprint đều đọc từ đây.
//
// Mỗi mục (dataset):
// - key: `<db>.<tên>`; label: nhãn trong TUI; table: bảng đích; kind: loại id (ids.mjs).
// - derived: true nếu số dòng tự tính từ mục khác (không nhập).
// - needs: các mục cha phải có dữ liệu (số dòng > 0) khi mục này > 0.
// - defaults: số dòng mặc định theo profile; min/max: ràng buộc theo số lượng các mục khác.
// - statements(ctx, from, to): các câu INSERT ... SELECT cho chỉ số [from, to] (câu đầu là bảng chính).
// - prepare(ctx): bảng tạm cần dựng trước khi nạp (sống trong transaction của DB).
import { documentCount, thumbnailCount } from './distribution.mjs';
import { hashedIdSql, idSql, kindRangeSql, randomSql, seedRangeSql, timeSql } from './ids.mjs';

export const PROFILES = Object.freeze(['small', 'medium', 'large']);
export const BOOTSTRAP_ADMIN_ID = '00000000-0000-4000-8000-000000000001';
export const SEED_PASSWORD = 'seed-password';

const MAX_LESSONS_PER_COURSE = 200;
const MAX_QUIZZES_PER_LESSON = 20;
const MAX_QUESTIONS_PER_QUIZ = 100;
const MAX_OPTIONS_PER_QUESTION = 10;
const MAX_BATCH_RECIPIENTS = 100_000;

const generate = (from, to) => `generate_series(${from}::bigint, ${to}::bigint) AS g(i)`;
const text = (value) => `'${String(value).replaceAll("'", "''")}'`;
const profile = (small, medium, large) => ({ small, medium, large });

function mediaTypeSql(z) {
  return `CASE (${z}) % 10 WHEN 0 THEN 'IMAGE' WHEN 1 THEN 'IMAGE' WHEN 2 THEN 'IMAGE' WHEN 3 THEN 'IMAGE' WHEN 4 THEN 'IMAGE' WHEN 5 THEN 'DOCUMENT' WHEN 6 THEN 'DOCUMENT' WHEN 7 THEN 'VIDEO' WHEN 8 THEN 'AUDIO' ELSE 'OTHER' END`;
}

function mediaAttributeSql(z, images, documents, videos, audios, others) {
  return `CASE (${z}) % 10 WHEN 0 THEN ${images} WHEN 1 THEN ${images} WHEN 2 THEN ${images} WHEN 3 THEN ${images} WHEN 4 THEN ${images} WHEN 5 THEN ${documents} WHEN 6 THEN ${documents} WHEN 7 THEN ${videos} WHEN 8 THEN ${audios} ELSE ${others} END`;
}

function questionTypeSql(ctx, question) {
  return `CASE WHEN ${randomSql(ctx.seed, `'qt:' || (${question})`, 5)} = 0 THEN 'MULTIPLE_CHOICE' ELSE 'SINGLE_CHOICE' END`;
}

/** Câu trả lời đúng của attempt `rn` ở câu hỏi `question` (70%); quyết định cả điểm lẫn đáp án đã chọn. */
function answerIsCorrectSql(ctx, rn, question) {
  return `${randomSql(ctx.seed, `(${rn})::text || ':' || (${question})::text`, 100)} < 70`;
}

// ---- identity_db -----------------------------------------------------------------------------

const identityUser = (role, kind, emailPrefix, fullNamePrefix) => (ctx, from, to) => [
  {
    table: 'identity_users',
    columns: {
      id: idSql(kind, 'g.i'),
      email: `${text(`${emailPrefix}-`)} || g.i || '@seed.test'`,
      password_hash: text(ctx.passwordHash),
      full_name: `${text(`${fullNamePrefix} `)} || g.i`,
      role: text(role),
      status: text('ACTIVE'),
      created_at: timeSql('g.i'),
      updated_at: timeSql('g.i'),
    },
    from: `FROM ${generate(from, to)}`,
  },
];

const identityDatasets = [
  {
    key: 'identity.students',
    db: 'identity',
    table: 'identity_users',
    kind: 'user',
    label: 'identity_users (học viên)',
    defaults: profile(1_000, 20_000, 100_000),
    statements: identityUser('student', 'user', 'seed-student', 'Học viên Seed'),
  },
  {
    key: 'identity.instructors',
    db: 'identity',
    table: 'identity_users',
    kind: 'instructor',
    label: 'identity_users (giảng viên)',
    defaults: profile(10, 50, 200),
    statements: identityUser('instructor', 'instructor', 'seed-instructor', 'Giảng viên Seed'),
  },
  {
    key: 'identity.student_profiles',
    db: 'identity',
    table: 'identity_student_profiles',
    kind: 'user',
    // Khóa chính của bảng hồ sơ là user_id (trùng id tài khoản student cùng khoảng seed).
    idColumn: 'user_id',
    label: 'identity_student_profiles',
    derived: true,
    needs: ['identity.students'],
    // Mỗi tài khoản student seed có đúng một hồ sơ ACTIVE, nên đăng nhập student được và
    // notification-worker thấy đủ recipient.
    count: (ctx) => ctx.get('identity.students'),
    statements: (_ctx, from, to) => [
      {
        table: 'identity_student_profiles',
        columns: {
          user_id: idSql('user', 'g.i'),
          status: text('ACTIVE'),
          created_at: timeSql('g.i'),
          updated_at: timeSql('g.i'),
        },
        from: `FROM ${generate(from, to)}`,
      },
    ],
  },
];

// ---- course_db -------------------------------------------------------------------------------

const courseDatasets = [
  {
    key: 'course.courses',
    db: 'course',
    table: 'courses',
    kind: 'course',
    label: 'courses',
    needs: ['identity.instructors'],
    defaults: profile(20, 100, 300),
    statements: (ctx, from, to) => [
      {
        table: 'courses',
        columns: {
          id: idSql('course', 'g.i'),
          name: `'Khóa học seed ' || g.i`,
          description_markdown: `'Mô tả khóa học seed số ' || g.i`,
          status: text('PUBLISHED'),
          instructor_id: idSql(
            'instructor',
            `((g.i - 1) % ${ctx.get('identity.instructors')}) + 1`,
          ),
          created_at: timeSql('g.i'),
          updated_at: timeSql('g.i'),
        },
        from: `FROM ${generate(from, to)}`,
      },
    ],
  },
  {
    key: 'course.lessons',
    db: 'course',
    table: 'lessons',
    kind: 'lesson',
    label: 'lessons',
    needs: ['course.courses'],
    defaults: profile(100, 800, 3_000),
    max: (ctx) => ctx.get('course.courses') * MAX_LESSONS_PER_COURSE,
    statements: (ctx, from, to) => {
      const courses = ctx.get('course.courses');
      return [
        {
          table: 'lessons',
          columns: {
            id: idSql('lesson', 'g.i'),
            course_id: idSql('course', `((g.i - 1) % ${courses}) + 1`),
            title: `'Bài học seed ' || g.i`,
            content_markdown: `'# Bài học seed ' || g.i`,
            display_order: `((g.i - 1) / ${courses}) + 1`,
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'course.quizzes',
    db: 'course',
    table: 'quizzes',
    kind: 'quiz',
    label: 'quizzes',
    needs: ['course.lessons'],
    defaults: profile(60, 500, 2_000),
    max: (ctx) => ctx.get('course.lessons') * MAX_QUIZZES_PER_LESSON,
    statements: (ctx, from, to) => {
      const lessons = ctx.get('course.lessons');
      return [
        {
          table: 'quizzes',
          columns: {
            id: idSql('quiz', 'g.i'),
            lesson_id: idSql('lesson', `((g.i - 1) % ${lessons}) + 1`),
            title: `'Quiz seed ' || g.i`,
            description_markdown: `'Quiz seed số ' || g.i`,
            display_order: `((g.i - 1) / ${lessons}) + 1`,
            status: text('PUBLISHED'),
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'course.questions',
    db: 'course',
    table: 'quiz_questions',
    kind: 'question',
    label: 'quiz_questions',
    needs: ['course.quizzes'],
    defaults: profile(300, 3_000, 16_000),
    max: (ctx) => ctx.get('course.quizzes') * MAX_QUESTIONS_PER_QUIZ,
    statements: (ctx, from, to) => {
      const quizzes = ctx.get('course.quizzes');
      return [
        {
          table: 'quiz_questions',
          columns: {
            id: idSql('question', 'g.i'),
            quiz_id: idSql('quiz', `((g.i - 1) % ${quizzes}) + 1`),
            question_markdown: `'Câu hỏi seed số ' || g.i`,
            question_type: `(${questionTypeSql(ctx, 'g.i')})::quiz_question_type`,
            points: `(1 + ${randomSql(ctx.seed, `'pt:' || g.i`, 5)})::numeric(6,2)`,
            display_order: `((g.i - 1) / ${quizzes}) + 1`,
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'course.options',
    db: 'course',
    table: 'quiz_options',
    kind: 'option',
    label: 'quiz_options',
    needs: ['course.questions'],
    defaults: profile(1_200, 12_000, 64_000),
    min: (ctx) => ctx.get('course.questions') * 2,
    max: (ctx) => ctx.get('course.questions') * MAX_OPTIONS_PER_QUESTION,
    statements: (ctx, from, to) => {
      const questions = ctx.get('course.questions');
      const options = ctx.get('course.options');
      const question = '(x.k)';
      const count = `(${options} / ${questions} + CASE WHEN x.k <= ${options} % ${questions} THEN 1 ELSE 0 END)`;
      const pick = `(1 + ${randomSql(ctx.seed, `'pick:' || x.k`, 1_000_000)} % ${count})`;
      return [
        {
          table: 'quiz_options',
          columns: {
            id: idSql('option', 'g.i'),
            question_id: idSql('question', 'x.k'),
            option_markdown: `'Phương án ' || x.ord || ' của câu ' || x.k`,
            is_correct: `CASE WHEN ${questionTypeSql(ctx, question)} = 'SINGLE_CHOICE' THEN x.ord = ${pick} ELSE (x.ord = ${pick} OR (x.ord <> ${count} AND ${randomSql(ctx.seed, `'mc:' || x.k || ':' || x.ord`, 3)} = 0)) END`,
            display_order: 'x.ord',
          },
          from: `FROM ${generate(from, to)} CROSS JOIN LATERAL (SELECT ((g.i - 1) % ${questions}) + 1 AS k, ((g.i - 1) / ${questions}) + 1 AS ord) x`,
        },
      ];
    },
  },
  {
    key: 'course.enrollments',
    db: 'course',
    table: 'enrollments',
    kind: 'enrollment',
    label: 'enrollments',
    needs: ['identity.students', 'course.courses'],
    defaults: profile(3_000, 60_000, 400_000),
    max: (ctx) => ctx.get('identity.students') * ctx.get('course.courses'),
    statements: (ctx, from, to) => {
      const students = ctx.get('identity.students');
      const courses = ctx.get('course.courses');
      return [
        {
          table: 'enrollments',
          columns: {
            id: idSql('enrollment', 'g.i'),
            course_id: idSql('course', 'x.course'),
            student_id: idSql('user', 'x.student'),
            enrolled_at: timeSql('g.i'),
          },
          from: `FROM ${generate(from, to)} CROSS JOIN LATERAL (SELECT ((g.i - 1) % ${students}) + 1 AS student, ((((g.i - 1) / ${students}) + (((g.i - 1) % ${students}) + 1) * 7919) % ${courses}) + 1 AS course) x`,
        },
      ];
    },
  },
  {
    key: 'course.progresses',
    db: 'course',
    table: 'lesson_progresses',
    kind: 'progress',
    label: 'lesson_progresses',
    needs: ['course.enrollments', 'course.lessons'],
    defaults: profile(6_000, 150_000, 1_000_000),
    max: (ctx) => ctx.capacities().progresses,
    prepare: () => [
      `CREATE TEMP TABLE seed_progress_pairs ON COMMIT DROP AS SELECT row_number() OVER (ORDER BY l.display_order, e.id) AS rn, e.student_id, l.id AS lesson_id FROM enrollments e JOIN lessons l ON l.course_id = e.course_id WHERE ${kindRangeSql('enrollment', 'e.id')} AND ${kindRangeSql('lesson', 'l.id')}`,
      'CREATE UNIQUE INDEX ON seed_progress_pairs (rn)',
    ],
    statements: (ctx, from, to) => {
      const completed = `${randomSql(ctx.seed, `'pc:' || p.rn`, 100)} < 60`;
      return [
        {
          table: 'lesson_progresses',
          columns: {
            id: idSql('progress', 'p.rn'),
            lesson_id: 'p.lesson_id',
            student_id: 'p.student_id',
            progress_percent: `CASE WHEN ${completed} THEN 100 ELSE round(${randomSql(ctx.seed, `'pp:' || p.rn`, 9900)} / 100.0, 2) END`,
            completed_at: `CASE WHEN ${completed} THEN ${timeSql('p.rn + 3600')} END`,
            updated_at: timeSql('p.rn + 3600'),
          },
          from: `FROM seed_progress_pairs p WHERE p.rn BETWEEN ${from} AND ${to}`,
        },
      ];
    },
  },
  {
    key: 'course.attempts',
    db: 'course',
    table: 'quiz_attempts',
    kind: 'attempt',
    label: 'quiz_attempts',
    needs: ['course.enrollments', 'course.quizzes', 'course.questions', 'course.options'],
    defaults: profile(2_000, 30_000, 150_000),
    max: (ctx) => ctx.capacities().attempts,
    prepare: () => [
      `CREATE TEMP TABLE seed_attempt_pairs ON COMMIT DROP AS SELECT row_number() OVER (ORDER BY q.display_order, l.display_order, e.id) AS rn, e.student_id, q.id AS quiz_id FROM enrollments e JOIN lessons l ON l.course_id = e.course_id JOIN quizzes q ON q.lesson_id = l.id WHERE ${kindRangeSql('enrollment', 'e.id')} AND ${kindRangeSql('lesson', 'l.id')} AND ${kindRangeSql('quiz', 'q.id')}`,
      'CREATE UNIQUE INDEX ON seed_attempt_pairs (rn)',
    ],
    statements: (ctx, from, to) => [
      {
        table: 'quiz_attempts',
        columns: {
          id: idSql('attempt', 'p.rn'),
          quiz_id: 'p.quiz_id',
          student_id: 'p.student_id',
          status: text('SUBMITTED'),
          started_at: timeSql('p.rn * 60'),
          updated_at: timeSql('p.rn * 60 + 600'),
          submitted_at: timeSql('p.rn * 60 + 600'),
          // Điểm tính từ cùng quyết định đúng/sai dùng để chọn đáp án, nên luôn khớp quiz_attempt_answers.
          score: `COALESCE(sum(qq.points) FILTER (WHERE ${answerIsCorrectSql(ctx, 'p.rn', 'qq.id')}), 0)`,
          max_score: 'COALESCE(sum(qq.points), 0)',
        },
        from: `FROM seed_attempt_pairs p LEFT JOIN quiz_questions qq ON qq.quiz_id = p.quiz_id WHERE p.rn BETWEEN ${from} AND ${to} GROUP BY p.rn, p.quiz_id, p.student_id`,
      },
    ],
  },
  {
    key: 'course.answers',
    db: 'course',
    table: 'quiz_attempt_answers',
    kind: 'answer',
    label: 'quiz_attempt_answers',
    derived: true,
    estimated: true,
    needs: ['course.attempts'],
    count: (ctx) => {
      const attempts = ctx.get('course.attempts');
      const quizzes = ctx.get('course.quizzes');
      if (attempts === 0 || quizzes === 0) return 0;
      return Math.round((attempts * ctx.get('course.questions')) / quizzes);
    },
    // Tiến độ tính theo số attempt vì số đáp án thật chỉ biết sau khi nạp.
    units: (ctx) => ctx.get('course.attempts'),
    prepare: () => [
      `CREATE TEMP TABLE seed_question_wrong ON COMMIT DROP AS SELECT question_id, COALESCE(min(display_order) FILTER (WHERE NOT is_correct), 1) AS wrong_order FROM quiz_options WHERE ${kindRangeSql('option')} GROUP BY question_id`,
      'CREATE UNIQUE INDEX ON seed_question_wrong (question_id)',
    ],
    statements: (ctx, from, to) => [
      {
        table: 'quiz_attempt_answers',
        columns: {
          id: hashedIdSql('answer', `p.rn::text || ':' || o.id::text`),
          attempt_id: idSql('attempt', 'p.rn'),
          question_id: 'qq.id',
          selected_option_id: 'o.id',
        },
        from: `FROM seed_attempt_pairs p JOIN quiz_questions qq ON qq.quiz_id = p.quiz_id JOIN quiz_options o ON o.question_id = qq.id JOIN seed_question_wrong w ON w.question_id = qq.id WHERE p.rn BETWEEN ${from} AND ${to} AND CASE WHEN ${answerIsCorrectSql(ctx, 'p.rn', 'qq.id')} THEN o.is_correct ELSE o.display_order = w.wrong_order END`,
      },
    ],
  },
];

// ---- media_db --------------------------------------------------------------------------------

const mediaDatasets = [
  {
    key: 'media.objects',
    db: 'media',
    table: 'media_objects',
    kind: 'media',
    label: 'media_objects (tệp gốc)',
    needs: ['identity.instructors'],
    defaults: profile(500, 5_000, 50_000),
    statements: (ctx, from, to) => {
      const z = '(g.i - 1)';
      const extension = mediaAttributeSql(
        z,
        text('jpg'),
        text('docx'),
        text('mp4'),
        text('mp3'),
        text('bin'),
      );
      return [
        {
          table: 'media_objects',
          columns: {
            id: idSql('media', 'g.i'),
            type: `(${mediaTypeSql(z)})::media_type`,
            status: text('READY'),
            thumbnail_status: `(CASE WHEN ${z} % 10 IN (0, 1, 2, 3, 4, 7) THEN 'READY' ELSE 'NOT_APPLICABLE' END)::media_thumbnail_status`,
            original_name: `'seed-media-' || g.i || '.' || ${extension}`,
            mime_type: mediaAttributeSql(
              z,
              text('image/jpeg'),
              text('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
              text('video/mp4'),
              text('audio/mpeg'),
              text('application/octet-stream'),
            ),
            size_bytes: `10000 + ${randomSql(ctx.seed, `'sz:' || g.i`, 4_000_000)}`,
            checksum_sha256: `md5('seed:' || g.i) || md5('sha:' || g.i)`,
            bucket: mediaAttributeSql(
              z,
              text('images'),
              text('documents'),
              text('videos'),
              text('audios'),
              text('other'),
            ),
            object_key: `'seed/' || ${idSql('media', 'g.i')}::text || '.' || ${extension}`,
            uploaded_by: idSql(
              'instructor',
              `((g.i - 1) % ${ctx.get('identity.instructors')}) + 1`,
            ),
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'media.thumbnails',
    db: 'media',
    table: 'media_objects',
    kind: 'mediaThumbnail',
    label: 'media_objects (thumbnail)',
    derived: true,
    needs: ['media.objects'],
    count: (ctx) => thumbnailCount(ctx.get('media.objects')),
    statements: (ctx, from, to) => {
      const instructors = ctx.get('identity.instructors');
      const original = `((((g.i - 1) / 6) * 10) + (ARRAY[0, 1, 2, 3, 4, 7])[((g.i - 1) % 6) + 1] + 1)`;
      const uploader = idSql('instructor', `((${original} - 1) % ${instructors}) + 1`);
      const source = `FROM ${generate(from, to)}`;
      return [
        {
          table: 'media_objects',
          columns: {
            id: idSql('mediaThumbnail', 'g.i'),
            type: text('IMAGE'),
            status: text('READY'),
            thumbnail_status: text('NOT_APPLICABLE'),
            original_name: `${idSql('media', original)}::text || '.webp'`,
            mime_type: text('image/webp'),
            size_bytes: `5000 + ${randomSql(ctx.seed, `'tsz:' || g.i`, 50_000)}`,
            checksum_sha256: `md5('tseed:' || g.i) || md5('tsha:' || g.i)`,
            bucket: text('images'),
            object_key: `'seed/thumbnails/' || ${idSql('mediaThumbnail', 'g.i')}::text || '.webp'`,
            uploaded_by: uploader,
            source_media_id: idSql('media', original),
            created_at: timeSql(original),
            updated_at: timeSql(original),
          },
          from: source,
        },
        {
          table: 'media_usages',
          columns: {
            id: idSql('thumbnailUsage', 'g.i'),
            media_id: idSql('mediaThumbnail', 'g.i'),
            owner_kind: text('MEDIA'),
            owner_id: idSql('media', original),
            usage_type: text('MEDIA_THUMBNAIL'),
            position: '0',
            created_by: uploader,
            created_at: timeSql(original),
          },
          from: source,
        },
      ];
    },
  },
  {
    key: 'media.usages',
    db: 'media',
    table: 'media_usages',
    kind: 'mediaUsage',
    label: 'media_usages',
    needs: ['media.objects', 'course.courses', 'course.lessons'],
    defaults: profile(700, 7_000, 70_000),
    // Mỗi tệp gốc cần ít nhất một usage để job dọn media không xóa nhầm dữ liệu seed.
    min: (ctx) => ctx.get('media.objects'),
    max: (ctx) =>
      ctx.get('media.objects') * Math.min(ctx.get('course.courses'), ctx.get('course.lessons')),
    statements: (ctx, from, to) => {
      const media = ctx.get('media.objects');
      const courses = ctx.get('course.courses');
      const lessons = ctx.get('course.lessons');
      const students = ctx.get('identity.students');
      const instructors = ctx.get('identity.instructors');
      const x = {
        m: `(((g.i - 1) % ${media}) + 1)`,
        round: `((g.i - 1) / ${media})`,
      };
      // Thứ tự ảnh gốc (1-based) trong dãy media: 5 ảnh trên mỗi 10 tệp.
      const imageOrdinal = `((((${x.m} - 1) / 10) * 5) + ((${x.m} - 1) % 10) + 1)`;
      const isImage = `((${x.m} - 1) % 10) < 5`;
      const usageType = `CASE WHEN NOT (${isImage}) THEN 'LESSON_ATTACHMENT' WHEN ${x.round} = 0 AND ${imageOrdinal} <= ${courses} THEN 'COURSE_THUMBNAIL' WHEN ${x.round} = 0 AND ${imageOrdinal} <= ${courses + students} THEN 'USER_AVATAR' ELSE 'COURSE_GALLERY' END`;
      const galleryOwner = `(((${x.m} - 1 + ${x.round}) % ${courses}) + 1)`;
      return [
        {
          table: 'media_usages',
          columns: {
            id: idSql('mediaUsage', 'g.i'),
            media_id: idSql('media', x.m),
            owner_kind: `(CASE ${usageType} WHEN 'USER_AVATAR' THEN 'USER' ELSE 'COURSE' END)::media_usage_owner_kind`,
            owner_id: `CASE ${usageType} WHEN 'LESSON_ATTACHMENT' THEN ${idSql('lesson', `((${x.m} - 1 + ${x.round}) % ${lessons}) + 1`)} WHEN 'COURSE_THUMBNAIL' THEN ${idSql('course', imageOrdinal)} WHEN 'USER_AVATAR' THEN ${idSql('user', `${imageOrdinal} - ${courses}`)} ELSE ${idSql('course', galleryOwner)} END`,
            usage_type: `(${usageType})::media_usage_type`,
            position: x.round,
            created_by: idSql('instructor', `((${x.m} - 1) % ${instructors}) + 1`),
            created_at: timeSql('g.i'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
];

// ---- notification_db -------------------------------------------------------------------------

const notificationDatasets = [
  {
    key: 'notification.single',
    db: 'notification',
    table: 'notifications',
    kind: 'notification',
    label: 'notifications (đơn lẻ)',
    needs: ['identity.students'],
    defaults: profile(2_000, 40_000, 300_000),
    statements: (ctx, from, to) => {
      const read = `${randomSql(ctx.seed, `'nr:' || g.i`, 2)} = 0`;
      return [
        {
          table: 'notifications',
          columns: {
            id: idSql('notification', 'g.i'),
            student_id: idSql('user', `((g.i - 1) % ${ctx.get('identity.students')}) + 1`),
            title: `'Thông báo seed ' || g.i`,
            content_markdown: `'Nội dung thông báo seed số ' || g.i`,
            source_type: text('SINGLE'),
            status: `CASE WHEN ${read} THEN 'READ' ELSE 'UNREAD' END::notification_status`,
            email_status: text('NOT_REQUESTED'),
            created_by: text(BOOTSTRAP_ADMIN_ID),
            created_at: timeSql('g.i'),
            read_at: `CASE WHEN ${read} THEN ${timeSql('g.i + 60')} END`,
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'notification.batches',
    db: 'notification',
    table: 'notification_batches',
    kind: 'notificationBatch',
    label: 'notification_batches (đã hoàn tất)',
    defaults: profile(3, 10, 30),
    statements: (ctx, from, to) => {
      const batches = ctx.get('notification.batches');
      const items = ctx.get('notification.items');
      const requested = `(${items} / ${batches} + CASE WHEN g.i <= ${items} % ${batches} THEN 1 ELSE 0 END)`;
      return [
        {
          table: 'notification_batches',
          columns: {
            id: idSql('notificationBatch', 'g.i'),
            title: `'Đợt thông báo seed ' || g.i`,
            content_markdown: `'Nội dung đợt thông báo seed số ' || g.i`,
            target_scope: text('ALL_STUDENTS'),
            status: text('COMPLETED'),
            batch_size: '500',
            requested_count: requested,
            success_count: requested,
            failed_count: '0',
            created_by: text(BOOTSTRAP_ADMIN_ID),
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i + 3600'),
            completed_at: timeSql('g.i + 3600'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'notification.items',
    db: 'notification',
    table: 'notification_batch_items',
    kind: 'notificationItem',
    label: 'notification_batch_items (đã gửi)',
    needs: ['notification.batches', 'identity.students'],
    defaults: profile(1_500, 50_000, 600_000),
    max: (ctx) =>
      ctx.get('notification.batches') *
      Math.min(ctx.get('identity.students'), MAX_BATCH_RECIPIENTS),
    statements: (ctx, from, to) => {
      const batches = ctx.get('notification.batches');
      return [
        {
          table: 'notification_batch_items',
          columns: {
            id: idSql('notificationItem', 'g.i'),
            batch_id: idSql('notificationBatch', `((g.i - 1) % ${batches}) + 1`),
            student_id: idSql('user', `((g.i - 1) / ${batches}) + 1`),
            email: `'seed-student-' || (((g.i - 1) / ${batches}) + 1) || '@seed.test'`,
            status: text('SUCCESS'),
            attempts: '1',
            next_attempt_at: timeSql('g.i'),
            notification_id: idSql('bulkNotification', 'g.i'),
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i + 60'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'notification.bulk',
    db: 'notification',
    table: 'notifications',
    kind: 'bulkNotification',
    label: 'notifications (từ đợt gửi)',
    derived: true,
    needs: ['notification.items'],
    count: (ctx) => ctx.get('notification.items'),
    statements: (ctx, from, to) => {
      const batches = ctx.get('notification.batches');
      const read = `${randomSql(ctx.seed, `'br:' || g.i`, 2)} = 0`;
      return [
        {
          table: 'notifications',
          columns: {
            id: idSql('bulkNotification', 'g.i'),
            student_id: idSql('user', `((g.i - 1) / ${batches}) + 1`),
            title: `'Đợt thông báo seed ' || (((g.i - 1) % ${batches}) + 1)`,
            content_markdown: `'Nội dung đợt thông báo seed số ' || (((g.i - 1) % ${batches}) + 1)`,
            source_type: text('BULK'),
            batch_id: idSql('notificationBatch', `((g.i - 1) % ${batches}) + 1`),
            status: `CASE WHEN ${read} THEN 'READ' ELSE 'UNREAD' END::notification_status`,
            email_status: text('SENT'),
            created_by: text(BOOTSTRAP_ADMIN_ID),
            created_at: timeSql('g.i'),
            read_at: `CASE WHEN ${read} THEN ${timeSql('g.i + 120')} END`,
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
];

// ---- ai_db -----------------------------------------------------------------------------------

const aiDatasets = [
  {
    key: 'ai.invocations',
    db: 'ai',
    table: 'ai_invocations',
    kind: 'aiInvocation',
    label: 'ai_invocations',
    defaults: profile(500, 20_000, 200_000),
    statements: (ctx, from, to) => {
      const failed = `${randomSql(ctx.seed, `'ai:' || g.i`, 10)} = 0`;
      return [
        {
          table: 'ai_invocations',
          columns: {
            id: idSql('aiInvocation', 'g.i'),
            task_key: `(ARRAY['document-extraction', 'lesson-synthesis', 'quiz-authoring'])[(g.i % 3) + 1]`,
            model_id: idSql('aiModel', '1'),
            provider_type: text('OPENAI'),
            model_name: text('seed-model'),
            status: `CASE WHEN ${failed} THEN 'FAILED' ELSE 'SUCCESS' END::ai_invocation_status`,
            error_code: `CASE WHEN ${failed} THEN 'AI_PROVIDER_ERROR' END`,
            prompt_tokens: `200 + ${randomSql(ctx.seed, `'pt:' || g.i`, 4000)}`,
            completion_tokens: `50 + ${randomSql(ctx.seed, `'ct:' || g.i`, 2000)}`,
            tool_call_count: randomSql(ctx.seed, `'tc:' || g.i`, 4),
            latency_ms: `200 + ${randomSql(ctx.seed, `'lt:' || g.i`, 8000)}`,
            created_at: timeSql('g.i'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'ai.documents',
    db: 'ai',
    table: 'ai_documents',
    kind: 'aiDocument',
    label: 'ai_documents (đã trích xuất)',
    needs: ['media.objects'],
    defaults: profile(100, 1_000, 10_000),
    max: (ctx) => documentCount(ctx.get('media.objects')),
    statements: (_ctx, from, to) => {
      const media = `(((((g.i - 1) / 2) * 10) + 5 + ((g.i - 1) % 2)) + 1)`;
      return [
        {
          table: 'ai_documents',
          columns: {
            id: idSql('aiDocument', 'g.i'),
            media_id: idSql('media', media),
            file_name: `'seed-media-' || ${media} || '.docx'`,
            content_type: text(
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ),
            media_type: text('DOCUMENT'),
            status: text('EXTRACTED'),
            attempt_count: '1',
            extracted_text: `'Văn bản trích xuất seed của tài liệu số ' || g.i`,
            created_at: timeSql(media),
            updated_at: timeSql(`${media} + 60`),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
  {
    key: 'ai.jobs',
    db: 'ai',
    table: 'ai_jobs',
    kind: 'aiJob',
    label: 'ai_jobs (đã kết thúc)',
    needs: ['course.lessons', 'course.courses', 'identity.instructors'],
    defaults: profile(100, 2_000, 20_000),
    statements: (ctx, from, to) => {
      const lessons = ctx.get('course.lessons');
      const courses = ctx.get('course.courses');
      const failed = `${randomSql(ctx.seed, `'jf:' || g.i`, 10)} >= 8`;
      const quiz = `((g.i - 1) / ${lessons}) % 2 = 1`;
      return [
        {
          table: 'ai_jobs',
          columns: {
            id: idSql('aiJob', 'g.i'),
            job_type: `CASE WHEN ${quiz} THEN 'GENERATE_QUIZ' ELSE 'SYNTHESIZE_LESSON' END::ai_job_type`,
            course_id: idSql('course', `((((g.i - 1) % ${lessons}) % ${courses})) + 1`),
            lesson_id: idSql('lesson', `((g.i - 1) % ${lessons}) + 1`),
            status: `CASE WHEN ${failed} THEN 'FAILED' ELSE 'COMPLETED' END::ai_job_status`,
            media_ids: 'ARRAY[]::uuid[]',
            question_count: `CASE WHEN ${quiz} THEN 10 END`,
            step_count: `1 + ${randomSql(ctx.seed, `'js:' || g.i`, 5)}`,
            error_code: `CASE WHEN ${failed} THEN 'AI_PROVIDER_ERROR' END`,
            requested_by_id: idSql(
              'instructor',
              `((g.i - 1) % ${ctx.get('identity.instructors')}) + 1`,
            ),
            requested_by_role: text('instructor'),
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i + 300'),
            started_at: timeSql('g.i + 10'),
            finished_at: timeSql('g.i + 300'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
];

// ---- scheduler_db ----------------------------------------------------------------------------

const schedulerDatasets = [
  {
    key: 'scheduler.jobs',
    db: 'scheduler',
    table: 'background_jobs',
    kind: 'backgroundJob',
    label: 'background_jobs (thủ công, tạm dừng)',
    defaults: profile(2, 5, 10),
    statements: (_ctx, from, to) => [
      {
        table: 'background_jobs',
        columns: {
          id: idSql('backgroundJob', 'g.i'),
          name: `'seed-job-' || g.i`,
          type: text('MEDIA_UNUSED_CLEANUP'),
          schedule_type: text('MANUAL'),
          payload: `'{}'::jsonb`,
          status: text('PAUSED'),
          allow_concurrent: 'false',
          created_by: text(BOOTSTRAP_ADMIN_ID),
          created_at: timeSql('g.i'),
          updated_at: timeSql('g.i'),
        },
        from: `FROM ${generate(from, to)}`,
      },
    ],
  },
  {
    key: 'scheduler.runs',
    db: 'scheduler',
    table: 'background_job_runs',
    kind: 'backgroundJobRun',
    label: 'background_job_runs (đã kết thúc)',
    needs: ['scheduler.jobs'],
    defaults: profile(50, 1_000, 10_000),
    statements: (ctx, from, to) => {
      const failed = `${randomSql(ctx.seed, `'rf:' || g.i`, 10)} >= 9`;
      return [
        {
          table: 'background_job_runs',
          columns: {
            id: idSql('backgroundJobRun', 'g.i'),
            background_job_id: idSql(
              'backgroundJob',
              `((g.i - 1) % ${ctx.get('scheduler.jobs')}) + 1`,
            ),
            trigger_type: text('MANUAL'),
            idempotency_key: `'seed:' || g.i`,
            payload_snapshot: `'{}'::jsonb`,
            status: `CASE WHEN ${failed} THEN 'FAILED' ELSE 'SUCCEEDED' END::background_job_run_status`,
            scheduled_at: timeSql('g.i'),
            started_at: timeSql('g.i + 1'),
            finished_at: timeSql('g.i + 5'),
            attempts: '1',
            worker_instance: text('seed'),
            error_code: `CASE WHEN ${failed} THEN 'MEDIA_CLEANUP_FAILED' END`,
            error_message: `CASE WHEN ${failed} THEN 'Dữ liệu seed: lần chạy thất bại' END`,
            output_json: `CASE WHEN ${failed} THEN NULL ELSE '{"seeded": true}'::jsonb END`,
            created_by: text(BOOTSTRAP_ADMIN_ID),
            created_at: timeSql('g.i'),
            updated_at: timeSql('g.i + 5'),
          },
          from: `FROM ${generate(from, to)}`,
        },
      ];
    },
  },
];

// ---- danh sách database ----------------------------------------------------------------------

// Thứ tự của mảng này cũng là thứ tự nạp (cha trước con, kể cả giữa các DB).
export const DATABASES = Object.freeze([
  {
    key: 'identity',
    dbName: 'identity_db',
    label: 'identity_db',
    // Xóa tài khoản kéo theo hồ sơ student và refresh token (ON DELETE CASCADE).
    wipe: ['identity_users'],
    datasets: identityDatasets,
  },
  {
    key: 'course',
    dbName: 'course_db',
    label: 'course_db',
    wipe: [
      'quiz_attempt_answers',
      'quiz_attempts',
      'lesson_progresses',
      'enrollments',
      'quiz_options',
      'quiz_questions',
      'quizzes',
      'lessons',
      'courses',
    ],
    datasets: courseDatasets,
  },
  {
    key: 'media',
    dbName: 'media_db',
    label: 'media_db',
    wipe: ['media_usages', 'media_objects'],
    datasets: mediaDatasets,
  },
  {
    key: 'notification',
    dbName: 'notification_db',
    label: 'notification_db',
    wipe: ['notification_batch_items', 'notifications', 'notification_batches'],
    datasets: notificationDatasets,
  },
  {
    key: 'ai',
    dbName: 'ai_db',
    label: 'ai_db',
    wipe: ['ai_jobs', 'ai_documents', 'ai_invocations'],
    datasets: aiDatasets,
  },
  {
    key: 'scheduler',
    dbName: 'scheduler_db',
    label: 'scheduler_db',
    wipe: ['background_job_runs', 'background_jobs'],
    datasets: schedulerDatasets,
  },
]);

export const DATASETS = Object.freeze(DATABASES.flatMap((database) => database.datasets));

export function findDatabase(key) {
  return DATABASES.find((database) => database.key === key);
}

export function findDataset(key) {
  return DATASETS.find((dataset) => dataset.key === key);
}

/** Câu DELETE dữ liệu seed của một bảng (theo khoảng id, dùng được chỉ mục khóa chính). */
export function wipeStatement(table) {
  return `DELETE FROM ${table} WHERE ${seedRangeSql()}`;
}

/** Câu đếm số dòng seed hiện có của một mục. */
export function countStatement(dataset) {
  return `SELECT count(*)::int AS count FROM ${dataset.table} WHERE ${kindRangeSql(dataset.kind, dataset.idColumn ?? 'id')}`;
}

/** Câu băm nội dung các dòng seed của một mục (thứ tự theo id nên cùng dữ liệu thì cùng băm). */
export function fingerprintStatement(dataset) {
  return `SELECT count(*)::int AS count, COALESCE(md5(string_agg(md5(t::text), '' ORDER BY t.${dataset.idColumn ?? 'id'})), '') AS hash FROM ${dataset.table} t WHERE ${kindRangeSql(dataset.kind, `t.${dataset.idColumn ?? 'id'}`)}`;
}
