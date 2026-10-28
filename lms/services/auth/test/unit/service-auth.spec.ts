import { generateSigningKey, TokenVerifier } from '@aiops-lms/common/auth';

import { Ed25519TokenSigner } from '../../src/adapters/security/ed25519-token-signer.js';
import { hashPassword } from '../../src/domain/password.js';
import { grantScopes, type ServiceClient } from '../../src/domain/service-client.js';
import { BootstrapServiceClientsUseCase } from '../../src/application/use-cases/service-auth/bootstrap-service-clients.use-case.js';
import { GetJwksUseCase } from '../../src/application/use-cases/service-auth/get-jwks.use-case.js';
import { IssueServiceTokenUseCase } from '../../src/application/use-cases/service-auth/issue-service-token.use-case.js';
import { InMemoryServiceClients } from './fakes.js';

const SECRET = 'gateway-secret-for-unit-tests';

async function clientWith(overrides: Partial<ServiceClient> = {}): Promise<ServiceClient> {
  return {
    clientId: 'gateway',
    secretHash: await hashPassword(SECRET),
    allowedAudiences: ['course', 'student'],
    allowedScopes: ['gateway:proxy', 'other:scope'],
    active: true,
    ...overrides,
  };
}

describe('grantScopes', () => {
  it('cấp toàn bộ scope được phép khi không yêu cầu cụ thể', async () => {
    expect(grantScopes(await clientWith(), 'course', undefined)).toEqual({
      granted: true,
      scopes: ['gateway:proxy', 'other:scope'],
    });
  });

  it('chỉ cấp tập con, từ chối audience hoặc scope ngoài phạm vi', async () => {
    const client = await clientWith();
    expect(grantScopes(client, 'course', 'gateway:proxy gateway:proxy')).toEqual({
      granted: true,
      scopes: ['gateway:proxy'],
    });
    expect(grantScopes(client, 'media', undefined)).toEqual({ granted: false, reason: 'audience' });
    expect(grantScopes(client, 'course', 'admin:all')).toEqual({ granted: false, reason: 'scope' });
  });
});

describe('IssueServiceTokenUseCase', () => {
  async function setup(): Promise<{
    issue: IssueServiceTokenUseCase;
    signer: Ed25519TokenSigner;
    clients: InMemoryServiceClients;
  }> {
    const clients = new InMemoryServiceClients();
    clients.rows.set('gateway', await clientWith());
    const signer = new Ed25519TokenSigner(generateSigningKey());
    return { issue: new IssueServiceTokenUseCase(clients, signer, 600), signer, clients };
  }

  it('cấp service token verify được bằng JWKS, đúng sub/aud/scope', async () => {
    const { issue, signer } = await setup();
    const grant = await issue.execute({
      clientId: 'gateway',
      clientSecret: SECRET,
      audience: 'course',
      scope: 'gateway:proxy',
    });
    expect(grant).toMatchObject({ expiresInSeconds: 600, scope: 'gateway:proxy' });

    const verified = await new TokenVerifier(signer.keyProvider()).verify(grant.accessToken, {
      type: 'service',
      audience: 'course',
    });
    expect(verified).toMatchObject({ subject: 'gateway', scopes: ['gateway:proxy'] });
  });

  it('sai secret, client lạ hoặc client bị khóa đều trả cùng SERVICE_CLIENT_INVALID', async () => {
    const { issue, clients } = await setup();
    const attempt = (clientId: string, clientSecret: string): Promise<unknown> =>
      issue.execute({ clientId, clientSecret, audience: 'course' });

    await expect(attempt('gateway', 'wrong-secret-value')).rejects.toMatchObject({
      code: 'SERVICE_CLIENT_INVALID',
      status: 401,
    });
    await expect(attempt('unknown', SECRET)).rejects.toMatchObject({
      code: 'SERVICE_CLIENT_INVALID',
    });
    const row = clients.rows.get('gateway');
    if (row) clients.rows.set('gateway', { ...row, active: false });
    await expect(attempt('gateway', SECRET)).rejects.toMatchObject({
      code: 'SERVICE_CLIENT_INVALID',
    });
  });

  it('audience hoặc scope ngoài quyền bị SERVICE_SCOPE_FORBIDDEN', async () => {
    const { issue } = await setup();
    await expect(
      issue.execute({ clientId: 'gateway', clientSecret: SECRET, audience: 'media' }),
    ).rejects.toMatchObject({ code: 'SERVICE_SCOPE_FORBIDDEN', status: 403 });
    await expect(
      issue.execute({
        clientId: 'gateway',
        clientSecret: SECRET,
        audience: 'course',
        scope: 'admin:all',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_SCOPE_FORBIDDEN' });
  });
});

describe('Ed25519TokenSigner và GetJwksUseCase', () => {
  it('JWKS có khóa hiện tại và khóa cũ; token của cả hai khóa đều verify được khi xoay khóa', async () => {
    const oldKey = generateSigningKey();
    const newKey = generateSigningKey();
    const oldSigner = new Ed25519TokenSigner(oldKey);
    const rotated = new Ed25519TokenSigner(newKey, [oldKey.publicKey]);

    const jwks = new GetJwksUseCase(rotated).execute();
    expect(jwks.keys.map((key) => key.kid).sort()).toEqual([oldKey.kid, newKey.kid].sort());
    expect(JSON.stringify(jwks)).not.toContain('"d"');

    const verifier = new TokenVerifier(rotated.keyProvider());
    const fromOld = oldSigner.signServiceToken({
      subject: 'gateway',
      audience: 'course',
      scopes: ['gateway:proxy'],
      expiresInSeconds: 60,
    });
    const fromNew = rotated.signServiceToken({
      subject: 'gateway',
      audience: 'course',
      scopes: ['gateway:proxy'],
      expiresInSeconds: 60,
    });
    for (const token of [fromOld, fromNew]) {
      await expect(
        verifier.verify(token, { type: 'service', audience: 'course' }),
      ).resolves.toMatchObject({
        subject: 'gateway',
      });
    }
  });
});

describe('BootstrapServiceClientsUseCase', () => {
  const input = {
    clientId: 'gateway',
    clientSecret: SECRET,
    audiences: ['course', 'student'],
    scopes: ['gateway:proxy'],
  };

  it('chỉ ghi khi chưa có hoặc cấu hình đổi, không ghi lại khi giống hệt', async () => {
    const clients = new InMemoryServiceClients();
    const bootstrap = new BootstrapServiceClientsUseCase(clients);

    await expect(bootstrap.execute([input])).resolves.toEqual({ written: ['gateway'] });
    expect(clients.rows.get('gateway')?.secretHash).not.toContain(SECRET);

    await expect(bootstrap.execute([input])).resolves.toEqual({ written: [] });
    expect(clients.upserts).toBe(1);

    await expect(
      bootstrap.execute([{ ...input, scopes: ['gateway:proxy', 'x'] }]),
    ).resolves.toEqual({ written: ['gateway'] });
    await expect(
      bootstrap.execute([
        { ...input, scopes: ['gateway:proxy', 'x'], clientSecret: 'another-long-secret-1' },
      ]),
    ).resolves.toEqual({ written: ['gateway'] });
    expect(clients.upserts).toBe(3);
  });
});
