# Identity service

Identity sở hữu `identity_db` (Prisma + PostgreSQL): tài khoản 3 role (`student`, `instructor`, `admin`), hồ sơ student, đăng ký, đăng nhập, refresh token và **hai loại token ký EdDSA (Ed25519)**: user access token (đăng nhập) và service access token (client-credentials) cho xác thực service-to-service ([ADR-004](../../../docs/processed/adr/adr-004-service-access-token-and-api-surfaces-v1.md)). Gateway và mọi service verify cục bộ bằng JWKS của Identity; Identity không truy cập database của service khác và không gọi HTTP sang service nào.

Service này là kết quả gộp `auth` và `student` ([ADR-005](../../../docs/processed/adr/adr-005-merge-auth-student-into-identity-v1.md)). URL public vẫn giữ `/api/v1/auth/*` và `/api/v1/students/*`, nên Gateway, Postman và regression không đổi đường dẫn.

## Dữ liệu

| Bảng                        | Nội dung                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `identity_users`            | Tài khoản dùng chung 3 role: email (unique), `password_hash` (scrypt), `full_name`, `role`, `status` (`ACTIVE`/`DISABLED`)    |
| `identity_student_profiles` | Hồ sơ riêng của student: `user_id` (PK, FK → `identity_users`, `ON DELETE CASCADE`), `status` (`ACTIVE`/`INACTIVE`/`BLOCKED`) |
| `identity_refresh_tokens`   | Refresh token băm, mỗi token dùng một lần                                                                                     |
| `identity_service_clients`  | Registry client dịch vụ: secret băm scrypt, `audiences`, `scopes`                                                             |

Email và tên của student chỉ nằm ở `identity_users`; DTO student ghép từ hai bảng. Đăng ký student là **một transaction cục bộ** tạo `identity_users` (role `student`) cùng `identity_student_profiles`, nên không có trạng thái chờ, không có hồ sơ mồ côi và không cần bù trừ giữa hai service.

## Route public (chỉ Gateway gọi)

| Method | Path                            |       Role        | Use case                                                                                                                                                                                    |
| ------ | ------------------------------- | :---------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`         |         –         | `register-student`: transaction tạo tài khoản và hồ sơ `ACTIVE` cùng `id`; email trùng → `409`                                                                                              |
| POST   | `/api/v1/auth/student/login`    |         –         | `login-student`: trả `access_token`, `refresh_token`, `principal`; chỉ cấp token khi hồ sơ `ACTIVE` (không có hồ sơ hoặc `INACTIVE`/`BLOCKED` → 403). Hồ sơ đọc cùng truy vấn với tài khoản |
| POST   | `/api/v1/auth/instructor/login` |         –         | `login-instructor`: chỉ tài khoản role `instructor`                                                                                                                                         |
| POST   | `/api/v1/auth/admin/login`      |         –         | `login-admin`: chỉ tài khoản role `admin`                                                                                                                                                   |
| POST   | `/api/v1/auth/refresh`          |         –         | `refresh-token`: xoay vòng, token cũ dùng một lần (xóa-và-đọc trong một câu lệnh)                                                                                                           |
| GET    | `/api/v1/auth/me`               |         *         | `get-current-account`                                                                                                                                                                       |
| POST   | `/api/v1/auth/accounts`         |       admin       | `create-account` (instructor hoặc admin)                                                                                                                                                    |
| GET    | `/api/v1/auth/accounts`         |       admin       | `list-accounts` (lọc `role`, phân trang)                                                                                                                                                    |
| GET    | `/api/v1/students/me`           |      student      | `get-student` của chính người gọi                                                                                                                                                           |
| GET    | `/api/v1/students`              | admin, instructor | `list-students` (phân trang)                                                                                                                                                                |
| GET    | `/api/v1/students/{id}`         | admin, instructor | `get-student`                                                                                                                                                                               |

Use case nằm ở `src/application/use-cases/{accounts,sessions,students,service-auth}/`, mỗi use case một class. Ba cửa đăng nhập dùng chung `CredentialsAuthenticator`: sai email, sai mật khẩu, tài khoản bị khóa hay đúng mật khẩu nhưng sai cửa (ví dụ student vào admin) đều trả cùng một lỗi 401 và luôn thực hiện một lần băm để thời gian phản hồi không lộ email.

## Bề mặt internal và mở

Tách theo thư mục `src/adapters/http/`: `public/` · `internal/` · `open/` · `shared/` (presenter).

| Method | Path                              | Xác thực                                    | Use case                                                                                                                                                                                                                                                                                                                                           |
| ------ | --------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/internal/v1/auth/service-token` | `client_id`/`client_secret` trong body      | `issue-service-token`: kiểm secret (scrypt), `audience` và `scope` được phép trong `identity_service_clients`; trả `{access_token, token_type, expires_in, scope}` (TTL `IDENTITY_SERVICE_TOKEN_TTL_SECONDS`, mặc định 600). Sai secret/client lạ/client khóa cùng trả `401 SERVICE_CLIENT_INVALID`; ngoài phạm vi → `403 SERVICE_SCOPE_FORBIDDEN` |
| GET    | `/internal/v1/students`           | service token, scope `student:profile:read` | Student `ACTIVE` theo trang (id tăng dần) để notification-worker snapshot recipient                                                                                                                                                                                                                                                                |
| GET    | `/internal/v1/students/{id}`      | service token, scope `student:profile:read` | Hồ sơ theo id cho media (avatar) và notification-worker; `404` khi chưa có hồ sơ                                                                                                                                                                                                                                                                   |
| GET    | `/.well-known/jwks.json`          | không                                       | `get-jwks`: khóa công khai hiện tại và khóa cũ (RFC 7517, không bọc envelope, `Cache-Control: public, max-age=60`)                                                                                                                                                                                                                                 |

Identity verify token của chính nó bằng khóa cục bộ nên không phụ thuộc HTTP vào chính nó lúc khởi động. Hồ sơ student chỉ được tạo qua đăng ký (hoặc seed khởi động); không có route ghi nội bộ.

## Seed khi khởi động

`BootstrapRunner.onApplicationBootstrap` chạy **trước khi listen**, theo thứ tự cố định: đồng bộ client dịch vụ (`SERVICE_CLIENTS_BOOTSTRAP`) rồi seed tài khoản. Seed lỗi thì service không khởi động. Mọi dữ liệu nằm trong `identity_db` nên không phải chờ hay retry với service nào khác.

`BootstrapAccountsUseCase` tạo tài khoản cố định nếu email chưa tồn tại, đọc từ `IDENTITY_BOOTSTRAP_{ADMIN,INSTRUCTOR,STUDENT}_{ID,EMAIL,PASSWORD}`; bỏ trống email hoặc mật khẩu thì bỏ qua tài khoản đó. Tài khoản student seed được tạo cùng hồ sơ `ACTIVE` trong một transaction. `created_at` cố định `2026-08-27T09:00:00Z` để fingerprint reset/seed ổn định. Compose đặt mặc định `admin@example.test`, `instructor@example.test`, `student@example.test` với mật khẩu `example-password` (chỉ dùng cục bộ). Không có service `admin` riêng ([ADR-003](../../../docs/processed/adr/adr-003-remove-admin-service-v1.md)): admin chỉ là một tài khoản role `admin` của `identity`.

## Chạy và kiểm tra

```bash
export IDENTITY_DATABASE_URL=postgresql://user:pw@localhost:5432/identity_db
pnpm --filter @aiops-lms/identity prisma:migrate:dev --name <tên>   # khi đổi schema
pnpm --filter @aiops-lms/identity build && pnpm --filter @aiops-lms/identity start

node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/identity/jest.config.ts   # unit
IDENTITY_DATABASE_URL=… pnpm run test:identity:e2e   # PostgreSQL thật đã migrate, không cần service nào khác
```

Container chạy `prisma migrate deploy` trước khi khởi động. Migration `init` là baseline mới thay cho các migration của `auth`/`student` cũ; volume Postgres cũ còn `auth_db`/`student_db` phải tạo lại (`down --volumes`).

## Biến môi trường

`IDENTITY_DATABASE_URL` trỏ duy nhất tới `identity_db`. `IDENTITY_SIGNING_KEY_PEM` là khóa ký Ed25519 (PKCS8 PEM, xuống dòng viết `\n`); bắt buộc khi `NODE_ENV=production` trừ khi đặt `IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY=true` (Compose testbed đặt mặc định `true`); thiếu khóa thì sinh khóa tạm khi khởi động (token mất hiệu lực sau khi khởi động lại). `IDENTITY_PREVIOUS_PUBLIC_KEY_PEM` (SPKI) giữ khóa cũ trong JWKS khi xoay khóa. `SERVICE_CLIENTS_BOOTSTRAP` là JSON mảng `{client_id, client_secret (≥16 ký tự), audiences[], scopes[]}` đồng bộ vào `identity_service_clients`; audience của mọi client gọi vào service này là `identity` (guard so audience với tên service, lệch là 401/403). Chỉ dùng secret local trong `.env.example`, môi trường triển khai phải cung cấp secret riêng, không ghi vào source, log hoặc telemetry. Ngoài ra: `IDENTITY_JWT_TTL_SECONDS` (user token), `IDENTITY_SERVICE_TOKEN_TTL_SECONDS`, `IDENTITY_REFRESH_TTL_SECONDS`.
