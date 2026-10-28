import { AppError } from '@aiops-lms/common/errors';

/** Mã lỗi nghiệp vụ của `scheduler` (khai báo trong http-and-event-contracts-v2 §3 và §4.6). */
export const SCHEDULER_ERROR_CODES = {
  jobNotActive: 'SCHEDULER_JOB_NOT_ACTIVE',
} as const;

export const schedulerErrors = {
  jobNotActive: (status: string): AppError =>
    new AppError(
      SCHEDULER_ERROR_CODES.jobNotActive,
      409,
      'Job không ở trạng thái ACTIVE nên không thể tạo run mới',
      { status },
    ),
};
