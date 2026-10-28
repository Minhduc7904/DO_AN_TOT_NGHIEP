import { parseInput, SkipAuth } from '@aiops-lms/common/http';
import {
  INTERNAL_PREFIX,
  serviceTokenRequestSchema,
  type ServiceTokenResponse,
} from '@aiops-lms/contracts/http';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import { IssueServiceTokenUseCase } from '../../../application/use-cases/service-auth/issue-service-token.use-case.js';

/**
 * Xác thực dịch vụ (client-credentials). Không dùng bearer token vì đây chính là nơi lấy token;
 * danh tính được chứng minh bằng `client_id`/`client_secret` trong body.
 */
@SkipAuth()
@Controller(`${INTERNAL_PREFIX}/auth`)
export class ServiceAuthController {
  constructor(
    @Inject(IssueServiceTokenUseCase) private readonly issueServiceToken: IssueServiceTokenUseCase,
  ) {}

  @Post('service-token')
  @HttpCode(200)
  async issue(@Body() body: unknown): Promise<ServiceTokenResponse> {
    const input = parseInput(serviceTokenRequestSchema, body);
    const grant = await this.issueServiceToken.execute({
      clientId: input.client_id,
      clientSecret: input.client_secret,
      audience: input.audience,
      scope: input.scope,
    });
    return {
      access_token: grant.accessToken,
      token_type: 'Bearer',
      expires_in: grant.expiresInSeconds,
      scope: grant.scope,
    };
  }
}
