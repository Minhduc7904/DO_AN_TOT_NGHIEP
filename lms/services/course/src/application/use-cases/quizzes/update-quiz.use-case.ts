import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator, Principal } from '@aiops-lms/common/ports';

import type { Quiz, QuizStatus } from '../../../domain/course.js';
import { courseErrors } from '../../../domain/errors.js';
import {
  assertPublishable,
  type QuestionDraft,
  validateQuizTitle,
} from '../../../domain/quiz-content.js';
import { loadManagedQuiz } from '../../course-access.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizPatch, QuizRepository } from '../../ports/quiz-repository.js';
import { buildQuestionTree } from './quiz-tree.js';

export interface UpdateQuizInput {
  title?: string | undefined;
  descriptionMarkdown?: string | null | undefined;
  status?: QuizStatus | undefined;
  questions?: QuestionDraft[] | undefined;
}

export class UpdateQuizUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly quizzes: QuizRepository,
    private readonly ids: IdGenerator,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  async execute(
    principal: Principal,
    ref: { courseId: string; lessonId: string; quizId: string },
    input: UpdateQuizInput,
  ): Promise<Quiz> {
    const quiz = await loadManagedQuiz(this.courses, this.lessons, this.quizzes, principal, ref);
    const patch: QuizPatch = {
      descriptionMarkdown: input.descriptionMarkdown,
      status: input.status,
    };

    if (input.title !== undefined) patch.title = validateQuizTitle(input.title);
    if (input.questions !== undefined) {
      if (await this.quizzes.hasAttempts(quiz.id)) throw courseErrors.quizHasAttempts();
      patch.questions = buildQuestionTree(input.questions, this.ids);
    }
    if (input.status === 'PUBLISHED') {
      assertPublishable(patch.questions?.length ?? quiz.questions.length);
    }

    const touchesMarkdown =
      input.descriptionMarkdown !== undefined || input.questions !== undefined;
    const effects = touchesMarkdown
      ? this.media.syncQuiz(
          {
            id: quiz.id,
            descriptionMarkdown:
              input.descriptionMarkdown === undefined
                ? quiz.descriptionMarkdown
                : input.descriptionMarkdown,
            questions: patch.questions ?? quiz.questions,
          },
          principal.id,
        )
      : [];
    const updated = await this.quizzes.update(quiz.id, patch, effects);
    if (!updated) throw AppError.notFound('Không tìm thấy quiz');
    return updated;
  }
}
