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

| Biến                                 | Mặc định                          | Yêu cầu                                     |
| ------------------------------------ | --------------------------------- | ------------------------------------------- |
| `NODE_ENV`                           | `development`                     | `development`, `test` hoặc `production`     |
| `PORT`                               | `3002`                            | Số nguyên từ `1` đến `65535`                |
| `OTEL_SDK_DISABLED`                  | `false`                           | Chỉ nhận `true` hoặc `false`                |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://localhost:4318/v1/traces` | URL HTTP(S) đầy đủ của OTLP traces endpoint |
| `OTEL_SERVICE_VERSION`               | `0.1.0`                           | Version được gắn vào resource telemetry     |
| `OTEL_SERVICE_INSTANCE_ID`           | `course-local-1`                  | ID instance do runtime/deployment cấu hình  |

OpenTelemetry khởi tạo trước NestJS application. `service.name` luôn là `course` theo service catalogue; không lấy từ hostname, tên container hoặc process. Có thể tắt bootstrap bằng `OTEL_SDK_DISABLED=true` hoặc đổi endpoint mà không đổi code.

Nếu endpoint chưa sẵn sàng, Course vẫn khởi động và phục vụ request; lỗi export chỉ thuộc diagnostic/export path. Dữ liệu trace chưa export được có thể bị mất sau giới hạn retry/buffer của SDK. Lệnh assertion tự động:

```powershell
pnpm --dir lms test:telemetry
```

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
