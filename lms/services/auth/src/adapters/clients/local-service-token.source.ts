import type { ServiceTokenGrant, ServiceTokenSource } from '@aiops-lms/common/auth';

import type { IssueServiceTokenUseCase } from '../../application/use-cases/service-auth/issue-service-token.use-case.js';

/**
 * Auth lấy service token cho chính mình bằng cách gọi thẳng use case (cùng kiểm client/secret),
 * không đi vòng qua HTTP tới chính nó nên không cần đợi server lắng nghe lúc khởi động.
 */
export class LocalServiceTokenSource implements ServiceTokenSource {
  constructor(
    private readonly issue: IssueServiceTokenUseCase,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async fetch(audience: string): Promise<ServiceTokenGrant> {
    const grant = await this.issue.execute({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      audience,
    });
    return { accessToken: grant.accessToken, expiresInSeconds: grant.expiresInSeconds };
  }
}
