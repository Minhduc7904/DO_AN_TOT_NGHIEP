export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type QuizStatus = 'DRAFT' | 'PUBLISHED';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED';

export interface Course {
  id: string;
  name: string;
  descriptionMarkdown: string | null;
  status: CourseStatus;
  /** `auth_users.id` của giảng viên sở hữu khóa học. */
  instructorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  contentMarkdown: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizOption {
  id: string;
  optionMarkdown: string;
  isCorrect: boolean;
  displayOrder: number;
}

export interface QuizQuestion {
  id: string;
  questionMarkdown: string;
  questionType: QuestionType;
  points: number;
  displayOrder: number;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  lessonId: string;
  title: string;
  descriptionMarkdown: string | null;
  displayOrder: number;
  status: QuizStatus;
  createdAt: Date;
  updatedAt: Date;
  questions: QuizQuestion[];
}

/** Quiz không kèm cây câu hỏi, dùng cho danh sách. */
export type QuizSummary = Omit<Quiz, 'questions'> & { questionCount: number };

export interface Enrollment {
  id: string;
  courseId: string;
  /** `students.id` của học viên. */
  studentId: string;
  enrolledAt: Date;
}

export interface LessonProgress {
  lessonId: string;
  studentId: string;
  /** 0–100. */
  progressPercent: number;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface AttemptAnswer {
  questionId: string;
  optionIds: string[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  /** Tổng điểm tại thời điểm nộp (snapshot): sửa quiz sau đó không đổi kết quả cũ. */
  maxScore: number | null;
  answers: AttemptAnswer[];
}
