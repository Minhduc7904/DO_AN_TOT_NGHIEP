import {
  studentDtoSchema,
  apiResponseSchema,
  type CreateStudentRequest,
} from '@aiops-lms/contracts';
import { AppError } from '@aiops-lms/common/errors';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  StudentProfile,
  StudentProfileClient,
  StudentProfileStatus,
} from '../../application/ports/student-profile-client.js';

const studentResponseSchema = apiResponseSchema(studentDtoSchema);

@Injectable()
export class StudentHttpClient implements StudentProfileClient {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService) {
    this.client = new HttpQueryClient({
      dependency: 'auth-student',
      baseUrl: config.getOrThrow<string>('AUTH_STUDENT_BASE_URL'),
      timeoutMs: config.getOrThrow<number>('AUTH_STUDENT_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('AUTH_STUDENT_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('AUTH_STUDENT_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  async create(profile: StudentProfile): Promise<void> {
    const body: CreateStudentRequest = {
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
    };
    const response = await this.client.request({
      method: 'POST',
      path: '/internal/v1/students',
      body,
    });
    // Student từ chối (4xx) cũng khiến đăng ký thất bại: tài khoản không có hồ sơ là trạng thái lỗi.
    if (response.status !== 201) throw AppError.dependencyUnavailable('auth-student');
  }

  async findStatus(id: string): Promise<StudentProfileStatus | null> {
    const response = await this.client.request({
      method: 'GET',
      path: `/internal/v1/students/${encodeURIComponent(id)}`,
    });
    if (response.status === 404) return null;
    if (response.status !== 200) throw AppError.dependencyUnavailable('auth-student');
    const parsed = studentResponseSchema.safeParse(response.body);
    if (!parsed.success || !parsed.data.data) throw AppError.dependencyUnavailable('auth-student');
    return parsed.data.data.status;
  }
}
