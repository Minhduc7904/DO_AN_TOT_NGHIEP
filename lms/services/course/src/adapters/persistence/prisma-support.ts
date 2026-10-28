import { observeDependency } from '@aiops-lms/common/telemetry';

const DEPENDENCY = 'course-postgres';
const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

/** Bọc một thao tác DB bằng span và metric dependency `course-postgres`. */
export function observeDb<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return observeDependency(DEPENDENCY, operation, run, {
    attributes: { 'db.system.name': 'postgresql' },
  });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

/** Bỏ các khóa `undefined` để object hợp kiểu `where`/`data` của Prisma khi bật exactOptionalPropertyTypes. */
export function omitUndefined<T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

export const isUniqueViolation = (error: unknown): boolean => hasCode(error, UNIQUE_VIOLATION);
export const isRecordNotFound = (error: unknown): boolean => hasCode(error, RECORD_NOT_FOUND);
