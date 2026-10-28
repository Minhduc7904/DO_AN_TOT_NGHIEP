import { AppError } from '@aiops-lms/common/errors';

import { ApplyLessonAiContentUseCase } from '../../src/application/lesson-ai/apply-lesson-ai-content.use-case.js';
import { CreateLessonAiJobUseCase } from '../../src/application/lesson-ai/create-lesson-ai-job.use-case.js';
import { GetLessonAiContextUseCase } from '../../src/application/lesson-ai/get-lesson-ai-context.use-case.js';
import { GetLessonAiDocumentsUseCase } from '../../src/application/lesson-ai/get-lesson-ai-documents.use-case.js';
import { GetLessonAiJobUseCase } from '../../src/application/lesson-ai/get-lesson-ai-job.use-case.js';
import { GetLessonAiJobsUseCase } from '../../src/application/lesson-ai/get-lesson-ai-jobs.use-case.js';
import { SyncLessonAiDocumentsUseCase } from '../../src/application/lesson-ai/sync-lesson-ai-documents.use-case.js';
import { UpdateLessonUseCase } from '../../src/application/use-cases/lessons/update-lesson.use-case.js';
import { createWorld, principals } from '../support/in-memory.js';
import { FakeAiService, FakeAttachments } from '../support/lesson-ai-fakes.js';
import { seedCourse, seedLesson } from '../support/seed.js';

const MEDIA = {
  pdf: 'd0000000-0000-4000-8000-000000000001',
  txt: 'd0000000-0000-4000-8000-000000000002',
  video: 'd0000000-0000-4000-8000-000000000003',
};

async function setup(): Promise<{
  world: ReturnType<typeof createWorld>;
  ai: FakeAiService;
  attachments: FakeAttachments;
  courseId: string;
  lessonId: string;
  documents: GetLessonAiDocumentsUseCase;
  sync: SyncLessonAiDocumentsUseCase;
  createJob: CreateLessonAiJobUseCase;
  jobs: GetLessonAiJobsUseCase;
  job: GetLessonAiJobUseCase;
  context: GetLessonAiContextUseCase;
  applyContent: ApplyLessonAiContentUseCase;
}> {
  const world = createWorld();
  const ai = new FakeAiService();
  const attachments = new FakeAttachments();
  const course = seedCourse(world, 'DRAFT');
  const lesson = await seedLesson(world, course.id);
  attachments.add(MEDIA.pdf, 'bai-1.pdf', 'application/pdf');
  attachments.add(MEDIA.txt, 'ghi-chu.txt', 'text/plain');
  attachments.add(MEDIA.video, 'bai-giang.mp4', 'video/mp4');
  return {
    world,
    ai,
    attachments,
    courseId: course.id,
    lessonId: lesson.id,
    documents: new GetLessonAiDocumentsUseCase(world.courses, world.lessons, ai, attachments),
    sync: new SyncLessonAiDocumentsUseCase(world.courses, world.lessons, ai, attachments),
    createJob: new CreateLessonAiJobUseCase(world.courses, world.lessons, ai, attachments),
    jobs: new GetLessonAiJobsUseCase(world.courses, world.lessons, ai),
    job: new GetLessonAiJobUseCase(world.courses, world.lessons, ai),
    context: new GetLessonAiContextUseCase(world.lessons),
    applyContent: new ApplyLessonAiContentUseCase(
      world.courses,
      world.lessons,
      new UpdateLessonUseCase(world.courses, world.lessons),
    ),
  };
}

describe('lesson AI facade: tài liệu', () => {
  it('GetLessonAiDocuments: hợp nhất tệp đính kèm của media với trạng thái do ai trả; PROCESSING hiển thị EXTRACTING', async () => {
    const { documents, ai, courseId, lessonId } = await setup();
    ai.states.set(MEDIA.pdf, {
      mediaId: MEDIA.pdf,
      status: 'PROCESSING',
      errorCode: null,
      errorMessage: null,
      textLength: 0,
      updatedAt: new Date('2026-11-02T08:00:00Z'),
    });

    const result = await documents.execute(principals.owner, courseId, lessonId);

    expect(result.map((d) => [d.mediaId, d.fileName, d.status])).toEqual([
      [MEDIA.pdf, 'bai-1.pdf', 'EXTRACTING'],
      [MEDIA.txt, 'ghi-chu.txt', 'NOT_QUEUED'],
      [MEDIA.video, 'bai-giang.mp4', 'UNSUPPORTED'],
    ]);
    expect(ai.calls.map((call) => call.method)).toEqual([]);
  });

  it('SyncLessonAiDocuments: gửi danh sách tệp và cờ retry_failed sang ai, trả trạng thái từng tệp', async () => {
    const { sync, ai, courseId, lessonId } = await setup();

    const first = await sync.execute(principals.owner, courseId, lessonId, { retryFailed: false });
    expect(first.map((d) => d.status)).toEqual(['PENDING', 'PENDING', 'UNSUPPORTED']);
    ai.states.set(MEDIA.pdf, {
      mediaId: MEDIA.pdf,
      status: 'FAILED',
      errorCode: 'EXTRACTION_FAILED',
      errorMessage: 'x',
      textLength: 0,
      updatedAt: null,
    });
    const retried = await sync.execute(principals.owner, courseId, lessonId, { retryFailed: true });

    expect(retried[0]).toMatchObject({ status: 'PENDING', errorCode: null });
    expect(ai.calls.at(-1)).toEqual({
      method: 'syncDocuments',
      args: [[MEDIA.pdf, MEDIA.txt, MEDIA.video], true],
    });
  });

  it('bài học chưa có tệp đính kèm: trả danh sách rỗng và không gọi ai', async () => {
    const { documents, sync, attachments, ai, courseId, lessonId } = await setup();
    attachments.attachments.length = 0;

    expect(await documents.execute(principals.owner, courseId, lessonId)).toEqual([]);
    expect(
      await sync.execute(principals.owner, courseId, lessonId, { retryFailed: false }),
    ).toEqual([]);
    expect(ai.calls).toEqual([]);
  });

  it('chỉ admin hoặc giảng viên sở hữu khóa học: 403; bài học không thuộc khóa học: 404; không gọi ai', async () => {
    const { documents, sync, courseId, lessonId, world, ai } = await setup();
    const other = seedCourse(world, 'DRAFT');

    await expect(
      documents.execute(principals.otherInstructor, courseId, lessonId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      sync.execute(principals.otherInstructor, courseId, lessonId, { retryFailed: false }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(documents.execute(principals.admin, courseId, lessonId)).resolves.toHaveLength(3);
    await expect(documents.execute(principals.owner, other.id, lessonId)).rejects.toMatchObject({
      status: 404,
    });
    expect(ai.calls).toEqual([]);
  });

  it('media hoặc ai không trả lời thì lỗi dependency được giữ nguyên', async () => {
    const { documents, attachments, ai, courseId, lessonId } = await setup();
    ai.failWith = AppError.dependencyUnavailable('course-ai');
    await expect(documents.execute(principals.owner, courseId, lessonId)).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });

    ai.failWith = null;
    attachments.listLessonAttachments = () => Promise.reject(new Error('media chết'));
    await expect(documents.execute(principals.owner, courseId, lessonId)).rejects.toThrow(
      'media chết',
    );
  });
});

describe('lesson AI facade: job', () => {
  it('CreateLessonAiJob: gộp id trùng, gửi người yêu cầu tường minh; trả job do ai tạo', async () => {
    const { createJob, ai, courseId, lessonId } = await setup();

    const job = await createJob.execute(principals.owner, courseId, lessonId, {
      jobType: 'GENERATE_QUIZ',
      mediaIds: [MEDIA.pdf, MEDIA.pdf, MEDIA.txt],
      questionCount: undefined,
      overwriteContent: false,
    });

    expect(job).toMatchObject({ status: 'PENDING', mediaIds: [MEDIA.pdf, MEDIA.txt] });
    expect(ai.calls.at(-1)?.args[0]).toEqual({
      jobType: 'GENERATE_QUIZ',
      courseId,
      lessonId,
      mediaIds: [MEDIA.pdf, MEDIA.txt],
      questionCount: undefined,
      overwriteContent: false,
      requestedBy: { id: principals.owner.id, role: 'instructor' },
    });
  });

  it('SYNTHESIZE_LESSON trên bài học đã có nội dung mà không ghi đè: 409 LESSON_CONTENT_EXISTS, không gọi ai', async () => {
    const { createJob, ai, courseId, lessonId, world } = await setup();
    const call = (overwrite: boolean): ReturnType<CreateLessonAiJobUseCase['execute']> =>
      createJob.execute(principals.owner, courseId, lessonId, {
        jobType: 'SYNTHESIZE_LESSON',
        mediaIds: [MEDIA.pdf],
        questionCount: undefined,
        overwriteContent: overwrite,
      });

    await expect(call(false)).rejects.toMatchObject({ code: 'LESSON_CONTENT_EXISTS', status: 409 });
    expect(ai.calls).toEqual([]);
    await expect(call(true)).resolves.toMatchObject({ overwriteContent: true });

    await world.lessons.update(lessonId, { contentMarkdown: null });
    await expect(call(false)).resolves.toMatchObject({ jobType: 'SYNTHESIZE_LESSON' });
  });

  it('tài liệu không phải tệp đính kèm của bài học: 422 AI_DOCUMENTS_NOT_EXTRACTED kèm media_ids, không gọi ai', async () => {
    const { createJob, ai, courseId, lessonId } = await setup();
    const stranger = 'd0000000-0000-4000-8000-0000000000ff';

    const error = await createJob
      .execute(principals.owner, courseId, lessonId, {
        jobType: 'GENERATE_QUIZ',
        mediaIds: [MEDIA.pdf, stranger],
        questionCount: 3,
        overwriteContent: false,
      })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'AI_DOCUMENTS_NOT_EXTRACTED',
      status: 422,
      details: { media_ids: [stranger] },
    });
    expect(ai.calls).toEqual([]);
  });

  it('lỗi nghiệp vụ của ai (job đang hoạt động, tài liệu chưa trích xuất) được giữ nguyên mã, mã HTTP và details', async () => {
    const { createJob, ai, courseId, lessonId } = await setup();
    ai.failWith = new AppError('AI_JOB_ALREADY_ACTIVE', 409, 'đã có job');

    await expect(
      createJob.execute(principals.owner, courseId, lessonId, {
        jobType: 'GENERATE_QUIZ',
        mediaIds: [MEDIA.pdf],
        questionCount: undefined,
        overwriteContent: false,
      }),
    ).rejects.toMatchObject({ code: 'AI_JOB_ALREADY_ACTIVE', status: 409 });
  });

  it('người không sở hữu khóa học không tạo/xem được job; ai không bị gọi', async () => {
    const { createJob, jobs, job, ai, courseId, lessonId } = await setup();

    await expect(
      createJob.execute(principals.otherInstructor, courseId, lessonId, {
        jobType: 'GENERATE_QUIZ',
        mediaIds: [MEDIA.pdf],
        questionCount: undefined,
        overwriteContent: false,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      jobs.execute(principals.otherInstructor, courseId, lessonId),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      job.execute(principals.otherInstructor, courseId, lessonId, MEDIA.pdf),
    ).rejects.toMatchObject({ status: 403 });
    expect(ai.calls).toEqual([]);
  });

  it('GetLessonAiJobs chuyển tiếp danh sách của ai; GetLessonAiJob trả chi tiết và 404 từ ai', async () => {
    const { createJob, jobs, job, ai, courseId, lessonId } = await setup();
    const created = await createJob.execute(principals.owner, courseId, lessonId, {
      jobType: 'GENERATE_QUIZ',
      mediaIds: [MEDIA.pdf],
      questionCount: 2,
      overwriteContent: false,
    });
    ai.details.set(created.id, { job: created, previousContentMarkdown: 'bản cũ' });

    expect(await jobs.execute(principals.owner, courseId, lessonId)).toEqual([created]);
    expect(await job.execute(principals.owner, courseId, lessonId, created.id)).toEqual({
      job: created,
      previousContentMarkdown: 'bản cũ',
    });
    await expect(
      job.execute(principals.owner, courseId, lessonId, 'a0000000-0000-4000-8000-0000000000ff'),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('lesson AI: bề mặt nội bộ cho ai-worker', () => {
  it('ai-context trả tiêu đề và nội dung; 404 khi bài học không thuộc khóa học', async () => {
    const { context, courseId, lessonId, world } = await setup();
    const other = seedCourse(world, 'DRAFT');

    await expect(context.execute(courseId, lessonId)).resolves.toMatchObject({
      title: 'Bài học',
      contentMarkdown: 'Nội dung',
    });
    await expect(context.execute(other.id, lessonId)).rejects.toMatchObject({ status: 404 });
  });

  it('ai-content: bài học có nội dung cần overwrite (409), ghi đè trả bản cũ, bài trống trả null', async () => {
    const { applyContent, courseId, lessonId, world } = await setup();
    const input = (
      overwriteContent: boolean,
    ): { contentMarkdown: string; overwriteContent: boolean } => ({
      contentMarkdown: '# Bài AI',
      overwriteContent,
    });

    await expect(
      applyContent.execute(principals.owner, courseId, lessonId, input(false)),
    ).rejects.toMatchObject({ code: 'LESSON_CONTENT_EXISTS', status: 409 });
    await expect(
      applyContent.execute(principals.owner, courseId, lessonId, input(true)),
    ).resolves.toEqual({ previousContentMarkdown: 'Nội dung' });
    expect((await world.lessons.findById(lessonId))?.contentMarkdown).toBe('# Bài AI');

    await world.lessons.update(lessonId, { contentMarkdown: null });
    await expect(
      applyContent.execute(principals.owner, courseId, lessonId, input(false)),
    ).resolves.toEqual({ previousContentMarkdown: null });
  });

  it('ai-content: chạy dưới danh nghĩa người yêu cầu nên người không sở hữu bị 403 và nội dung không đổi', async () => {
    const { applyContent, courseId, lessonId, world } = await setup();

    await expect(
      applyContent.execute(principals.otherInstructor, courseId, lessonId, {
        contentMarkdown: 'x',
        overwriteContent: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await world.lessons.findById(lessonId))?.contentMarkdown).toBe('Nội dung');
  });
});
