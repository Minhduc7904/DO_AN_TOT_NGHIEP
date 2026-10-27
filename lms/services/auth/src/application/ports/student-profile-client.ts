export interface StudentProfile {
  id: string;
  email: string;
  fullName: string;
}

export interface StudentProfileClient {
  /** Tạo hồ sơ student cùng `id` với tài khoản; ném `AppError` dependency khi student lỗi. */
  create(profile: StudentProfile): Promise<void>;
}

export const STUDENT_PROFILE_CLIENT = Symbol('StudentProfileClient');
