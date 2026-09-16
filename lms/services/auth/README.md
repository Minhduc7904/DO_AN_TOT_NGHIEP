# Auth service

Auth sở hữu `auth_db`, login/refresh tối thiểu và JWT HS256 dùng cho workflow W1. Service không truy cập database hoặc source code của service khác.

## Chạy cục bộ

Từ thư mục `lms`, sao chép `services/auth/.env.example` thành `.env` để `ConfigModule` nạp cấu hình cục bộ, rồi chạy:

```powershell
Copy-Item services/auth/.env.example .env
npm exec --yes --package=corepack@0.34.0 -- corepack pnpm --filter @aiops-lms/auth build
npm exec --yes --package=corepack@0.34.0 -- corepack pnpm --filter @aiops-lms/auth migrate
npm exec --yes --package=corepack@0.34.0 -- corepack pnpm --filter @aiops-lms/auth start
```

Migration tạo bảng Auth theo hướng idempotent. Seed tạo duy nhất `student@example.test` với mật khẩu `example-password` khi user chưa tồn tại; đây là credential thử nghiệm cục bộ, không dùng cho môi trường thật.

## Biến môi trường

`AUTH_DATABASE_URL` phải trỏ duy nhất tới `auth_db`. `AUTH_JWT_SECRET` chỉ dùng secret local trong `.env.example`; môi trường triển khai phải cung cấp secret riêng, không ghi vào source, log hoặc telemetry.
