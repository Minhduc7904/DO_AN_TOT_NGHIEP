export interface StudentProfile {
  id: string;
  email: string;
  fullName: string;
}

export type StudentProfileStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface StudentProfileClient {
  /** Tạo hồ sơ student cùng `id` với tài khoản; ném `AppError` dependency khi student lỗi. */
  create(profile: StudentProfile): Promise<void>;
  /** Trạng thái hồ sơ, `null` khi chưa có hồ sơ; ném `AppError` dependency khi student lỗi. */
  findStatus(id: string): Promise<StudentProfileStatus | null>;
}

export const STUDENT_PROFILE_CLIENT = Symbol('StudentProfileClient');
