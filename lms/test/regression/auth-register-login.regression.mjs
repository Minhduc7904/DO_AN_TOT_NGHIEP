import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  accountDtoSchema,
  loginResponseDtoSchema,
  studentDtoSchema,
} from '../../contracts/dist/index.js';
import {
  call,
  config,
  expectData,
  expectError,
  expectList,
  login,
  loginAdmin,
  registerStudent,
  unique,
} from './support/api.mjs';

test('auth-register-login: đăng ký, đăng nhập ba cửa, refresh xoay vòng, phân quyền theo role', async (t) => {
  const email = `${unique('dang-ky')}@example.test`;
  const password = 'student-password-1';

  await t.test(
    'đăng ký student: tài khoản ACTIVE, không lộ băm mật khẩu, email trùng bị 409',
    async () => {
      const registered = await call('POST', '/api/v1/auth/register', {
        body: { email, password, full_name: 'Học viên đăng ký' },
      });
      const account = expectData(registered, 201, accountDtoSchema, 'đăng ký');
      assert.equal(account.role, 'student');
      assert.equal(account.status, 'ACTIVE');
      assert.equal('password_hash' in account, false);

      const duplicate = await call('POST', '/api/v1/auth/register', {
        body: { email, password, full_name: 'Trùng' },
      });
      expectError(duplicate, 409);
    },
  );

  let session;
  await t.test('đăng nhập student, /me và hồ sơ student cùng id', async () => {
    session = await login('student', { email, password });
    const me = await call('GET', '/api/v1/auth/me', { token: session.token });
    assert.equal(expectData(me, 200, accountDtoSchema).email, email);

    const profile = await call('GET', '/api/v1/students/me', { token: session.token });
    const student = expectData(profile, 200, studentDtoSchema, 'hồ sơ student');
    assert.equal(student.id, session.id);
    assert.equal(student.status, 'ACTIVE');
  });

  await t.test('refresh xoay vòng: token cũ dùng lại bị 401', async () => {
    const refreshed = await call('POST', '/api/v1/auth/refresh', {
      body: { refresh_token: session.refreshToken },
    });
    const pair = expectData(refreshed, 200, undefined, 'refresh');
    assert.notEqual(pair.refresh_token, session.refreshToken);
    const reused = await call('POST', '/api/v1/auth/refresh', {
      body: { refresh_token: session.refreshToken },
    });
    assert.equal(reused.status, 401);
  });

  await t.test(
    'sai cửa và sai mật khẩu cùng một lỗi 401, không lộ tài khoản tồn tại hay không',
    async () => {
      const wrongPassword = await call('POST', '/api/v1/auth/student/login', {
        body: { email, password: 'sai-mat-khau-1' },
      });
      const wrongDoor = await call('POST', '/api/v1/auth/instructor/login', {
        body: { email, password },
      });
      const unknown = await call('POST', '/api/v1/auth/student/login', {
        body: { email: `${unique('khong-co')}@example.test`, password },
      });
      const codes = [wrongPassword, wrongDoor, unknown].map(
        (response) => expectError(response, 401).code,
      );
      assert.equal(new Set(codes).size, 1, `ba trường hợp phải cùng mã lỗi, nhận ${codes}`);
    },
  );

  await t.test('tài khoản khởi tạo: admin và instructor đăng nhập qua đúng cửa', async () => {
    const admin = await call('POST', '/api/v1/auth/admin/login', { body: config.admin });
    const adminSession = expectData(admin, 200, loginResponseDtoSchema, 'admin login');
    assert.equal(adminSession.principal.role, 'admin');
    const instructor = await call('POST', '/api/v1/auth/instructor/login', {
      body: config.instructor,
    });
    assert.equal(expectData(instructor, 200, loginResponseDtoSchema).principal.role, 'instructor');
  });

  await t.test('admin tạo instructor mới, liệt kê có phân trang; student bị 403', async () => {
    const admin = await loginAdmin();
    const instructorEmail = `${unique('giang-vien')}@example.test`;
    const created = await call('POST', '/api/v1/auth/accounts', {
      token: admin.token,
      body: {
        email: instructorEmail,
        password: 'instructor-password-1',
        full_name: 'Giảng viên mới',
        role: 'instructor',
      },
    });
    const account = expectData(created, 201, accountDtoSchema, 'admin tạo instructor');
    assert.equal(account.role, 'instructor');

    const listed = await call('GET', '/api/v1/auth/accounts?role=instructor&page_size=100', {
      token: admin.token,
    });
    const { items, pagination } = expectList(listed, accountDtoSchema);
    assert.ok(items.some((item) => item.id === account.id));
    assert.ok(items.every((item) => item.role === 'instructor'));
    assert.equal(pagination.page_size, 100);

    expectError(
      await call('GET', '/api/v1/auth/accounts', { token: session.token }),
      403,
      'FORBIDDEN',
    );
  });

  await t.test('không token, token rác và danh tính tự khai đều bị Gateway từ chối', async () => {
    assert.equal((await call('GET', '/api/v1/auth/me')).status, 401);
    assert.equal((await call('GET', '/api/v1/auth/me', { token: 'khong.phai.jwt' })).status, 401);
    const forged = await call('GET', '/api/v1/auth/accounts', {
      headers: { 'x-principal-id': session.id, 'x-principal-role': 'admin' },
    });
    assert.equal(forged.status, 401);
    const student = await registerStudent('quyen');
    const forgedWithToken = await call('GET', '/api/v1/auth/accounts', {
      token: student.token,
      headers: { 'x-principal-id': session.id, 'x-principal-role': 'admin' },
    });
    assert.equal(forgedWithToken.status, 403, 'header x-principal-* của client phải bị bỏ qua');
  });
});
