# Course service

Course sở hữu `course_db` và cung cấp contract HTTP v1 cho tạo, liệt kê và xem khóa học. Gateway tạo `x-principal-id` và `x-principal-role` sau khi kiểm tra JWT; Course chỉ tin các header này từ mạng nội bộ.

## Cache và telemetry

Read path dùng Redis cache-aside; `course_db` luôn là nguồn dữ liệu chuẩn. Item key là `course:v1:item:{id}` và list key là `course:v1:list:{version}:{limit}`. TTL mặc định 60 giây, chỉnh bằng `COURSE_CACHE_TTL_SECONDS`. Sau khi tạo course, service tăng list version để vô hiệu hóa mọi biến thể `limit`; các key cũ tự hết hạn. Redis không sẵn sàng hoặc vượt `COURSE_CACHE_TIMEOUT_MS` thì request đọc trực tiếp PostgreSQL. Lỗi PostgreSQL được trả thành `503 DEPENDENCY_UNAVAILABLE` hoặc `504 DEPENDENCY_TIMEOUT`.

Course xuất HTTP server metrics/spans và dependency signal cho `course-postgres`/`course-redis` qua OpenTelemetry. Metrics chỉ dùng method, route template, status class, operation và dependency identity; không dùng principal/course ID làm label. Endpoint metrics OTLP được suy ra từ trace endpoint bằng `/v1/metrics`.

## API

- `POST /api/v1/courses`: `instructor`, body `{ "title": "..." }`, trả `201` với `id`, `title`, `created_at`.
- `GET /api/v1/courses?limit=20`: `student` hoặc `instructor`, trả `{ "items": [...] }`; `limit` trong khoảng 1–100.
- `GET /api/v1/courses/{course_id}`: `student` hoặc `instructor`, trả course hoặc `404 NOT_FOUND`.

Lỗi dùng error envelope canonical có `code`, `message`, `trace_id`, `timestamp`, `details`. Course không đọc `auth_db` và không remote-introspect JWT.

## Chạy cục bộ

Từ repository root:

```powershell
pnpm --dir lms install --frozen-lockfile
pnpm --dir lms --filter @aiops-lms/course build
$env:COURSE_DATABASE_URL='postgresql://localhost:5432/course_db' # điều chỉnh theo PostgreSQL local
node lms/services/course/dist/scripts/migrate.js
pnpm --dir lms start:course
Invoke-RestMethod http://localhost:3002/health
```

## Biến môi trường

| Biến                                 | Mặc định                          | Yêu cầu                                     |
| ------------------------------------ | --------------------------------- | ------------------------------------------- |
| `NODE_ENV`                           | `development`                     | `development`, `test` hoặc `production`     |
| `PORT`                               | `3002`                            | Số nguyên từ `1` đến `65535`                |
| `COURSE_DATABASE_URL`                | Local `course_db` PostgreSQL      | Connection string chỉ cho Course            |
| `COURSE_REDIS_URL`                   | `redis://localhost:6379`          | Redis do Course sử dụng                     |
| `COURSE_CACHE_TTL_SECONDS`           | `60`                              | TTL cache item và list                      |
| `COURSE_CACHE_TIMEOUT_MS`            | `300`                             | Giới hạn chờ Redis trước khi đọc PostgreSQL |
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

Migration dùng `CREATE TABLE IF NOT EXISTS` và seed `course-001` với `ON CONFLICT DO NOTHING`, nên chạy lại không nhân bản dữ liệu. Container Course chạy migration trước khi khởi động HTTP. Kiểm chứng PostgreSQL thực bằng `pnpm --dir lms test:course:postgres` với `W1_AUTH_DATABASE_URL` và `COURSE_DATABASE_URL` cấu hình tới hai logical database riêng.
