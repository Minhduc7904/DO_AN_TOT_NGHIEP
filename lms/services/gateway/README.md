# API Gateway

Gateway là trust boundary HTTP duy nhất của LMS: xác thực user access token, kiểm role theo bảng route rồi chuyển tiếp request tới service phía sau bằng **service access token** của chính nó ([ADR-004](../../../docs/processed/adr/adr-004-service-access-token-and-api-surfaces-v1.md)). Gateway **không đọc hay sửa body** và **không đổi phản hồi của upstream**.

## Việc Gateway làm

1. Chuẩn hóa path (gỡ `..`, `%2e%2e`) rồi chọn upstream theo tiền tố dài nhất ở [`src/domain/route-table.ts`](src/domain/route-table.ts). Chỉ bề mặt public `/api/v1/**` được proxy; `/internal/**`, `/.well-known/**` và path lạ trả `404 NOT_FOUND`.
2. Route công khai (không cần JWT): `POST /api/v1/auth/{register,student/login,instructor/login,admin/login,refresh}` và các route đọc media nhúng được vào trình duyệt (`/api/v1/media/{id}/content`, `/thumbnail`, `/usages/urls`, `/usages/{id}/url`, `/usage-jobs/{id}/status`). Mọi route khác cần `Authorization: Bearer <user access token EdDSA>` (verify cục bộ bằng JWKS của identity); thiếu hoặc sai → `401 UNAUTHORIZED`, service token dùng như user token → `401 TOKEN_TYPE_MISMATCH`.
3. Role: `/api/v1/scheduler`, `/api/v1/ai`, `/api/v1/notification-batches` chỉ cho `admin`; các route còn lại cho mọi role đã xác thực, service tự kiểm quyền chi tiết. Sai role → `403 FORBIDDEN`.
4. Xóa mọi `x-principal-*` và `Authorization` của client; gắn `Authorization: Bearer <service token của gateway, aud = service đích>` (lấy từ identity bằng client-credentials, cache, làm mới nền) và đặt `x-principal-id`, `x-principal-role` từ claim `sub`, `role`; chuyển `x-correlation-id` và `traceparent`.
5. Stream body tới upstream và stream phản hồi về client (multipart, byte lớn, `Range`/`Content-Range`).

## Quy tắc lỗi (giữ nguyên mã nghiệp vụ)

Mọi phản hồi HTTP của upstream, kể cả 4xx/5xx và các mã nghiệp vụ như `AI_PROVIDER_ERROR` (502) hay `QUIZ_HAS_ATTEMPTS`, được trả **nguyên vẹn** (status, header, body). Gateway chỉ tự sinh envelope lỗi khi:

| Tình huống                                                    | Phản hồi                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Không có route                                                | `404 NOT_FOUND`                                                                |
| Thiếu/sai/hết hạn user token                                  | `401 UNAUTHORIZED` (`401 TOKEN_TYPE_MISMATCH` nếu là service token)            |
| Không lấy được service token từ identity (hết hạn cache)      | `503 DEPENDENCY_UNAVAILABLE` (`details.dependency` = `gateway-identity-token`) |
| Sai role                                                      | `403 FORBIDDEN`                                                                |
| Upstream không kết nối được                                   | `503 DEPENDENCY_UNAVAILABLE` (`details.dependency` = `gateway-<service>`)      |
| Upstream không trả header trong `GATEWAY_UPSTREAM_TIMEOUT_MS` | `504 DEPENDENCY_TIMEOUT`                                                       |

Gateway không retry. Phản hồi 5xx của upstream vẫn được ghi nhận là lỗi ở span và metric `lms.dependency.*` của identity `gateway-<service>`, nên telemetry thấy lỗi dù client nhận đúng body gốc.

## Cấu hình

Xem [`.env.example`](.env.example). `SERVICE_CLIENT_ID`/`SERVICE_CLIENT_SECRET` là danh tính client `gateway` đã đăng ký ở identity (`SERVICE_CLIENTS_BOOTSTRAP`); `IDENTITY_JWKS_*` và `IDENTITY_TOKEN_*` chỉnh cache JWKS, timeout và breaker khi lấy token. `GATEWAY_*_BASE_URL` cho từng service (`GATEWAY_IDENTITY_BASE_URL` phục vụ cả `/api/v1/auth` lẫn `/api/v1/students` và cũng là nơi lấy JWKS và token); upstream bỏ trống (service chưa triển khai) thì route tương ứng không tồn tại. `GATEWAY_UPSTREAM_TIMEOUT_MS` (100–300000 ms, mặc định 30000) tính tới lúc có header phản hồi; body stream sau đó không bị giới hạn.

## Kiểm thử

```bash
node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config services/gateway/jest.config.ts   # unit + e2e (upstream HTTP giả)
node services/gateway/test/telemetry/dependency.telemetry-test.mjs                                          # span/metric
```

Đăng nhập qua Gateway bằng tài khoản seed được kiểm thêm bởi smoke observability trên Compose.
