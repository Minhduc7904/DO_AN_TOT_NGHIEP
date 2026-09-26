import {
  All,
  Controller,
  ForbiddenException,
  GatewayTimeoutException,
  HttpCode,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DependencyTimeoutError,
  DependencyUnavailableError,
  GatewayProxy,
  type GatewayRequest,
  type GatewayResponse,
} from '../../../application/gateway-proxy.js';
import { verifyAccessToken, type Principal } from '../../../domain/access-token.js';

interface HttpRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl: string;
}

interface HttpResponse {
  send(body: unknown): void;
  set(name: string, value: string): HttpResponse;
  status(code: number): HttpResponse;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@Controller('api/v1')
export class GatewayController {
  constructor(
    private readonly config: ConfigService,
    private readonly proxy: GatewayProxy,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(@Req() request: HttpRequest, @Res() response: HttpResponse): Promise<void> {
    this.send(response, await this.forwardPublic(request));
  }

  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Req() request: HttpRequest, @Res() response: HttpResponse): Promise<void> {
    this.send(response, await this.forwardPublic(request));
  }

  @All(['courses', 'courses/*path'])
  async courses(@Req() request: HttpRequest, @Res() response: HttpResponse): Promise<void> {
    const principal = this.requireStudentOrInstructorPrincipal(request);
    const result = await this.forward({
      body: request.body,
      headers: request.headers,
      method: request.method,
      path: request.originalUrl,
      principal,
      targetBaseUrl: this.config.getOrThrow<string>('GATEWAY_COURSE_BASE_URL'),
    });
    this.send(response, result);
  }

  // Chỉ khớp đúng path `enrollments` (không có wildcard con): `GET /api/v1/enrollments/check` theo
  // contract v1 §7.3 là internal service contract giữa Enrollment và Submission, MVP không expose
  // nó như public client route qua Gateway nên cố ý không forward.
  @All(['enrollments'])
  async enrollments(@Req() request: HttpRequest, @Res() response: HttpResponse): Promise<void> {
    const principal = this.requireStudentOrInstructorPrincipal(request);
    const result = await this.forward({
      body: request.body,
      headers: request.headers,
      method: request.method,
      path: request.originalUrl,
      principal,
      targetBaseUrl: this.config.getOrThrow<string>('GATEWAY_ENROLLMENT_BASE_URL'),
    });
    this.send(response, result);
  }

  @All(['submissions', 'submissions/*path'])
  async submissions(@Req() request: HttpRequest, @Res() response: HttpResponse): Promise<void> {
    const principal = this.requireStudentOrInstructorPrincipal(request);
    const result = await this.forward({
      body: request.body,
      headers: request.headers,
      method: request.method,
      path: request.originalUrl,
      principal,
      targetBaseUrl: this.config.getOrThrow<string>('GATEWAY_SUBMISSION_BASE_URL'),
    });
    this.send(response, result);
  }

  private forwardPublic(request: HttpRequest): Promise<GatewayResponse> {
    return this.forward({
      body: request.body,
      headers: request.headers,
      method: request.method,
      path: request.originalUrl,
      targetBaseUrl: this.config.getOrThrow<string>('GATEWAY_AUTH_BASE_URL'),
    });
  }

  private async forward(request: GatewayRequest): Promise<GatewayResponse> {
    try {
      return await this.proxy.forward(
        request,
        this.config.getOrThrow<number>('GATEWAY_UPSTREAM_TIMEOUT_MS'),
      );
    } catch (error) {
      if (error instanceof DependencyTimeoutError) {
        throw new GatewayTimeoutException('Dịch vụ phụ thuộc phản hồi quá thời hạn');
      }
      if (error instanceof DependencyUnavailableError) {
        throw new ServiceUnavailableException('Dịch vụ phụ thuộc hiện không sẵn sàng');
      }
      throw error;
    }
  }

  private requireStudentOrInstructorPrincipal(request: HttpRequest): Principal {
    const authorization = firstHeader(request.headers.authorization);
    const token = authorization?.match(/^Bearer\s+(.+)$/iu)?.[1];
    const principal = token
      ? verifyAccessToken(token, this.config.getOrThrow<string>('GATEWAY_JWT_SECRET'))
      : null;

    if (!principal) {
      throw new UnauthorizedException('Bearer JWT không hợp lệ hoặc đã hết hạn');
    }
    if (principal.role !== 'student' && principal.role !== 'instructor') {
      throw new ForbiddenException('Vai trò không được phép truy cập tài nguyên này');
    }

    return principal;
  }

  private send(response: HttpResponse, result: GatewayResponse): void {
    response.status(result.status).set('content-type', result.contentType).send(result.body);
  }
}
