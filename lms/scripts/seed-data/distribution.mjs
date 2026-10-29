// Bản sao bằng JS của quy tắc phân bổ trong SQL (catalogue.mjs), dùng để tính trần số dòng khi
// người dùng nhập số lượng. Test tích hợp so sánh với số dòng thật trong DB.

/** Số bản ghi con của cha thứ `k` (1-based) khi chia đều `children` bản ghi cho `parents` cha. */
export function perParent(children, parents, k) {
  if (parents <= 0) return 0;
  return Math.floor(children / parents) + (k <= children % parents ? 1 : 0);
}

/** Khóa học (1-based) của enrollment thứ `i`; trùng với biểu thức SQL của `course.enrollments`. */
export function courseOfEnrollment(i, students, courses) {
  const student = ((i - 1) % students) + 1;
  return ((Math.floor((i - 1) / students) + student * 7919) % courses) + 1;
}

/** Số bài học và số quiz của từng khóa học (chỉ số 1-based, phần tử 0 bỏ trống). */
export function courseContent({ courses, lessons, quizzes }) {
  const lessonCount = new Array(courses + 1).fill(0);
  const quizCount = new Array(courses + 1).fill(0);
  for (let lesson = 1; lesson <= lessons; lesson += 1) {
    const course = ((lesson - 1) % courses) + 1;
    lessonCount[course] += 1;
    quizCount[course] += perParent(quizzes, lessons, lesson);
  }
  return { lessonCount, quizCount };
}

/** Trần số dòng `lesson_progresses` và `quiz_attempts` cho một bộ số lượng course_db. */
export function enrollmentCapacities({ students, courses, lessons, quizzes, enrollments }) {
  if (enrollments === 0 || students === 0 || courses === 0) return { progresses: 0, attempts: 0 };
  const { lessonCount, quizCount } = courseContent({ courses, lessons, quizzes });
  let progresses = 0;
  let attempts = 0;
  for (let i = 1; i <= enrollments; i += 1) {
    const course = courseOfEnrollment(i, students, courses);
    progresses += lessonCount[course];
    attempts += quizCount[course];
  }
  return { progresses, attempts };
}

// Cứ 10 media gốc: 5 ảnh, 2 tài liệu, 1 video, 1 âm thanh, 1 khác (xem media.objects trong catalogue).
const THUMBNAIL_OFFSETS = [0, 1, 2, 3, 4, 7];
const DOCUMENT_OFFSETS = [5, 6];

function countOffsets(total, offsets) {
  const full = Math.floor(total / 10);
  const rest = total % 10;
  return full * offsets.length + offsets.filter((offset) => offset < rest).length;
}

export function thumbnailCount(media) {
  return countOffsets(media, THUMBNAIL_OFFSETS);
}

export function documentCount(media) {
  return countOffsets(media, DOCUMENT_OFFSETS);
}
