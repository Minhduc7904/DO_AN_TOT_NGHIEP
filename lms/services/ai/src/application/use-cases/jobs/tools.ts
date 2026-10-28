import { AI_LIMITS } from '../../../domain/lesson-ai.js';
import type { ChatTool } from '../../ports/provider-client.js';
import type { QuizDraftInput } from '../../ports/lesson-course-client.js';
import { CREATE_QUIZ_TOOL, SAVE_LESSON_TOOL } from './prompts.js';

export const SAVE_LESSON_TOOL_DEFINITION: ChatTool = {
  name: SAVE_LESSON_TOOL,
  description: 'Lưu nội dung bài học (Markdown) vào bài học hiện tại.',
  parametersSchema: {
    type: 'object',
    properties: {
      markdown: {
        type: 'string',
        description: `Toàn bộ bài học dạng Markdown, tối đa ${AI_LIMITS.maxLessonMarkdownChars} ký tự.`,
      },
    },
    required: ['markdown'],
  },
};

export const CREATE_QUIZ_TOOL_DEFINITION: ChatTool = {
  name: CREATE_QUIZ_TOOL,
  description: 'Tạo quiz nháp (DRAFT) cho bài học hiện tại.',
  parametersSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Tiêu đề quiz, 2–200 ký tự.' },
      description_markdown: { type: 'string', description: 'Mô tả ngắn (tùy chọn).' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question_markdown: { type: 'string' },
            question_type: { type: 'string', enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'] },
            points: { type: 'number' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  option_markdown: { type: 'string' },
                  is_correct: { type: 'boolean' },
                },
                required: ['option_markdown', 'is_correct'],
              },
            },
          },
          required: ['question_markdown', 'question_type', 'points', 'options'],
        },
      },
    },
    required: ['title', 'questions'],
  },
};

/** Lỗi đối số tool: được trả lại cho model để sửa, không làm hỏng job. */
export class ToolArgumentError extends Error {
  constructor(
    message: string,
    readonly issues: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ToolArgumentError';
  }
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ToolArgumentError(`${path} phải là object`);
  }
  return value as Record<string, unknown>;
}

export function parseToolArguments(argumentsJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    throw new ToolArgumentError(
      'Đối số không phải JSON hợp lệ (có thể bị cắt do hết giới hạn đầu ra)',
    );
  }
  return asObject(parsed, 'Đối số');
}

export function parseSaveLessonArguments(args: Record<string, unknown>): string {
  const markdown = args['markdown'];
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new ToolArgumentError('markdown phải là chuỗi không rỗng');
  }
  if (markdown.length > AI_LIMITS.maxLessonMarkdownChars) {
    throw new ToolArgumentError(
      `markdown dài ${markdown.length} ký tự, tối đa ${AI_LIMITS.maxLessonMarkdownChars}; hãy rút gọn`,
    );
  }
  return markdown;
}

/**
 * Kiểm tra cấu trúc đối số `create_quiz` và số câu hỏi; khoảng giá trị (độ dài, điểm, số đáp án đúng, …)
 * do `course` kiểm tra khi tạo quiz và trả lại lỗi 400 cho model sửa. Chỉ các trường đã biết được chuyển đi.
 */
export function parseCreateQuizArguments(
  args: Record<string, unknown>,
  expectedQuestionCount: number,
): QuizDraftInput {
  const title = args['title'];
  if (typeof title !== 'string') throw new ToolArgumentError('title phải là chuỗi');
  const description = args['description_markdown'];
  if (description !== undefined && description !== null && typeof description !== 'string') {
    throw new ToolArgumentError('description_markdown phải là chuỗi');
  }
  const rawQuestions = args['questions'];
  if (!Array.isArray(rawQuestions)) throw new ToolArgumentError('questions phải là mảng');
  if (rawQuestions.length !== expectedQuestionCount) {
    throw new ToolArgumentError(
      `Cần đúng ${expectedQuestionCount} câu hỏi, đã gửi ${rawQuestions.length}`,
    );
  }

  const questions = rawQuestions.map((raw, index) => {
    const at = `questions.${index}`;
    const question = asObject(raw, at);
    const type = question['question_type'];
    if (type !== 'SINGLE_CHOICE' && type !== 'MULTIPLE_CHOICE') {
      throw new ToolArgumentError(`${at}.question_type phải là SINGLE_CHOICE hoặc MULTIPLE_CHOICE`);
    }
    if (typeof question['question_markdown'] !== 'string') {
      throw new ToolArgumentError(`${at}.question_markdown phải là chuỗi`);
    }
    if (typeof question['points'] !== 'number') {
      throw new ToolArgumentError(`${at}.points phải là số`);
    }
    const options = question['options'];
    if (!Array.isArray(options) || options.length > AI_LIMITS.maxQuizOptions) {
      throw new ToolArgumentError(
        `${at}.options phải là mảng tối đa ${AI_LIMITS.maxQuizOptions} lựa chọn`,
      );
    }
    return {
      question_markdown: question['question_markdown'],
      question_type: type,
      points: question['points'],
      options: options.map((rawOption, optionIndex) => {
        const option = asObject(rawOption, `${at}.options.${optionIndex}`);
        if (
          typeof option['option_markdown'] !== 'string' ||
          typeof option['is_correct'] !== 'boolean'
        ) {
          throw new ToolArgumentError(
            `${at}.options.${optionIndex} cần option_markdown (chuỗi) và is_correct (boolean)`,
          );
        }
        return { option_markdown: option['option_markdown'], is_correct: option['is_correct'] };
      }),
    };
  });
  return { title, descriptionMarkdown: description ?? null, questions };
}
