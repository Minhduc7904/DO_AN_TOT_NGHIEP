import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator, Principal } from '@aiops-lms/common/ports';

import type { Quiz } from '../../../domain/course.js';
import { type QuestionDraft, validateQuizTitle } from '../../../domain/quiz-content.js';
import { loadManagedLesson } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { buildQuestionTree } from './quiz-tree.js';

export interface CreateQuizInput {
  title: string;
  descriptionMarkdown: string | null;
  questions: QuestionDraft[];
}

export class CreateQuizUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly quizzes: QuizRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** Quiz mới luôn là `DRAFT`, xếp cuối bài học. */
  async execute(
    principal: Principal,
    courseId: string,
    lessonId: string,
    input: CreateQuizInput,
  ): Promise<Quiz> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    const title = validateQuizTitle(input.title);
    const questions = buildQuestionTree(input.questions, this.ids);

    const quiz = await this.quizzes.create({
      id: this.ids.next(),
      lessonId,
      title,
      descriptionMarkdown: input.descriptionMarkdown,
      questions,
    });
    if (!quiz) throw AppError.conflict('Không xếp được quiz vào cuối bài học, hãy thử lại');
    return quiz;
  }
}
