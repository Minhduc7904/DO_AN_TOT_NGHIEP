import type { Course, CourseStatus, Lesson, Quiz, QuizQuestion } from '../../src/domain/course.js';
import { createWorld, NOW, principals } from './in-memory.js';

export type World = ReturnType<typeof createWorld>;

export function seedCourse(
  world: World,
  status: CourseStatus = 'PUBLISHED',
  instructorId: string = principals.owner.id,
): Course {
  const course: Course = {
    id: world.ids.next(),
    name: `Khóa học ${world.courses.rows.size + 1}`,
    descriptionMarkdown: null,
    status,
    instructorId,
    createdAt: NOW,
    updatedAt: NOW,
  };
  world.courses.rows.set(course.id, course);
  return course;
}

export async function seedLesson(world: World, courseId: string): Promise<Lesson> {
  const lesson = await world.lessons.create({
    id: world.ids.next(),
    courseId,
    title: 'Bài học',
    contentMarkdown: 'Nội dung',
  });
  if (!lesson) throw new Error('không tạo được bài học');
  return lesson;
}

export function sampleQuestions(world: World): QuizQuestion[] {
  const make = (
    type: QuizQuestion['questionType'],
    points: number,
    correct: boolean[],
    order: number,
  ): QuizQuestion => ({
    id: world.ids.next(),
    questionMarkdown: `Câu ${order}`,
    questionType: type,
    points,
    displayOrder: order,
    options: correct.map((isCorrect, index) => ({
      id: world.ids.next(),
      optionMarkdown: `Lựa chọn ${index + 1}`,
      isCorrect,
      displayOrder: index + 1,
    })),
  });
  return [
    make('SINGLE_CHOICE', 1, [true, false], 1),
    make('MULTIPLE_CHOICE', 2, [true, true, false], 2),
  ];
}

export async function seedQuiz(
  world: World,
  lessonId: string,
  status: Quiz['status'] = 'PUBLISHED',
): Promise<Quiz> {
  const created = await world.quizzes.create({
    id: world.ids.next(),
    lessonId,
    title: 'Quiz',
    descriptionMarkdown: null,
    questions: sampleQuestions(world),
  });
  if (!created) throw new Error('không tạo được quiz');
  const quiz = { ...created, status };
  world.quizzes.rows.set(quiz.id, quiz);
  return quiz;
}

export async function enroll(world: World, courseId: string, studentId: string): Promise<void> {
  await world.enrollments.create({ id: world.ids.next(), courseId, studentId });
}
