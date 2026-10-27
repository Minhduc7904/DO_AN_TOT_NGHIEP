# Auth service

Auth sở hữu `auth_db` (Prisma + PostgreSQL), đăng ký student, đăng nhập, refresh token, quản lý tài khoản 3 role (`student`, `instructor`, `admin`) và phát JWT HS256. Gateway verify JWT cục bộ; Auth không truy cập database của service khác.

## Route

| Method | Path                    | Role  | Use case                                                                                                                                      |
| ------ | ----------------------- | :---: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/register` |   –   | `register-student`: tạo tài khoản rồi gọi `student` (`POST /internal/v1/students`) tạo hồ sơ cùng `id`; student lỗi thì xóa tài khoản vừa tạo |
| POST   | `/api/v1/auth/login`    |   –   | `login`: trả `access_token`, `refresh_token`, `principal`                                                                                     |
| POST   | `/api/v1/auth/refresh`  |   –   | `refresh-token`: xoay vòng, token cũ dùng một lần (xóa-và-đọc trong một câu lệnh)                                                             |
| GET    | `/api/v1/auth/me`       |   *   | `get-current-account`                                                                                                                         |
| POST   | `/api/v1/auth/accounts` | admin | `create-account` (instructor hoặc admin)                                                                                                      |
| GET    | `/api/v1/auth/accounts` | admin | `list-accounts` (lọc `role`, phân trang)                                                                                                      |

Use case nằm ở `src/application/use-cases/{accounts,sessions}/`, mỗi use case một class. Mật khẩu băm scrypt; đăng nhập sai email, sai mật khẩu hay tài khoản bị khóa đều trả cùng một lỗi 401 và luôn thực hiện một lần băm để thời gian phản hồi không lộ email.

## Seed khi khởi động

`BootstrapAccountsUseCase` tạo tài khoản cố định nếu email chưa tồn tại, đọc từ `AUTH_BOOTSTRAP_{ADMIN,INSTRUCTOR,STUDENT}_{ID,EMAIL,PASSWORD}`; bỏ trống email hoặc mật khẩu thì bỏ qua tài khoản đó. `created_at` cố định `2026-08-27T09:00:00Z` để fingerprint reset/seed ổn định. Compose đặt mặc định `admin@example.test`, `instructor@example.test`, `student@example.test` với mật khẩu `example-password` (chỉ dùng cục bộ). `AUTH_BOOTSTRAP_ADMIN_ID` phải trùng `ADMIN_IDS` của service `admin`. Hồ sơ student của tài khoản student seed không được tạo ở `student` (R-10 seeder xử lý).

## Chạy và kiểm tra

```bash
export AUTH_DATABASE_URL=postgresql://user:pw@localhost:5432/auth_db
pnpm --filter @aiops-lms/auth prisma:migrate:dev --name init   # lần đầu
pnpm --filter @aiops-lms/auth build && pnpm --filter @aiops-lms/auth start

node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/auth/jest.config.ts   # unit
AUTH_DATABASE_URL=… pnpm run test:auth:e2e   # PostgreSQL thật đã migrate, student giả bằng HTTP stub
```

Container chạy `prisma migrate deploy` trước khi khởi động. Volume Postgres cũ của v1 đã có bảng `auth_users` khác schema nên phải tạo lại (`down --volumes`).

## Biến môi trường

`AUTH_DATABASE_URL` trỏ duy nhất tới `auth_db`. `AUTH_JWT_SECRET` tối thiểu 32 ký tự; chỉ dùng secret local trong `.env.example`, môi trường triển khai phải cung cấp secret riêng, không ghi vào source, log hoặc telemetry. Ngoài ra: `AUTH_JWT_TTL_SECONDS`, `AUTH_REFRESH_TTL_SECONDS`, `AUTH_STUDENT_BASE_URL`, `AUTH_STUDENT_TIMEOUT_MS`, `AUTH_STUDENT_BREAKER_{THRESHOLD,COOLDOWN_MS}`.
