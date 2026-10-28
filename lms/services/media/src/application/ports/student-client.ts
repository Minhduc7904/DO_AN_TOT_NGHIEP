export const STUDENT_CLIENT = Symbol('STUDENT_CLIENT');

/** Cạnh `media → student` (internal): kiểm tra hồ sơ trước khi gắn avatar. */
export interface StudentClient {
  /** `null` khi student không tồn tại; lỗi dependency được ném lên. */
  findStatus(studentId: string): Promise<string | null>;
}
