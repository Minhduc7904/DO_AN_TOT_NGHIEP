export interface Recipient {
  id: string;
  email: string;
}

/** Cạnh `notification-worker → identity`: recipient lấy qua HTTP, không đọc `identity_db`. */
export interface StudentDirectory {
  /** Student `ACTIVE`, trang bắt đầu từ 1. */
  listActive(page: number, pageSize: number): Promise<{ items: Recipient[]; total: number }>;
  /** `null` khi không có hồ sơ; `active=false` khi student không còn `ACTIVE`. */
  find(studentId: string): Promise<(Recipient & { active: boolean }) | null>;
}

export const STUDENT_DIRECTORY = Symbol('STUDENT_DIRECTORY');
