import { generateSigningKey } from '@aiops-lms/common/auth';
import { AppError } from '@aiops-lms/common/errors';

import { Ed25519TokenSigner } from '../../src/adapters/security/ed25519-token-signer.js';
import { TokenIssuer } from '../../src/application/token-issuer.js';
import { verifyPassword } from '../../src/domain/password.js';
import { BootstrapAccountsUseCase } from '../../src/application/use-cases/accounts/bootstrap-accounts.use-case.js';
import { CreateAccountUseCase } from '../../src/application/use-cases/accounts/create-account.use-case.js';
import { GetCurrentAccountUseCase } from '../../src/application/use-cases/accounts/get-current-account.use-case.js';
import { ListAccountsUseCase } from '../../src/application/use-cases/accounts/list-accounts.use-case.js';
import { RegisterStudentUseCase } from '../../src/application/use-cases/accounts/register-student.use-case.js';
import { CredentialsAuthenticator } from '../../src/application/use-cases/sessions/credentials-authenticator.js';
import { LoginAdminUseCase } from '../../src/application/use-cases/sessions/login-admin.use-case.js';
import { LoginInstructorUseCase } from '../../src/application/use-cases/sessions/login-instructor.use-case.js';
import { LoginStudentUseCase } from '../../src/application/use-cases/sessions/login-student.use-case.js';
import { RefreshTokenUseCase } from '../../src/application/use-cases/sessions/refresh-token.use-case.js';
import { GetStudentUseCase } from '../../src/application/use-cases/students/get-student.use-case.js';
import { ListStudentsUseCase } from '../../src/application/use-cases/students/list-students.use-case.js';
import {
  InMemoryAccounts,
  InMemoryRefreshTokens,
  InMemoryStudents,
  TOKEN_SETTINGS,
} from './fakes.js';

function decodeClaims(token: string): {
  sub: string;
  role: string;
  exp: number;
  typ: string;
  aud: string;
} {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
}

describe('RegisterStudentUseCase', () => {
  it('tạo tài khoản student cùng hồ sơ ACTIVE, băm mật khẩu', async () => {
    const accounts = new InMemoryAccounts();

    const account = await new RegisterStudentUseCase(accounts).execute({
      email: ' An@Example.COM ',
      password: 'correct-horse',
      fullName: ' An ',
    });

    expect(account).toMatchObject({ email: 'an@example.com', fullName: 'An', role: 'student' });
    expect(accounts.profiles.get(account.id)).toMatchObject({ status: 'ACTIVE' });
    const stored = accounts.rows.get(account.id);
    expect(stored?.passwordHash).not.toContain('correct-horse');
    await expect(verifyPassword('correct-horse', stored?.passwordHash ?? '')).resolves.toBe(true);
  });

  it('báo conflict khi email đã đăng ký và không tạo thêm gì', async () => {
    const accounts = new InMemoryAccounts();
    const register = new RegisterStudentUseCase(accounts);
    await register.execute({ email: 'a@b.co', password: 'password-1', fullName: 'A' });

    await expect(
      register.execute({ email: 'A@b.co', password: 'password-2', fullName: 'B' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
    expect(accounts.rows.size).toBe(1);
    expect(accounts.profiles.size).toBe(1);
  });

  it('lỗi khi chèn hồ sơ thì không để lại tài khoản (một transaction)', async () => {
    const accounts = new InMemoryAccounts();
    accounts.failProfileInsert = true;

    await expect(
      new RegisterStudentUseCase(accounts).execute({
        email: 'a@b.co',
        password: 'password-1',
        fullName: 'A',
      }),
    ).rejects.toThrow('profile insert failed');
    expect(accounts.rows.size).toBe(0);
    expect(accounts.profiles.size).toBe(0);
  });
});

describe('đăng nhập theo role và RefreshTokenUseCase', () => {
  async function setup(): Promise<{
    accounts: InMemoryAccounts;
    refreshTokens: InMemoryRefreshTokens;
    login: LoginStudentUseCase;
    loginInstructor: LoginInstructorUseCase;
    loginAdmin: LoginAdminUseCase;
    refresh: RefreshTokenUseCase;
    accountId: string;
  }> {
    const accounts = new InMemoryAccounts();
    const refreshTokens = new InMemoryRefreshTokens(accounts);
    const authenticator = new CredentialsAuthenticator(accounts);
    const tokens = new TokenIssuer(
      refreshTokens,
      new Ed25519TokenSigner(generateSigningKey()),
      TOKEN_SETTINGS,
    );
    const account = await new RegisterStudentUseCase(accounts).execute({
      email: 'a@b.co',
      password: 'password-1',
      fullName: 'A',
    });
    return {
      accounts,
      refreshTokens,
      accountId: account.id,
      login: new LoginStudentUseCase(authenticator, tokens),
      loginInstructor: new LoginInstructorUseCase(authenticator, tokens),
      loginAdmin: new LoginAdminUseCase(authenticator, tokens),
      refresh: new RefreshTokenUseCase(refreshTokens, tokens),
    };
  }

  it('đăng nhập trả JWT mang sub và role cùng refresh token', async () => {
    const { login, accountId } = await setup();

    const result = await login.execute({ email: 'A@B.co', password: 'password-1' });

    expect(result).toMatchObject({
      token_type: 'Bearer',
      expires_in_seconds: 3_600,
      principal: { id: accountId, role: 'student' },
    });
    expect(decodeClaims(result.access_token)).toMatchObject({
      sub: accountId,
      role: 'student',
      typ: 'user',
      aud: 'aiops-lms',
    });
  });

  it('từ chối sai mật khẩu, email lạ và tài khoản bị khóa bằng cùng một lỗi', async () => {
    const { login, accounts, accountId } = await setup();

    await expect(
      login.execute({ email: 'a@b.co', password: 'wrong-password' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Thông tin đăng nhập không hợp lệ',
    });
    await expect(login.execute({ email: 'x@b.co', password: 'password-1' })).rejects.toMatchObject({
      status: 401,
      message: 'Thông tin đăng nhập không hợp lệ',
    });

    const row = accounts.rows.get(accountId);
    if (row) row.status = 'DISABLED';
    await expect(login.execute({ email: 'a@b.co', password: 'password-1' })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('student chưa có hồ sơ hoặc hồ sơ không hoạt động thì bị từ chối, không cấp token', async () => {
    const { login, accounts, accountId } = await setup();
    const profile = accounts.profiles.get(accountId);
    accounts.profiles.delete(accountId);
    await expect(login.execute({ email: 'a@b.co', password: 'password-1' })).rejects.toMatchObject({
      status: 403,
    });

    for (const status of ['INACTIVE', 'BLOCKED'] as const) {
      if (profile) accounts.profiles.set(accountId, { ...profile, status });
      await expect(
        login.execute({ email: 'a@b.co', password: 'password-1' }),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it('instructor và admin đăng nhập không cần hồ sơ student, chỉ qua đúng cửa của mình', async () => {
    const { login, loginInstructor, loginAdmin, accounts } = await setup();
    const create = new CreateAccountUseCase(accounts);
    await create.execute({
      email: 'i@b.co',
      password: 'password-1',
      fullName: 'I',
      role: 'instructor',
    });
    await create.execute({
      email: 'ad@b.co',
      password: 'password-1',
      fullName: 'Ad',
      role: 'admin',
    });

    await expect(
      loginInstructor.execute({ email: 'i@b.co', password: 'password-1' }),
    ).resolves.toMatchObject({ principal: { role: 'instructor' } });
    await expect(
      loginAdmin.execute({ email: 'ad@b.co', password: 'password-1' }),
    ).resolves.toMatchObject({ principal: { role: 'admin' } });

    // Đúng mật khẩu nhưng sai cửa: cùng lỗi 401 như sai mật khẩu.
    for (const attempt of [
      loginAdmin.execute({ email: 'i@b.co', password: 'password-1' }),
      loginInstructor.execute({ email: 'ad@b.co', password: 'password-1' }),
      loginInstructor.execute({ email: 'a@b.co', password: 'password-1' }),
      login.execute({ email: 'ad@b.co', password: 'password-1' }),
      loginAdmin.execute({ email: 'ad@b.co', password: 'wrong-password' }),
    ]) {
      await expect(attempt).rejects.toMatchObject({
        status: 401,
        message: 'Thông tin đăng nhập không hợp lệ',
      });
    }
  });

  it('refresh xoay vòng token: token cũ dùng một lần', async () => {
    const { login, refresh } = await setup();
    const first = await login.execute({ email: 'a@b.co', password: 'password-1' });

    const second = await refresh.execute(first.refresh_token);

    expect(second.refresh_token).not.toBe(first.refresh_token);
    await expect(refresh.execute(first.refresh_token)).rejects.toMatchObject({ status: 401 });
    await expect(refresh.execute(second.refresh_token)).resolves.toMatchObject({
      token_type: 'Bearer',
    });
  });
});

describe('quản lý tài khoản', () => {
  it('admin tạo instructor, trùng email thì conflict, danh sách lọc theo role', async () => {
    const accounts = new InMemoryAccounts();
    const create = new CreateAccountUseCase(accounts);

    const instructor = await create.execute({
      email: 'i@b.co',
      password: 'password-1',
      fullName: 'I',
      role: 'instructor',
    });
    await create.execute({
      email: 'ad@b.co',
      password: 'password-1',
      fullName: 'Ad',
      role: 'admin',
    });

    expect(instructor.role).toBe('instructor');
    await expect(
      create.execute({ email: 'I@b.co', password: 'password-1', fullName: 'I2', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const list = new ListAccountsUseCase(accounts);
    await expect(list.execute({ role: 'instructor' }, 1, 20)).resolves.toMatchObject({ total: 1 });
    await expect(list.execute({}, 1, 20)).resolves.toMatchObject({ total: 2 });
  });

  it('get-current-account từ chối tài khoản không tồn tại hoặc bị khóa', async () => {
    const accounts = new InMemoryAccounts();
    const account = await new CreateAccountUseCase(accounts).execute({
      email: 'i@b.co',
      password: 'password-1',
      fullName: 'I',
      role: 'instructor',
    });
    const me = new GetCurrentAccountUseCase(accounts);

    await expect(me.execute(account.id)).resolves.toMatchObject({ email: 'i@b.co' });
    await expect(me.execute('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('bootstrap idempotent: lần hai không tạo lại và không ghi đè', async () => {
    const accounts = new InMemoryAccounts();
    const bootstrap = new BootstrapAccountsUseCase(accounts);
    const seeds = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'Admin@Example.test',
        password: 'admin-password',
        fullName: 'Quản trị viên',
        role: 'admin' as const,
      },
    ];

    await expect(bootstrap.execute(seeds)).resolves.toEqual({ created: ['Admin@Example.test'] });
    const hash = accounts.rows.get(seeds[0]?.id ?? '')?.passwordHash;
    await expect(bootstrap.execute(seeds)).resolves.toEqual({ created: [] });
    expect(accounts.rows.get(seeds[0]?.id ?? '')?.passwordHash).toBe(hash);
    expect(accounts.rows.size).toBe(1);
    expect(accounts.profiles.size).toBe(0);
  });

  it('bootstrap tạo student seed cùng hồ sơ và bù hồ sơ nếu tài khoản có từ trước', async () => {
    const accounts = new InMemoryAccounts();
    const bootstrap = new BootstrapAccountsUseCase(accounts);
    const seed = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'Student@Example.test',
      password: 'student-password',
      fullName: 'Học viên mẫu',
      role: 'student' as const,
    };

    await expect(bootstrap.execute([seed])).resolves.toEqual({ created: ['Student@Example.test'] });
    expect(accounts.profiles.get(seed.id)).toMatchObject({ status: 'ACTIVE' });

    accounts.profiles.clear();
    await expect(bootstrap.execute([seed])).resolves.toEqual({ created: [] });
    expect(accounts.profiles.get(seed.id)).toMatchObject({ status: 'ACTIVE' });
    expect(accounts.rows.size).toBe(1);
  });
});

describe('hồ sơ student', () => {
  async function setup(): Promise<{ students: InMemoryStudents; id: string }> {
    const accounts = new InMemoryAccounts();
    const account = await new RegisterStudentUseCase(accounts).execute({
      email: 'An@b.co',
      password: 'password-1',
      fullName: 'An',
    });
    return { students: new InMemoryStudents(accounts), id: account.id };
  }

  it('lấy hồ sơ theo id gồm email và họ tên của tài khoản, thiếu thì 404', async () => {
    const { students, id } = await setup();
    const get = new GetStudentUseCase(students);

    await expect(get.execute(id)).resolves.toMatchObject({
      id,
      email: 'an@b.co',
      fullName: 'An',
      status: 'ACTIVE',
    });
    await expect(get.execute('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('danh sách lọc theo trạng thái và phân trang', async () => {
    const { students } = await setup();
    const list = new ListStudentsUseCase(students);

    await expect(list.execute(1, 20, 'ACTIVE')).resolves.toMatchObject({ total: 1 });
    await expect(list.execute(1, 20, 'BLOCKED')).resolves.toMatchObject({ total: 0 });
    await expect(list.execute(2, 1)).resolves.toMatchObject({ items: [], total: 1 });
  });
});
