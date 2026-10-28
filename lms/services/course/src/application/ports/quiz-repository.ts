import type { Quiz, QuizQuestion, QuizStatus, QuizSummary } from '../../domain/course.js';

export const QUIZ_REPOSITORY = Symbol('QUIZ_REPOSITORY');

export interface NewQuiz {
  id: string;
  lessonId: string;
  title: string;
  descriptionMarkdown: string | null;
  questions: QuizQuestion[];
}

export interface QuizPatch {
  title?: string | undefined;
  descriptionMarkdown?: string | null | undefined;
  status?: QuizStatus | undefined;
  /** Có giá trị thì thay toàn bộ cây câu hỏi. */
  questions?: QuizQuestion[] | undefined;
}

export interface QuizRepository {
  /** Thêm vào cuối bài học. */
  create(quiz: NewQuiz): Promise<Quiz | null>;
  findInLesson(lessonId: string, quizId: string): Promise<Quiz | null>;
  findById(quizId: string): Promise<Quiz | null>;
  listByLesson(lessonId: string, publishedOnly: boolean): Promise<QuizSummary[]>;
  update(quizId: string, patch: QuizPatch): Promise<Quiz | null>;
  delete(quizId: string): Promise<boolean>;
  hasAttempts(quizId: string): Promise<boolean>;
}
