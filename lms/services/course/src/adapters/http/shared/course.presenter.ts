import type {
  AttemptDetailDto,
  AttemptDto,
  CourseDetailDto,
  CourseDto,
  CourseProgressDto,
  CourseSummaryDto,
  EnrolledCourseDto,
  EnrollmentDto,
  LessonDto,
  LessonOutlineDto,
  LessonProgressDto,
  QuizDto,
  QuizSummaryDto,
} from '@aiops-lms/contracts';

import type { CourseCounts } from '../../../application/ports/course-repository.js';
import type { CourseProgress } from '../../../application/use-cases/learning/get-my-course-progress.use-case.js';
import type {
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  Quiz,
  QuizAttempt,
  QuizSummary,
} from '../../../domain/course.js';

export function presentCourse(course: Course): CourseDto {
  return {
    id: course.id,
    name: course.name,
    description_markdown: course.descriptionMarkdown,
    status: course.status,
    instructor_id: course.instructorId,
    created_at: course.createdAt.toISOString(),
    updated_at: course.updatedAt.toISOString(),
  };
}

export function presentLessonOutline(lesson: Lesson): LessonOutlineDto {
  return { id: lesson.id, title: lesson.title, display_order: lesson.displayOrder };
}

export function presentLesson(lesson: Lesson): LessonDto {
  return {
    ...presentLessonOutline(lesson),
    course_id: lesson.courseId,
    content_markdown: lesson.contentMarkdown,
    created_at: lesson.createdAt.toISOString(),
    updated_at: lesson.updatedAt.toISOString(),
  };
}

export function presentCourseDetail(detail: {
  course: Course;
  lessons: Lesson[];
}): CourseDetailDto {
  return { ...presentCourse(detail.course), lessons: detail.lessons.map(presentLessonOutline) };
}

export function presentEnrolledCourse(detail: {
  course: Course;
  lessons: Lesson[];
}): EnrolledCourseDto {
  return { ...presentCourse(detail.course), lessons: detail.lessons.map(presentLesson) };
}

export function presentCourseSummary(counts: CourseCounts): CourseSummaryDto {
  return { ...counts };
}

export function presentQuizSummary(quiz: QuizSummary): QuizSummaryDto {
  return {
    id: quiz.id,
    lesson_id: quiz.lessonId,
    title: quiz.title,
    description_markdown: quiz.descriptionMarkdown,
    display_order: quiz.displayOrder,
    status: quiz.status,
    question_count: quiz.questionCount,
    created_at: quiz.createdAt.toISOString(),
    updated_at: quiz.updatedAt.toISOString(),
  };
}

/** `revealAnswers=false` bỏ `is_correct` khỏi từng lựa chọn (học viên đang làm bài). */
export function presentQuiz(quiz: Quiz, revealAnswers = true): QuizDto {
  return {
    ...presentQuizSummary({ ...quiz, questionCount: quiz.questions.length }),
    questions: quiz.questions.map((question) => ({
      id: question.id,
      question_markdown: question.questionMarkdown,
      question_type: question.questionType,
      points: question.points,
      display_order: question.displayOrder,
      options: question.options.map((option) => ({
        id: option.id,
        option_markdown: option.optionMarkdown,
        display_order: option.displayOrder,
        ...(revealAnswers ? { is_correct: option.isCorrect } : {}),
      })),
    })),
  };
}

export function presentEnrollment(enrollment: Enrollment): EnrollmentDto {
  return {
    id: enrollment.id,
    course_id: enrollment.courseId,
    student_id: enrollment.studentId,
    enrolled_at: enrollment.enrolledAt.toISOString(),
  };
}

export function presentLessonProgress(progress: LessonProgress): LessonProgressDto {
  return {
    lesson_id: progress.lessonId,
    progress_percent: progress.progressPercent,
    completed_at: progress.completedAt?.toISOString() ?? null,
    updated_at: progress.updatedAt.toISOString(),
  };
}

export function presentCourseProgress(progress: CourseProgress): CourseProgressDto {
  return {
    course_id: progress.courseId,
    total_lessons: progress.totalLessons,
    completed_lessons: progress.completedLessons,
    percent: progress.percent,
    lessons: progress.lessons.map(presentLessonProgress),
  };
}

export function presentAttempt(attempt: QuizAttempt): AttemptDto {
  return {
    id: attempt.id,
    quiz_id: attempt.quizId,
    status: attempt.status,
    started_at: attempt.startedAt.toISOString(),
    submitted_at: attempt.submittedAt?.toISOString() ?? null,
    score: attempt.score,
    max_score: attempt.maxScore,
    answers: attempt.answers.map((answer) => ({
      question_id: answer.questionId,
      option_ids: answer.optionIds,
    })),
  };
}

/** Đáp án đúng chỉ lộ ra sau khi lượt làm bài đã nộp. */
export function presentAttemptDetail(detail: {
  attempt: QuizAttempt;
  quiz: Quiz;
}): AttemptDetailDto {
  return {
    ...presentAttempt(detail.attempt),
    quiz: presentQuiz(detail.quiz, detail.attempt.status === 'SUBMITTED'),
  };
}
