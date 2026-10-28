import {
  GATEWAY_PROXY_SCOPE,
  GATEWAY_SERVICE_NAME,
  TOKEN_ISSUER,
  USER_TOKEN_AUDIENCE,
} from '@aiops-lms/contracts/http/common';

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { signJwt } from './jwt.js';
import { type SigningKey, toJwk } from './keys.js';

/** Helper cho test: mint token đúng định dạng của auth mà không cần chạy auth. */
export function mintServiceToken(
  key: SigningKey,
  options: {
    subject: string;
    audience: string;
    scopes: readonly string[];
    expiresInSeconds?: number;
    now?: number;
  },
): string {
  return signJwt({
    privateKey: key.privateKey,
    kid: key.kid,
    expiresInSeconds: options.expiresInSeconds ?? 600,
    ...(options.now === undefined ? {} : { now: options.now }),
    claims: {
      iss: TOKEN_ISSUER,
      typ: 'service',
      sub: options.subject,
      aud: options.audience,
      scope: options.scopes.join(' '),
    },
  });
}

/** Token mà Gateway dùng khi gọi `audience`. */
export function mintGatewayToken(key: SigningKey, audience: string): string {
  return mintServiceToken(key, {
    subject: GATEWAY_SERVICE_NAME,
    audience,
    scopes: [GATEWAY_PROXY_SCOPE],
  });
}

export function mintUserToken(
  key: SigningKey,
  options: { subject: string; role: string; expiresInSeconds?: number },
): string {
  return signJwt({
    privateKey: key.privateKey,
    kid: key.kid,
    expiresInSeconds: options.expiresInSeconds ?? 600,
    claims: {
      iss: TOKEN_ISSUER,
      typ: 'user',
      sub: options.subject,
      aud: USER_TOKEN_AUDIENCE,
      role: options.role,
    },
  });
}

/** Server JWKS giả cho e2e: các service thật tải khóa công khai từ đây thay vì từ auth. */
export async function startJwksStub(
  ...keys: readonly SigningKey[]
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: keys.map((key) => toJwk(key.publicKey)) }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
