import { RawResponse, SkipAuth } from '@aiops-lms/common/http';
import { JWKS_PATH, type Jwks } from '@aiops-lms/contracts/http/common';
import { Controller, Get, Header, Inject } from '@nestjs/common';

import { GetJwksUseCase } from '../../../application/use-cases/service-auth/get-jwks.use-case.js';

const [JWKS_DIRECTORY, JWKS_FILE] = JWKS_PATH.split('/') as [string, string];

/**
 * Khóa công khai để mọi service verify token (RFC 7517). Không xác thực và không bọc envelope.
 * Nằm ngoài `/api` và `/internal` nên Gateway không bao giờ route tới.
 */
@SkipAuth()
@RawResponse()
@Controller(JWKS_DIRECTORY)
export class JwksController {
  constructor(@Inject(GetJwksUseCase) private readonly getJwks: GetJwksUseCase) {}

  @Get(JWKS_FILE)
  @Header('Cache-Control', 'public, max-age=60')
  jwks(): Jwks {
    return this.getJwks.execute();
  }
}
