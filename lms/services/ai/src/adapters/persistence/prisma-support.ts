import { observeDependency } from '@aiops-lms/common/telemetry';

const DEPENDENCY = 'ai-postgres';
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

/** Bọc một thao tác DB bằng span và metric dependency `ai-postgres`. */
export function observeDb<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return observeDependency(DEPENDENCY, operation, run, {
    attributes: { 'db.system.name': 'postgresql' },
  });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export const isUniqueViolation = (error: unknown): boolean => hasCode(error, UNIQUE_VIOLATION);
export const isForeignKeyViolation = (error: unknown): boolean =>
  hasCode(error, FOREIGN_KEY_VIOLATION);
export const isRecordNotFound = (error: unknown): boolean => hasCode(error, RECORD_NOT_FOUND);
