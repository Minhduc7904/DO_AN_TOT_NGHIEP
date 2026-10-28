import { AppError } from '@aiops-lms/common/errors';

import type { QuizQuestion } from '../../src/domain/course.js';
import { csvRow, escapeCsvField } from '../../src/domain/csv.js';
import {
  assertPublishable,
  type QuestionDraft,
  validateQuestions,
  validateQuizTitle,
} from '../../src/domain/quiz-content.js';
import { QuizGrader } from '../../src/domain/quiz-grader.js';

function question(
  id: string,
  points: number,
  options: { id: string; correct: boolean }[],
  type: QuizQuestion['questionType'] = 'MULTIPLE_CHOICE',
): QuizQuestion {
  return {
    id,
    questionMarkdown: id,
    questionType: type,
    points,
    displayOrder: 1,
    options: options.map((option, index) => ({
      id: option.id,
      optionMarkdown: option.id,
      isCorrect: option.correct,
      displayOrder: index + 1,
    })),
  };
}

function draft(overrides: Partial<QuestionDraft> = {}): QuestionDraft {
  return {
    questionMarkdown: 'Câu hỏi',
    questionType: 'SINGLE_CHOICE',
    points: 1,
    options: [
      { optionMarkdown: 'A', isCorrect: true },
      { optionMarkdown: 'B', isCorrect: false },
    ],
    ...overrides,
  };
}

describe('QuizGrader', () => {
  const grader = new QuizGrader();
  const questions = [
    question('q1', 1.5, [
      { id: 'q1a', correct: true },
      { id: 'q1b', correct: false },
    ]),
    question('q2', 2.25, [
      { id: 'q2a', correct: true },
      { id: 'q2b', correct: true },
      { id: 'q2c', correct: false },
    ]),
  ];

  it('đúng khi tập đã chọn bằng tập đáp án đúng, điểm là tổng điểm các câu đúng', () => {
    const result = grader.grade(questions, [
      { questionId: 'q1', optionIds: ['q1a'] },
      { questionId: 'q2', optionIds: ['q2b', 'q2a'] },
    ]);
    expect(result).toEqual({ score: 3.75, maxScore: 3.75, correctQuestionIds: ['q1', 'q2'] });
  });

  it('thiếu hoặc thừa một lựa chọn thì câu đó 0 điểm, câu bỏ trống 0 điểm', () => {
    const result = grader.grade(questions, [
      { questionId: 'q2', optionIds: ['q2a', 'q2b', 'q2c'] },
    ]);
    expect(result).toEqual({ score: 0, maxScore: 3.75, correctQuestionIds: [] });
    expect(grader.grade(questions, [{ questionId: 'q2', optionIds: ['q2a'] }]).score).toBe(0);
  });

  it('cộng điểm lẻ không bị sai số số thực', () => {
    const tenths = Array.from({ length: 3 }, (_, index) =>
      question(`t${index}`, 0.1, [{ id: `t${index}a`, correct: true }]),
    );
    const result = grader.grade(
      tenths,
      tenths.map((item) => ({ questionId: item.id, optionIds: [`${item.id}a`] })),
    );
    expect(result.score).toBe(0.3);
  });
});

describe('quiz content validation', () => {
  it('chuẩn hóa tiêu đề và chặn tiêu đề ngoài 2–200 ký tự', () => {
    expect(validateQuizTitle('  Quiz  ')).toBe('Quiz');
    expect(() => validateQuizTitle('a')).toThrow(AppError);
    expect(() => validateQuizTitle('x'.repeat(201))).toThrow(AppError);
  });

  it('chấp nhận câu hỏi hợp lệ và báo mọi lỗi cùng lúc', () => {
    expect(() => validateQuestions([draft()])).not.toThrow();

    try {
      validateQuestions([
        draft({ points: 0 }),
        draft({ points: 1.005 }),
        draft({ points: 101 }),
        draft({ options: [{ optionMarkdown: 'A', isCorrect: true }] }),
        draft({ questionMarkdown: '   ' }),
      ]);
      throw new Error('phải ném lỗi');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const details = (error as AppError).details as { path: string }[];
      expect(details.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          'questions.0.points',
          'questions.1.points',
          'questions.2.points',
          'questions.3.options',
          'questions.4.question_markdown',
        ]),
      );
    }
  });

  it('SINGLE_CHOICE cần đúng một đáp án đúng, MULTIPLE_CHOICE cần ít nhất một', () => {
    const twoCorrect = [
      { optionMarkdown: 'A', isCorrect: true },
      { optionMarkdown: 'B', isCorrect: true },
    ];
    const noneCorrect = [
      { optionMarkdown: 'A', isCorrect: false },
      { optionMarkdown: 'B', isCorrect: false },
    ];
    expect(() => validateQuestions([draft({ options: twoCorrect })])).toThrow(AppError);
    expect(() =>
      validateQuestions([draft({ questionType: 'MULTIPLE_CHOICE', options: twoCorrect })]),
    ).not.toThrow();
    expect(() =>
      validateQuestions([draft({ questionType: 'MULTIPLE_CHOICE', options: noneCorrect })]),
    ).toThrow(AppError);
  });

  it('giới hạn số câu hỏi, số lựa chọn và độ dài lựa chọn', () => {
    expect(() => validateQuestions(Array.from({ length: 101 }, () => draft()))).toThrow(AppError);
    const many = Array.from({ length: 11 }, (_, index) => ({
      optionMarkdown: String(index),
      isCorrect: index === 0,
    }));
    expect(() => validateQuestions([draft({ options: many })])).toThrow(AppError);
    expect(() =>
      validateQuestions([
        draft({
          options: [
            { optionMarkdown: 'x'.repeat(2001), isCorrect: true },
            { optionMarkdown: 'B', isCorrect: false },
          ],
        }),
      ]),
    ).toThrow(AppError);
  });

  it('xuất bản cần ít nhất một câu hỏi', () => {
    expect(() => assertPublishable(0)).toThrow(AppError);
    expect(() => assertPublishable(1)).not.toThrow();
  });
});

describe('CSV', () => {
  it('bọc nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng và nhân đôi nháy kép', () => {
    expect(escapeCsvField('đơn giản')).toBe('đơn giản');
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('nói "xin chào"')).toBe('"nói ""xin chào"""');
    expect(escapeCsvField('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"');
    expect(csvRow(['a', 'b,c'])).toBe('a,"b,c"\r\n');
  });
});
