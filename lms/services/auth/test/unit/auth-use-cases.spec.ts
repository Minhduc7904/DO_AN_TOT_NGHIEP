import { AppError } from '@aiops-lms/common/errors';

import { verifyPassword } from '../../src/domain/password.js';
import { BootstrapAccountsUseCase } from '../../src/application/use-cases/accounts/bootstrap-accounts.use-case.js';
import { CreateAccountUseCase } from '../../src/application/use-cases/accounts/create-account.use-case.js';
import { GetCurrentAccountUseCase } from '../../src/application/use-cases/accounts/get-current-account.use-case.js';
import { ListAccountsUseCase } from '../../src/application/use-cases/accounts/list-accounts.use-case.js';
import { RegisterStudentUseCase } from '../../src/application/use-cases/accounts/register-student.use-case.js';
import { LoginUseCase } from '../../src/application/use-cases/sessions/login.use-case.js';
import { RefreshTokenUseCase } from '../../src/application/use-cases/sessions/refresh-token.use-case.js';
import {
  InMemoryAccounts,
  InMemoryRefreshTokens,
  RecordingStudentClient,
  TOKEN_SETTINGS,
} from './fakes.js';

function decodeClaims(token: string): { sub: string; role: string; exp: number } {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
}

describe('RegisterStudentUseCase', () => {
  it('tạo tài khoản student, băm mật khẩu và tạo hồ sơ cùng id', async () => {
    const accounts = new InMemoryAccounts();
    const students = new RecordingStudentClient();

    const account = await new RegisterStudentUseCase(accounts, students).execute({
      email: ' An@Example.COM ',
      password: 'correct-horse',
      fullName: ' An ',
    });

    expect(account).toMatchObject({ email: 'an@example.com', fullName: 'An', role: 'student' });
    expect(students.created).toEqual([{ id: account.id, email: 'an@example.com', fullName: 'An' }]);
    const stored = accounts.rows.get(account.id);
    expect(stored?.passwordHash).not.toContain('correct-horse');
    await expect(verifyPassword('correct-horse', stored?.passwordHash ?? '')).resolves.toBe(true);
  });

  it('báo conflict khi email đã đăng ký và không tạo hồ sơ', async () => {
    const accounts = new InMemoryAccounts();
    const students = new RecordingStudentClient();
    const register = new RegisterStudentUseCase(accounts, students);
    await register.execute({ email: 'a@b.co', password: 'password-1', fullName: 'A' });

    await expect(
      register.execute({ email: 'A@b.co', password: 'password-2', fullName: 'B' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
    expect(students.created).toHaveLength(1);
  });

  it('xóa tài khoản vừa tạo khi student lỗi', async () => {
    const accounts = new InMemoryAccounts();
    const students = new RecordingStudentClient();
    students.failure = AppError.dependencyUnavailable('auth-student');

    await expect(
      new RegisterStudentUseCase(accounts, students).execute({
        email: 'a@b.co',
        password: 'password-1',
        fullName: 'A',
      }),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE', status: 503 });
    expect(accounts.rows.size).toBe(0);
  });
});

describe('LoginUseCase và RefreshTokenUseCase', () => {
  async function setup(): Promise<{
    accounts: InMemoryAccounts;
    refreshTokens: InMemoryRefreshTokens;
    login: LoginUseCase;
    refresh: RefreshTokenUseCase;
    accountId: string;
    students: RecordingStudentClient;
  }> {
    const accounts = new InMemoryAccounts();
    const refreshTokens = new InMemoryRefreshTokens(accounts);
    const students = new RecordingStudentClient();
    const account = await new RegisterStudentUseCase(accounts, students).execute({
      email: 'a@b.co',
      password: 'password-1',
      fullName: 'A',
    });
    return {
      accounts,
      refreshTokens,
      students,
      accountId: account.id,
      login: new LoginUseCase(accounts, refreshTokens, TOKEN_SETTINGS, students),
      refresh: new RefreshTokenUseCase(refreshTokens, TOKEN_SETTINGS),
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
    expect(decodeClaims(result.access_token)).toMatchObject({ sub: accountId, role: 'student' });
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
    const { login, students, accountId } = await setup();

    students.statuses.delete(accountId);
    await expect(login.execute({ email: 'a@b.co', password: 'password-1' })).rejects.toMatchObject({
      status: 403,
    });

    for (const status of ['INACTIVE', 'BLOCKED'] as const) {
      students.statuses.set(accountId, status);
      await expect(
        login.execute({ email: 'a@b.co', password: 'password-1' }),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it('student lỗi thì đăng nhập thất bại 503 thay vì cấp token chưa kiểm tra', async () => {
    const { login, students } = await setup();
    students.failure = AppError.dependencyUnavailable('auth-student');

    await expect(login.execute({ email: 'a@b.co', password: 'password-1' })).rejects.toMatchObject({
      status: 503,
    });
  });

  it('sai mật khẩu không gọi student; instructor và admin đăng nhập không cần hồ sơ student', async () => {
    const { login, accounts, students } = await setup();
    const create = new CreateAccountUseCase(accounts);
    await create.execute({
      email: 'i@b.co',
      password: 'password-1',
      fullName: 'I',
      role: 'instructor',
    });
    students.failure = AppError.dependencyUnavailable('auth-student');

    await expect(login.execute({ email: 'i@b.co', password: 'password-1' })).resolves.toMatchObject(
      { principal: { role: 'instructor' } },
    );
    await expect(
      login.execute({ email: 'a@b.co', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401 });
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
    const students = new RecordingStudentClient();
    const bootstrap = new BootstrapAccountsUseCase(accounts, students);
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
    expect(students.created).toHaveLength(0);
  });

  it('bootstrap bảo đảm student seed có hồ sơ, kể cả khi tài khoản đã tồn tại từ trước', async () => {
    const accounts = new InMemoryAccounts();
    const students = new RecordingStudentClient();
    const bootstrap = new BootstrapAccountsUseCase(accounts, students);
    const seed = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'Student@Example.test',
      password: 'student-password',
      fullName: 'Học viên mẫu',
      role: 'student' as const,
    };

    await bootstrap.execute([seed]);
    expect(students.created).toEqual([
      { id: seed.id, email: 'student@example.test', fullName: 'Học viên mẫu' },
    ]);

    students.statuses.clear();
    await bootstrap.execute([seed]);
    expect(students.created).toHaveLength(2);
    await bootstrap.execute([seed]);
    expect(students.created).toHaveLength(2);
  });
});
