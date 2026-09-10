# Course service

Course là service mẫu đầu tiên của LMS workspace. Task 01 chỉ cung cấp bootstrap, environment validation, Clean Architecture boundary và liveness endpoint; chưa triển khai nghiệp vụ khóa học.

## Chạy cục bộ

Từ repository root:

```powershell
pnpm --dir lms install --frozen-lockfile
pnpm --dir lms start:course
Invoke-RestMethod http://localhost:3002/health
```

## Biến môi trường

| Biến       | Mặc định      | Yêu cầu                                 |
| ---------- | ------------- | --------------------------------------- |
| `NODE_ENV` | `development` | `development`, `test` hoặc `production` |
| `PORT`     | `3002`        | Số nguyên từ `1` đến `65535`            |

## Dependency direction

```text
domain <- application <- adapters
                    ^
                    |
              config/bootstrap
```

- `domain`: business model thuần TypeScript, không phụ thuộc framework.
- `application`: use case và outbound port; chỉ phụ thuộc domain.
- `adapters`: HTTP, persistence, messaging và external client implementation.
- `config`, `app.module.ts`, `main.ts`: environment và dependency wiring.

README trong boundary chưa có code chỉ giúp nhóm quan sát template. Khi code thật được thêm, README phải được cập nhật hoặc thu gọn; không tạo implementation giả để giữ hình dạng cây.
