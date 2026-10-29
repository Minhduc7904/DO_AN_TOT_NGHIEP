// Gom số lượng người dùng nhập thành kế hoạch nạp: kiểm tra phụ thuộc, tính số dòng của các mục
// dẫn xuất và trần/sàn số lượng theo các mục khác.
import { enrollmentCapacities } from './distribution.mjs';
import { DATABASES, DATASETS, findDataset } from './catalogue.mjs';

/**
 * Ngữ cảnh tính số lượng. Mục thuộc DB được chọn lấy số trong kế hoạch; mục thuộc DB không được chọn
 * lấy số dòng seed đang có trong DB đó (`existing`), để DB con vẫn tham chiếu đúng DB cha đã seed trước.
 */
export function createContext({ seed, passwordHash, counts = {}, existing = {}, selected = [] }) {
  const selectedDatabases = new Set(selected);
  let capacities;
  const context = {
    seed,
    passwordHash,
    counts,
    get(key) {
      const dataset = findDataset(key);
      if (!dataset) throw new Error(`Mục seed không tồn tại: ${key}`);
      if (!selectedDatabases.has(dataset.db)) return existing[key] ?? 0;
      return dataset.derived ? dataset.count(context) : (counts[key] ?? 0);
    },
    capacities() {
      capacities ??= enrollmentCapacities({
        students: context.get('student.students'),
        courses: context.get('course.courses'),
        lessons: context.get('course.lessons'),
        quizzes: context.get('course.quizzes'),
        enrollments: context.get('course.enrollments'),
      });
      return capacities;
    },
  };
  return context;
}

export function limitsOf(dataset, context) {
  return {
    min: dataset.min ? dataset.min(context) : 0,
    max: dataset.max ? dataset.max(context) : Number.POSITIVE_INFINITY,
  };
}

/** Số lượng gợi ý theo profile, đã kéo về trong [min, max] của các mục đã nhập trước đó. */
export function suggestCount(dataset, context, profileName) {
  const base = dataset.defaultFrom?.(context) ?? dataset.defaults[profileName];
  const { min, max } = limitsOf(dataset, context);
  return Math.min(Math.max(base, min), max);
}

/**
 * Điền số lượng cho mọi mục không dẫn xuất của các DB được chọn: giá trị ghi đè nếu có, không thì
 * gợi ý theo profile. Giá trị ghi đè không bị kéo về giới hạn mà để `validatePlan` báo lỗi.
 */
export function resolveCounts({
  selected,
  profileName,
  overrides = {},
  existing,
  seed,
  passwordHash,
}) {
  const counts = {};
  const context = createContext({ seed, passwordHash, counts, existing, selected });
  for (const dataset of DATASETS) {
    if (!selected.includes(dataset.db) || dataset.derived) continue;
    counts[dataset.key] = overrides[dataset.key] ?? suggestCount(dataset, context, profileName);
  }
  return counts;
}

/** Số đơn vị tiến độ của một mục (mặc định bằng số dòng; đáp án quiz tính theo số attempt). */
export function unitsOf(dataset, context, count) {
  return dataset.units ? dataset.units(context) : count;
}

export function validatePlan({ selected, counts, existing, seed, passwordHash }) {
  const context = createContext({ seed, passwordHash, counts, existing, selected });
  const errors = [];
  const warnings = [];
  const items = [];

  for (const database of DATABASES) {
    if (!selected.includes(database.key)) continue;
    for (const dataset of database.datasets) {
      const count = context.get(dataset.key);
      if (!dataset.derived) {
        const { min, max } = limitsOf(dataset, context);
        if (!Number.isInteger(count) || count < 0) {
          errors.push(`${dataset.label}: số lượng phải là số nguyên không âm`);
        } else if (count < min) {
          errors.push(
            `${dataset.label}: tối thiểu ${min.toLocaleString('vi-VN')} dòng (hiện ${count})`,
          );
        } else if (count > max) {
          errors.push(
            `${dataset.label}: tối đa ${max.toLocaleString('vi-VN')} dòng (hiện ${count})`,
          );
        }
      }
      if (count > 0) {
        for (const need of dataset.needs ?? []) {
          if (context.get(need) === 0) {
            errors.push(
              `${dataset.label}: cần "${findDataset(need).label}" có dữ liệu (chọn DB tương ứng hoặc seed trước)`,
            );
          }
        }
      }
      items.push({ dataset, count, units: unitsOf(dataset, context, count) });
    }
  }

  const students = context.get('student.students');
  if (selected.includes('student') && students > context.get('auth.students')) {
    warnings.push(
      'student.students lớn hơn số học viên ở auth_users: học viên dư không có tài khoản để đăng nhập.',
    );
  }
  return { context, items, errors, warnings };
}

export function allDatabaseKeys() {
  return DATABASES.map((database) => database.key);
}
