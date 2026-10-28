import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';

import { SkipAuth } from './principal.js';

export type ReadinessCheck = () => Promise<void>;

/** Service cung cấp provider này (map tên → kiểm tra) rồi đăng ký `HealthController`. */
export const READINESS_CHECKS = Symbol('LMS_READINESS_CHECKS');

@SkipAuth()
@Controller()
export class HealthController {
  constructor(@Inject(READINESS_CHECKS) private readonly checks: Record<string, ReadinessCheck>) {}

  /** Liveness: process còn phản hồi, không kiểm tra dependency. */
  @Get('health')
  @Header('Cache-Control', 'no-store')
  health(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness: mọi dependency khai báo phải trả lời; lỗi thì 503. */
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(): Promise<{ status: 'ok'; checks: Record<string, 'ok'>; timestamp: string }> {
    const results: Record<string, 'ok'> = {};
    for (const [name, check] of Object.entries(this.checks)) {
      try {
        await check();
        results[name] = 'ok';
      } catch {
        throw new ServiceUnavailableException(`Dependency chưa sẵn sàng: ${name}`);
      }
    }
    return { status: 'ok', checks: results, timestamp: new Date().toISOString() };
  }
}
