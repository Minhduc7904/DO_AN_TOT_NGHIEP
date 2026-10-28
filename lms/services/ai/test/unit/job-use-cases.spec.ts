import { AppError } from '@aiops-lms/common/errors';

import { CreateJobUseCase } from '../../src/application/use-cases/jobs/create-job.use-case.js';
import { GetJobUseCase } from '../../src/application/use-cases/jobs/get-job.use-case.js';
import { ListJobsUseCase } from '../../src/application/use-cases/jobs/list-jobs.use-case.js';
import { RunJobUseCase } from '../../src/application/use-cases/jobs/run-job.use-case.js';
import { FakeClock, SequenceIds } from './fakes.js';
import {
  FakeCourse,
  InMemoryAiUnitOfWork,
  NOW,
  ScriptedCompletions,
  textReply,
  toolCall,
  toolCalls,
} from './lesson-ai-fakes.js';

const LEASE_MS = 600_000;
const CONSUMER = 'ai-worker--run-ai-job-v1';
const COURSE = 'c0000000-0000-4000-8000-000000000001';
const LESSON = 'e0000000-0000-4000-8000-000000000001';
const OWNER = { id: 'b0000000-0000-4000-8000-000000000001', role: 'instructor' };

type Script = ConstructorParameters<typeof ScriptedCompletions>[0];

function setup(script: Script = []): {
  uow: InMemoryAiUnitOfWork;
  course: FakeCourse;
  completions: ScriptedCompletions;
  create: CreateJobUseCase;
  list: ListJobsUseCase;
  get: GetJobUseCase;
  runJob: RunJobUseCase;
  addDocuments: (texts: string[]) => string[];
  createJob: (
    jobType: 'SYNTHESIZE_LESSON' | 'GENERATE_QUIZ',
    options?: { overwrite?: boolean; questionCount?: number; texts?: string[] },
  ) => Promise<string>;
} {
  const uow = new InMemoryAiUnitOfWork();
  const course = new FakeCourse();
  const completions = new ScriptedCompletions(script);
  const clock = new FakeClock(NOW);
  const ids = new SequenceIds();
  const create = new CreateJobUseCase(uow, ids);
  const addDocuments = (texts: string[]): string[] =>
    texts.map((text, index) => {
      const mediaId = `d0000000-0000-4000-8000-0000000002${String(index).padStart(2, '0')}`;
      uow.documents.rows.set(`doc-${mediaId}`, {
        id: `doc-${mediaId}`,
        mediaId,
        fileName: `t${index}.txt`,
        contentType: 'text/plain',
        mediaType: 'DOCUMENT',
        status: 'EXTRACTED',
        attemptCount: 1,
        errorCode: null,
        errorMessage: null,
        textLength: text.length,
        updatedAt: NOW,
        text,
        leaseExpiresAt: null,
        createdSeq: index,
      });
      return mediaId;
    });
  return {
    uow,
    course,
    completions,
    create,
    list: new ListJobsUseCase(uow.jobs),
    get: new GetJobUseCase(uow.jobs),
    runJob: new RunJobUseCase(uow, course, completions, clock, CONSUMER, LEASE_MS),
    addDocuments,
    createJob: async (jobType, options = {}) => {
      const mediaIds = addDocuments(options.texts ?? ['Tài liệu số một.']);
      const job = await create.execute({
        jobType,
        courseId: COURSE,
        lessonId: LESSON,
        mediaIds,
        questionCount: jobType === 'GENERATE_QUIZ' ? (options.questionCount ?? 2) : undefined,
        overwriteContent: options.overwrite ?? false,
        requestedBy: OWNER,
      });
      return job.id;
    },
  };
}

describe('CreateJob / ListJobs / GetJob', () => {
  it('tạo PENDING và gửi ai.job.run cùng lúc, gộp id trùng; GENERATE_QUIZ mặc định 10 câu, SYNTHESIZE bỏ question_count', async () => {
    const { create, addDocuments, uow } = setup();
    const [a] = addDocuments(['x']);

    const quiz = await create.execute({
      jobType: 'GENERATE_QUIZ',
      courseId: COURSE,
      lessonId: LESSON,
      mediaIds: [a ?? '', a ?? ''],
      questionCount: undefined,
      overwriteContent: false,
      requestedBy: OWNER,
    });
    const lesson = await create.execute({
      jobType: 'SYNTHESIZE_LESSON',
      courseId: COURSE,
      lessonId: LESSON,
      mediaIds: [a ?? ''],
      questionCount: 5,
      overwriteContent: true,
      requestedBy: OWNER,
    });

    expect(quiz).toMatchObject({
      status: 'PENDING',
      mediaIds: [a],
      questionCount: 10,
      requestedById: OWNER.id,
      requestedByRole: 'instructor',
    });
    expect(lesson).toMatchObject({ questionCount: null, overwriteContent: true });
    expect(uow.sent.map((c) => c.name)).toEqual(['ai.job.run', 'ai.job.run']);
    expect(uow.sent[0]?.payload).toEqual({ job_id: quiz.id });
  });

  it('tài liệu chưa EXTRACTED hoặc chưa có bản ghi: 422 AI_DOCUMENTS_NOT_EXTRACTED kèm media_ids, không tạo job', async () => {
    const { create, addDocuments, uow } = setup();
    const [a, b] = addDocuments(['x', 'y']);
    const failed = uow.documents.byMedia(b ?? '');
    if (failed) failed.status = 'FAILED';
    const unknown = 'd0000000-0000-4000-8000-000000000999';

    const error = await create
      .execute({
        jobType: 'GENERATE_QUIZ',
        courseId: COURSE,
        lessonId: LESSON,
        mediaIds: [a ?? '', b ?? '', unknown],
        questionCount: 3,
        overwriteContent: false,
        requestedBy: OWNER,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'AI_DOCUMENTS_NOT_EXTRACTED',
      status: 422,
      details: { media_ids: [b, unknown] },
    });
    expect(uow.jobs.rows.size).toBe(0);
    expect(uow.sent).toHaveLength(0);
  });

  it('đã có job cùng loại PENDING/RUNNING: 409 AI_JOB_ALREADY_ACTIVE và không gửi command; khác loại hoặc job đã xong thì tạo được', async () => {
    const { createJob, uow } = setup();
    const first = await createJob('GENERATE_QUIZ');

    await expect(createJob('GENERATE_QUIZ')).rejects.toMatchObject({
      code: 'AI_JOB_ALREADY_ACTIVE',
      status: 409,
    });
    expect(uow.sent).toHaveLength(1);

    await createJob('SYNTHESIZE_LESSON');
    const job = uow.jobs.rows.get(first);
    if (job) job.status = 'COMPLETED';
    await createJob('GENERATE_QUIZ');
    expect(uow.sent).toHaveLength(3);
  });

  it('ListJobs tối đa 10 job mới nhất; GetJob 404 khi job không thuộc bài học và trả bản nội dung cũ', async () => {
    const { createJob, uow, list, get } = setup();
    for (let index = 0; index < 12; index += 1) {
      const id = await createJob('GENERATE_QUIZ');
      const job = uow.jobs.rows.get(id);
      if (job) {
        job.status = 'COMPLETED';
        job.previousContentMarkdown = index === 11 ? 'bản cũ' : null;
      }
    }

    const recent = await list.execute(LESSON);
    expect(recent).toHaveLength(10);
    expect(recent[0]?.createdAt.getTime()).toBeGreaterThan(recent[1]?.createdAt.getTime() ?? 0);
    expect(await list.execute(LESSON, 3)).toHaveLength(3);
    expect(await list.execute('e0000000-0000-4000-8000-0000000000ff')).toEqual([]);

    const newest = recent[0];
    const detail = await get.execute(LESSON, newest?.id ?? '');
    expect(detail.previousContentMarkdown).toBe('bản cũ');
    await expect(
      get.execute('e0000000-0000-4000-8000-0000000000ff', newest?.id ?? ''),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('RunJob (ai.job.run)', () => {
  const quizArgs = {
    title: 'Quiz AI',
    description_markdown: 'Mô tả',
    questions: [
      {
        question_markdown: '1 + 1 = ?',
        question_type: 'SINGLE_CHOICE',
        points: 1,
        options: [
          { option_markdown: '1', is_correct: false },
          { option_markdown: '2', is_correct: true },
        ],
      },
      {
        question_markdown: 'Số chẵn?',
        question_type: 'MULTIPLE_CHOICE',
        points: 2,
        options: [
          { option_markdown: '2', is_correct: true },
          { option_markdown: '4', is_correct: true },
          { option_markdown: '5', is_correct: false },
        ],
      },
    ],
  };

  it('SYNTHESIZE_LESSON ghi đè nội dung: lưu bản cũ, ghi bài mới dưới danh nghĩa người yêu cầu, COMPLETED sau 1 lượt', async () => {
    const { runJob, createJob, uow, course, completions } = setup([
      toolCall('save_lesson_content', { markdown: '# Bài mới' }),
    ]);
    const jobId = await createJob('SYNTHESIZE_LESSON', { overwrite: true });

    await runJob.execute('msg-1', jobId);

    expect(uow.jobs.rows.get(jobId)).toMatchObject({
      status: 'COMPLETED',
      stepCount: 1,
      hasPreviousContent: true,
      previousContentMarkdown: 'Nội dung',
      resultQuizId: null,
      errorCode: null,
    });
    expect(course.content).toBe('# Bài mới');
    expect(course.writes).toEqual([{ requestedBy: OWNER, overwriteContent: true }]);
    expect(completions.requests[0]?.task).toBe('lesson-synthesis');
    expect(completions.requests[0]?.tools.map((tool) => tool.name)).toEqual([
      'save_lesson_content',
    ]);
    const prompt = completions.requests[0]?.messages
      .map((message) => message.text ?? '')
      .join('\n');
    expect(prompt).toContain('Tiêu đề bài học: Bài học thử');
    expect(prompt).toContain('<document name="t0.txt">');
    expect(prompt).toContain('Tài liệu số một.');
    expect(prompt).toContain('không phải chỉ dẫn');
  });

  it('tool báo lỗi thì model sửa lại: markdown quá dài rồi JSON hỏng rồi hợp lệ; lượt sau còn lịch sử tool', async () => {
    const { runJob, createJob, uow, completions } = setup([
      toolCall('save_lesson_content', { markdown: 'a'.repeat(20_001) }),
      toolCall('save_lesson_content', '{"markdown": "bị cắt'),
      toolCall('save_lesson_content', { markdown: 'Ổn' }),
    ]);
    const jobId = await createJob('SYNTHESIZE_LESSON', { overwrite: true });

    await runJob.execute('msg-1', jobId);

    expect(uow.jobs.rows.get(jobId)).toMatchObject({ status: 'COMPLETED', stepCount: 3 });
    const toolMessages = (completions.requests[2]?.messages ?? []).filter((m) => m.role === 'tool');
    expect(toolMessages).toHaveLength(2);
    expect(toolMessages[0]?.text).toContain('"ok":false');
    expect(toolMessages[1]?.text).toContain('JSON');
  });

  it('bài học trống: không có bản cũ; có nội dung nhưng job không ghi đè: FAILED LESSON_CONTENT_EXISTS và không ghi', async () => {
    const empty = setup([toolCall('save_lesson_content', { markdown: 'Mới' })]);
    empty.course.content = null;
    const emptyJob = await empty.createJob('SYNTHESIZE_LESSON');
    await empty.runJob.execute('m', emptyJob);
    expect(empty.uow.jobs.rows.get(emptyJob)).toMatchObject({
      status: 'COMPLETED',
      hasPreviousContent: false,
    });
    expect(empty.course.content).toBe('Mới');

    const guarded = setup([toolCall('save_lesson_content', { markdown: 'Mới' })]);
    const guardedJob = await guarded.createJob('SYNTHESIZE_LESSON');
    await guarded.runJob.execute('m', guardedJob);
    expect(guarded.uow.jobs.rows.get(guardedJob)).toMatchObject({
      status: 'FAILED',
      errorCode: 'LESSON_CONTENT_EXISTS',
    });
    expect(guarded.course.content).toBe('Nội dung');
  });

  it('GENERATE_QUIZ: tạo quiz đúng bài học, job COMPLETED kèm result_quiz_id', async () => {
    const { runJob, createJob, uow, course, completions } = setup([
      toolCall('create_quiz', quizArgs),
    ]);
    const jobId = await createJob('GENERATE_QUIZ');

    await runJob.execute('msg-1', jobId);

    const job = uow.jobs.rows.get(jobId);
    expect(job).toMatchObject({ status: 'COMPLETED', stepCount: 1 });
    expect(job?.resultQuizId).toMatch(/^a0000000/u);
    expect(course.quizzes).toHaveLength(1);
    expect(course.quizzes[0]).toMatchObject({ title: 'Quiz AI', descriptionMarkdown: 'Mô tả' });
    expect(completions.requests[0]?.task).toBe('quiz-authoring');
    expect(completions.requests[0]?.tools.map((tool) => tool.name)).toEqual(['create_quiz']);
  });

  it('quiz sai số câu hoặc course từ chối (400) thì trả lỗi cho model sửa, lần sau hợp lệ', async () => {
    const wrongSingle = {
      ...quizArgs,
      questions: [
        {
          ...quizArgs.questions[0],
          options: [
            { option_markdown: '1', is_correct: true },
            { option_markdown: '2', is_correct: true },
          ],
        },
        quizArgs.questions[1],
      ],
    };
    const { runJob, createJob, uow, completions, course } = setup([
      toolCall('create_quiz', { ...quizArgs, questions: [quizArgs.questions[0]] }),
      toolCall('create_quiz', wrongSingle),
      toolCall('create_quiz', quizArgs),
    ]);
    const jobId = await createJob('GENERATE_QUIZ');

    await runJob.execute('msg-1', jobId);

    expect(uow.jobs.rows.get(jobId)).toMatchObject({ status: 'COMPLETED', stepCount: 3 });
    const tools = (completions.requests[2]?.messages ?? []).filter((m) => m.role === 'tool');
    expect(tools[0]?.text).toContain('Cần đúng 2 câu hỏi');
    expect(tools[1]?.text).toContain('questions.0');
    expect(course.quizzes).toHaveLength(1);
  });

  it('model không gọi tool: FAILED AI_NO_RESULT; hết 6 lượt: FAILED AI_TOO_MANY_STEPS', async () => {
    const noTool = setup([textReply('Tôi xin phép trả lời bằng văn bản')]);
    const noToolJob = await noTool.createJob('GENERATE_QUIZ');
    await noTool.runJob.execute('m', noToolJob);
    expect(noTool.uow.jobs.rows.get(noToolJob)).toMatchObject({
      status: 'FAILED',
      errorCode: 'AI_NO_RESULT',
      stepCount: 1,
    });

    const looping = setup(
      Array.from({ length: 6 }, () => toolCall('create_quiz', { title: 'x', questions: [] })),
    );
    const loopingJob = await looping.createJob('GENERATE_QUIZ');
    await looping.runJob.execute('m', loopingJob);
    expect(looping.uow.jobs.rows.get(loopingJob)).toMatchObject({
      status: 'FAILED',
      errorCode: 'AI_TOO_MANY_STEPS',
      stepCount: 6,
    });
    expect(looping.completions.requests).toHaveLength(6);
  });

  it('công cụ lạ được báo lại cho model; nhiều tool_calls: chỉ thực thi lệnh ghi đầu tiên', async () => {
    const { runJob, createJob, uow, course } = setup([
      toolCall('drop_database', {}),
      toolCalls([
        { id: 'c1', name: 'save_lesson_content', argumentsJson: '{"markdown":"Một"}' },
        { id: 'c2', name: 'save_lesson_content', argumentsJson: '{"markdown":"Hai"}' },
      ]),
    ]);
    const jobId = await createJob('SYNTHESIZE_LESSON', { overwrite: true });

    await runJob.execute('m', jobId);

    expect(uow.jobs.rows.get(jobId)).toMatchObject({ status: 'COMPLETED', stepCount: 2 });
    expect(course.content).toBe('Một');
  });

  it('provider lỗi: job FAILED mang mã lỗi của ai, không ghi dữ liệu', async () => {
    const { runJob, createJob, uow, course } = setup([
      new AppError('AI_PROVIDER_ERROR', 502, 'Provider không phản hồi hợp lệ'),
    ]);
    const jobId = await createJob('SYNTHESIZE_LESSON', { overwrite: true });

    await runJob.execute('m', jobId);

    expect(uow.jobs.rows.get(jobId)).toMatchObject({
      status: 'FAILED',
      errorCode: 'AI_PROVIDER_ERROR',
      errorMessage: 'Provider không phản hồi hợp lệ',
      hasPreviousContent: false,
    });
    expect(course.content).toBe('Nội dung');
  });

  it('tài liệu chưa sẵn sàng hoặc quá dài: FAILED DOCUMENT_NOT_READY / DOCUMENTS_TOO_LARGE, không gọi provider', async () => {
    const notReady = setup();
    const notReadyJob = await notReady.createJob('GENERATE_QUIZ');
    for (const document of notReady.uow.documents.rows.values()) document.status = 'FAILED';
    await notReady.runJob.execute('m', notReadyJob);
    expect(notReady.uow.jobs.rows.get(notReadyJob)).toMatchObject({
      status: 'FAILED',
      errorCode: 'DOCUMENT_NOT_READY',
    });

    const tooLarge = setup();
    const tooLargeJob = await tooLarge.createJob('GENERATE_QUIZ', {
      texts: ['x'.repeat(100_000), 'y'.repeat(100_000)],
    });
    await tooLarge.runJob.execute('m', tooLargeJob);
    expect(tooLarge.uow.jobs.rows.get(tooLargeJob)).toMatchObject({
      status: 'FAILED',
      errorCode: 'DOCUMENTS_TOO_LARGE',
    });
    expect(tooLarge.completions.requests).toHaveLength(0);
  });

  it('course từ chối quyền (người yêu cầu không còn sở hữu khóa học): job FAILED FORBIDDEN, không giữ bản cũ', async () => {
    const { runJob, createJob, uow, course } = setup([
      toolCall('save_lesson_content', { markdown: 'Mới' }),
    ]);
    course.forbidden = true;
    const jobId = await createJob('SYNTHESIZE_LESSON', { overwrite: true });

    await runJob.execute('m', jobId);

    expect(uow.jobs.rows.get(jobId)).toMatchObject({ status: 'FAILED', errorCode: 'FORBIDDEN' });
    expect(uow.jobs.rows.get(jobId)?.hasPreviousContent).toBe(false);
  });

  it('giao lại: job đã chạy/đang chạy (lease còn hạn) không chạy lại; RUNNING quá hạn lease thành FAILED WORKER_INTERRUPTED', async () => {
    const { runJob, createJob, uow, completions } = setup([toolCall('create_quiz', quizArgs)]);
    const jobId = await createJob('GENERATE_QUIZ');
    await runJob.execute('m1', jobId);
    await runJob.execute('m2', jobId);
    expect(completions.requests).toHaveLength(1);
    expect(uow.jobs.rows.get(jobId)?.status).toBe('COMPLETED');

    const running = setup();
    const runningJob = await running.createJob('GENERATE_QUIZ');
    const row = running.uow.jobs.rows.get(runningJob);
    if (!row) throw new Error('thiếu job');
    Object.assign(row, { status: 'RUNNING', leaseExpiresAt: new Date(NOW.getTime() + 1) });
    await running.runJob.execute('m', runningJob);
    expect(row.status).toBe('RUNNING');

    row.leaseExpiresAt = new Date(NOW.getTime() - 1);
    await running.runJob.execute('m', runningJob);
    expect(row).toMatchObject({ status: 'FAILED', errorCode: 'WORKER_INTERRUPTED' });
    expect(running.completions.requests).toHaveLength(0);
  });

  it('markFaulted: command vào hàng đợi lỗi thì job còn hoạt động thành FAILED, job đã xong giữ nguyên', async () => {
    const { runJob, createJob, uow } = setup([toolCall('create_quiz', quizArgs)]);
    const pending = await createJob('SYNTHESIZE_LESSON');
    await runJob.markFaulted(pending);
    expect(uow.jobs.rows.get(pending)).toMatchObject({
      status: 'FAILED',
      errorCode: 'UNEXPECTED_ERROR',
    });

    const done = await createJob('GENERATE_QUIZ');
    await runJob.execute('m', done);
    await runJob.markFaulted(done);
    expect(uow.jobs.rows.get(done)?.status).toBe('COMPLETED');
  });
});
