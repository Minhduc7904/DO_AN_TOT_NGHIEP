# Auth service

Auth sở hữu `auth_db` (Prisma + PostgreSQL), đăng ký student, đăng nhập, refresh token, quản lý tài khoản 3 role (`student`, `instructor`, `admin`) và phát **hai loại token ký EdDSA (Ed25519)**: user access token (đăng nhập) và service access token (client-credentials) cho xác thực service-to-service ([ADR-004](../../../docs/processed/adr/adr-004-service-access-token-and-api-surfaces-v1.md)). Gateway và mọi service verify cục bộ bằng JWKS của Auth; Auth không truy cập database của service khác.

## Route

| Method | Path                            | Role  | Use case                                                                                                                                                                                                                    |
| ------ | ------------------------------- | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`         |   –   | `register-student`: tạo tài khoản rồi gọi `student` (`POST /internal/v1/students`) tạo hồ sơ cùng `id`; student lỗi thì xóa tài khoản vừa tạo                                                                               |
| POST   | `/api/v1/auth/student/login`    |   –   | `login-student`: trả `access_token`, `refresh_token`, `principal`; gọi `student` (`GET /internal/v1/students/{id}`) và chỉ cấp token khi hồ sơ `ACTIVE` (không có hồ sơ hoặc `INACTIVE`/`BLOCKED` → 403, student lỗi → 503) |
| POST   | `/api/v1/auth/instructor/login` |   –   | `login-instructor`: chỉ tài khoản role `instructor`                                                                                                                                                                         |
| POST   | `/api/v1/auth/admin/login`      |   –   | `login-admin`: chỉ tài khoản role `admin`                                                                                                                                                                                   |
| POST   | `/api/v1/auth/refresh`          |   –   | `refresh-token`: xoay vòng, token cũ dùng một lần (xóa-và-đọc trong một câu lệnh)                                                                                                                                           |
| GET    | `/api/v1/auth/me`               |   *   | `get-current-account`                                                                                                                                                                                                       |
| POST   | `/api/v1/auth/accounts`         | admin | `create-account` (instructor hoặc admin)                                                                                                                                                                                    |
| GET    | `/api/v1/auth/accounts`         | admin | `list-accounts` (lọc `role`, phân trang)                                                                                                                                                                                    |

Use case nằm ở `src/application/use-cases/{accounts,sessions}/`, mỗi use case một class. Mật khẩu băm scrypt; ba cửa đăng nhập dùng chung `CredentialsAuthenticator`: sai email, sai mật khẩu, tài khoản bị khóa hay đúng mật khẩu nhưng sai cửa (ví dụ student vào admin) đều trả cùng một lỗi 401 và luôn thực hiện một lần băm để thời gian phản hồi không lộ email.

## Bề mặt internal và mở

Tách theo thư mục `src/adapters/http/`: `public/` (`/api/v1/auth/*` ở trên, chỉ Gateway gọi) · `internal/` · `open/` · `shared/` (presenter).

| Method | Path                              | Xác thực                               | Use case                                                                                                                                                                                                                                                                                                                                   |
| ------ | --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/internal/v1/auth/service-token` | `client_id`/`client_secret` trong body | `issue-service-token`: kiểm secret (scrypt), `audience` và `scope` được phép trong `auth_service_clients`; trả `{access_token, token_type, expires_in, scope}` (TTL `AUTH_SERVICE_TOKEN_TTL_SECONDS`, mặc định 600). Sai secret/client lạ/client khóa cùng trả `401 SERVICE_CLIENT_INVALID`; ngoài phạm vi → `403 SERVICE_SCOPE_FORBIDDEN` |
| GET    | `/.well-known/jwks.json`          | không                                  | `get-jwks`: khóa công khai hiện tại và khóa cũ (RFC 7517, không bọc envelope, `Cache-Control: public, max-age=60`)                                                                                                                                                                                                                         |

Auth tự xin service token cho chính mình (gọi `student`) bằng cách gọi thẳng use case, và verify token của chính nó bằng khóa cục bộ nên không phụ thuộc HTTP vào chính nó lúc khởi động. `BootstrapRunner` đồng bộ client dịch vụ **trước** rồi mới seed tài khoản.

## Seed khi khởi động

`BootstrapAccountsUseCase` tạo tài khoản cố định nếu email chưa tồn tại, đọc từ `AUTH_BOOTSTRAP_{ADMIN,INSTRUCTOR,STUDENT}_{ID,EMAIL,PASSWORD}`; bỏ trống email hoặc mật khẩu thì bỏ qua tài khoản đó. `created_at` cố định `2026-08-27T09:00:00Z` để fingerprint reset/seed ổn định. Compose đặt mặc định `admin@example.test`, `instructor@example.test`, `student@example.test` với mật khẩu `example-password` (chỉ dùng cục bộ). Không có service `admin` riêng ([ADR-003](../../../docs/processed/adr/adr-003-remove-admin-service-v1.md)): admin chỉ là một tài khoản role `admin` của `auth`. Tài khoản student seed được bảo đảm có hồ sơ ở `student` (gọi `GET` rồi `POST /internal/v1/students` khi thiếu) vì đăng nhập student yêu cầu hồ sơ; auth khởi động sau `student` healthy trong compose.

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

`AUTH_DATABASE_URL` trỏ duy nhất tới `auth_db`. `AUTH_SIGNING_KEY_PEM` là khóa ký Ed25519 (PKCS8 PEM, xuống dòng viết `\n`); bắt buộc khi `NODE_ENV=production` trừ khi đặt `AUTH_ALLOW_EPHEMERAL_SIGNING_KEY=true` (Compose testbed đặt mặc định `true`); thiếu khóa thì sinh khóa tạm khi khởi động (token mất hiệu lực sau khi khởi động lại). `AUTH_PREVIOUS_PUBLIC_KEY_PEM` (SPKI) giữ khóa cũ trong JWKS khi xoay khóa. `SERVICE_CLIENT_ID`/`SERVICE_CLIENT_SECRET` là danh tính của chính auth; `SERVICE_CLIENTS_BOOTSTRAP` là JSON mảng `{client_id, client_secret (≥16 ký tự), audiences[], scopes[]}` đồng bộ vào `auth_service_clients`. Chỉ dùng secret local trong `.env.example`, môi trường triển khai phải cung cấp secret riêng, không ghi vào source, log hoặc telemetry. Ngoài ra: `AUTH_JWT_TTL_SECONDS` (user token), `AUTH_SERVICE_TOKEN_TTL_SECONDS`, `AUTH_REFRESH_TTL_SECONDS`, `AUTH_STUDENT_BASE_URL`, `AUTH_STUDENT_TIMEOUT_MS`, `AUTH_STUDENT_BREAKER_{THRESHOLD,COOLDOWN_MS}`.
