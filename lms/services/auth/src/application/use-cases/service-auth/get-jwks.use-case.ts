import type { Jwks } from '@aiops-lms/contracts/http/common';

import type { TokenSigner } from '../../ports/token-signer.js';

/** Công bố khóa công khai (khóa hiện tại và khóa cũ còn trong cửa sổ xoay khóa). */
export class GetJwksUseCase {
  constructor(private readonly signer: TokenSigner) {}

  execute(): Jwks {
    return this.signer.jwks();
  }
}
