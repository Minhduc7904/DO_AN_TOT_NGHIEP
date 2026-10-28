import { AppError } from '@aiops-lms/common/errors';
import type { Clock } from '@aiops-lms/common/ports';

import {
  AI_JOB_ERROR_CODES,
  AI_LIMITS,
  type AiJob,
  truncateErrorMessage,
} from '../../../domain/lesson-ai.js';
import type { LessonCourseClient } from '../../ports/lesson-course-client.js';
import type { ChatMessage, ChatTool, ToolCall } from '../../ports/provider-client.js';
import type { AiUnitOfWork } from '../../ports/unit-of-work.js';
import type { CreateCompletionUseCase } from '../completions/create-completion.use-case.js';
import { CREATE_QUIZ_TOOL, SAVE_LESSON_TOOL, systemPrompt, userPrompt } from './prompts.js';
import {
  CREATE_QUIZ_TOOL_DEFINITION,
  parseCreateQuizArguments,
  parseSaveLessonArguments,
  parseToolArguments,
  SAVE_LESSON_TOOL_DEFINITION,
  ToolArgumentError,
} from './tools.js';

/** Job kết thúc thất bại với mã lỗi ổn định (`error_code` của job). */
class JobFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'JobFailure';
  }
}

interface ToolOutcome {
  /** Nội dung gửi lại cho model làm kết quả tool. */
  result: string;
  /** Có giá trị khi tool đã ghi thành công: job kết thúc. */
  done: { resultQuizId: string | null } | null;
}

type Outcome =
  { ok: true; resultQuizId: string | null } | { ok: false; code: string; message: string };

/**
 * Xử lý `ai.job.run`: nhận job `PENDING` bằng lease (atomic), đọc văn bản các tài liệu đã chọn và chạy vòng
 * lặp agent tối đa {@link AI_LIMITS.maxSteps} lượt với provider (gọi trong process). Model chỉ có hai tool hẹp
 * (`save_lesson_content`, `create_quiz`); mỗi tool gọi sang `course` qua HTTP nội bộ dưới danh nghĩa người yêu
 * cầu, còn `courseId`/`lessonId` do job quyết định. Quiz luôn `DRAFT`. Job tối đa một lần ghi thành công và
 * không bao giờ chạy lại: command giao lại khi job đã `RUNNING` chỉ làm job quá hạn lease thành `FAILED
 * WORKER_INTERRUPTED`. Chuyển trạng thái cuối cùng được ghi cùng inbox trong một transaction.
 */
export class RunJobUseCase {
  constructor(
    private readonly uow: AiUnitOfWork,
    private readonly course: LessonCourseClient,
    private readonly completions: Pick<CreateCompletionUseCase, 'execute'>,
    private readonly clock: Clock,
    private readonly consumer: string,
    private readonly leaseMs: number,
  ) {}

  async execute(messageId: string, jobId: string): Promise<void> {
    const now = this.clock.now();
    const job = await this.uow.stores.jobs.claim(jobId, now, this.lease(now));
    if (!job) {
      await this.uow.stores.jobs.failIfInterrupted(jobId, now);
      return;
    }

    const outcome = await this.run(job);
    await this.uow.runOnce(messageId, this.consumer, async (stores) => {
      const at = this.clock.now();
      if (outcome.ok) await stores.jobs.complete(job.id, outcome.resultQuizId, at);
      else await stores.jobs.fail(job.id, outcome.code, outcome.message, at);
    });
  }

  /** Command vào hàng đợi lỗi sau khi hết lượt thử: không để job kẹt `PENDING|RUNNING`. */
  async markFaulted(jobId: string): Promise<void> {
    await this.uow.stores.jobs.failIfActive(
      jobId,
      AI_JOB_ERROR_CODES.unexpected,
      'Job AI thất bại do lỗi không xác định',
      this.clock.now(),
    );
  }

  private lease(now: Date): Date {
    return new Date(now.getTime() + this.leaseMs);
  }

  private async run(job: AiJob): Promise<Outcome> {
    try {
      return { ok: true, ...(await this.loop(job)) };
    } catch (error) {
      return { ok: false, ...toFailure(error) };
    }
  }

  private async loop(job: AiJob): Promise<{ resultQuizId: string | null }> {
    const context = await this.course.getContext(job.courseId, job.lessonId);

    const texts = await this.uow.stores.documents.getTexts(job.mediaIds);
    const ready = job.mediaIds.flatMap((mediaId) => {
      const entry = texts.find((candidate) => candidate.mediaId === mediaId);
      return entry?.status === 'EXTRACTED' && entry.text
        ? [{ fileName: entry.fileName, text: entry.text }]
        : [];
    });
    if (ready.length !== job.mediaIds.length) {
      throw new JobFailure(
        AI_JOB_ERROR_CODES.documentNotReady,
        'Có tài liệu chưa có văn bản trích xuất',
      );
    }
    const totalChars = ready.reduce((sum, entry) => sum + entry.text.length, 0);
    if (totalChars > AI_LIMITS.maxPromptChars) {
      throw new JobFailure(
        AI_JOB_ERROR_CODES.documentsTooLarge,
        `Tổng văn bản ${totalChars} ký tự vượt giới hạn ${AI_LIMITS.maxPromptChars}; hãy chọn ít tài liệu hơn`,
      );
    }

    const isLesson = job.jobType === 'SYNTHESIZE_LESSON';
    const tools: ChatTool[] = [
      isLesson ? SAVE_LESSON_TOOL_DEFINITION : CREATE_QUIZ_TOOL_DEFINITION,
    ];
    const messages: ChatMessage[] = [
      { role: 'system', text: systemPrompt(job.jobType, job.questionCount) },
      { role: 'user', text: userPrompt(context.title, ready) },
    ];

    for (let step = 1; step <= AI_LIMITS.maxSteps; step += 1) {
      const now = this.clock.now();
      await this.uow.stores.jobs.beginStep(job.id, now, this.lease(now));
      // `messages` đổi giữa các lượt: truyền bản sao để lời gọi trước không bị đổi theo.
      const completion = await this.completions.execute({
        task: isLesson ? 'lesson-synthesis' : 'quiz-authoring',
        messages: [...messages],
        tools,
      });
      if (completion.toolCalls.length === 0) {
        throw new JobFailure(
          AI_JOB_ERROR_CODES.noResult,
          completion.finishReason === 'length'
            ? 'Model bị cắt do hết giới hạn đầu ra và không gọi công cụ lưu kết quả'
            : 'Model không gọi công cụ lưu kết quả',
        );
      }

      messages.push({
        role: 'assistant',
        text: completion.text ?? undefined,
        toolCalls: completion.toolCalls,
      });
      let done: ToolOutcome['done'] = null;
      for (const call of completion.toolCalls) {
        if (done) {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            text: JSON.stringify({ ok: false, error: 'Job đã hoàn tất, bỏ qua lệnh gọi này' }),
          });
          continue;
        }
        const outcome = await this.executeTool(job, call);
        done = outcome.done;
        messages.push({ role: 'tool', toolCallId: call.id, text: outcome.result });
      }
      if (done) return done;
    }
    throw new JobFailure(
      AI_JOB_ERROR_CODES.tooManySteps,
      `Model không hoàn tất sau ${AI_LIMITS.maxSteps} lượt`,
    );
  }

  private async executeTool(job: AiJob, call: ToolCall): Promise<ToolOutcome> {
    const isLesson = job.jobType === 'SYNTHESIZE_LESSON';
    const expected = isLesson ? SAVE_LESSON_TOOL : CREATE_QUIZ_TOOL;
    if (call.name !== expected) {
      return failed(`Công cụ ${call.name} không tồn tại; chỉ dùng ${expected}`);
    }
    try {
      const args = parseToolArguments(call.argumentsJson);
      if (isLesson) {
        await this.saveLesson(job, parseSaveLessonArguments(args));
        return { result: JSON.stringify({ ok: true }), done: { resultQuizId: null } };
      }
      const outcome = await this.course.createQuiz({
        courseId: job.courseId,
        lessonId: job.lessonId,
        requestedBy: { id: job.requestedById, role: job.requestedByRole },
        quiz: parseCreateQuizArguments(args, job.questionCount ?? 0),
      });
      // Dữ liệu quiz không hợp lệ: trả lại cho model để sửa; lỗi khác (quyền, hệ thống) làm hỏng job.
      if (outcome.kind === 'invalid') return failed(outcome.message, outcome.details);
      return {
        result: JSON.stringify({ ok: true, quiz_id: outcome.quizId }),
        done: { resultQuizId: outcome.quizId },
      };
    } catch (error) {
      if (error instanceof ToolArgumentError) return failed(error.message, error.issues);
      throw error;
    }
  }

  private async saveLesson(job: AiJob, markdown: string): Promise<void> {
    const current = await this.course.getContext(job.courseId, job.lessonId);
    const hasContent = (current.contentMarkdown?.trim().length ?? 0) > 0;
    if (hasContent && !job.overwriteContent) {
      throw new JobFailure(
        AI_JOB_ERROR_CODES.lessonContentExists,
        'Bài học đã có nội dung từ khi tạo job; cần overwrite_content=true để ghi đè',
      );
    }
    const jobs = this.uow.stores.jobs;
    // Lưu bản cũ trước khi ghi: nếu worker chết giữa chừng thì người dùng vẫn khôi phục được.
    if (hasContent && current.contentMarkdown !== null) {
      await jobs.recordPreviousContent(job.id, current.contentMarkdown, this.clock.now());
    }
    try {
      const applied = await this.course.applyContent({
        courseId: job.courseId,
        lessonId: job.lessonId,
        requestedBy: { id: job.requestedById, role: job.requestedByRole },
        contentMarkdown: markdown,
        overwriteContent: job.overwriteContent,
      });
      // Nội dung có thể đổi giữa lúc đọc và lúc ghi: lấy bản course xác nhận đã bị thay thế.
      if (
        applied.previousContentMarkdown !== null &&
        applied.previousContentMarkdown !== current.contentMarkdown
      ) {
        await jobs.recordPreviousContent(job.id, applied.previousContentMarkdown, this.clock.now());
      }
    } catch (error) {
      if (hasContent) await jobs.clearPreviousContent(job.id, this.clock.now());
      throw error;
    }
  }
}

function failed(message: string, issues?: unknown): ToolOutcome {
  return {
    result: JSON.stringify({ ok: false, error: message, issues: issues ?? null }),
    done: null,
  };
}

function toFailure(error: unknown): { code: string; message: string } {
  if (error instanceof JobFailure) return { code: error.code, message: error.message };
  if (error instanceof AppError) {
    return { code: error.code, message: truncateErrorMessage(error.message) };
  }
  return { code: AI_JOB_ERROR_CODES.unexpected, message: 'Job AI thất bại do lỗi không xác định' };
}
