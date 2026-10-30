# ADR-004 — Tách API public / internal và xác thực service-to-service bằng service access token

| Trường            | Nội dung                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trạng thái        | Đề xuất (Đức tự thực hiện, không cần Bách review)                                                                                                                                   |
| Ngày              | 28/10/2026                                                                                                                                                                          |
| Người đề xuất     | Đức                                                                                                                                                                                 |
| Thay thế một phần | Quy ước "service tin `x-principal-*` trên mạng nội bộ" và "`/internal/v1/*` không cần JWT" ở [ADR-001](adr-001-restructure-lms-testbed-v1.md) và `http-and-event-contracts-v2` §1.1 |

_Cập nhật 30/10/2026 ([ADR-005](adr-005-merge-auth-student-into-identity-v1.md)): service `auth` và `student` đã gộp thành `identity`. Cơ chế token/JWKS và bề mặt API trong ADR này giữ nguyên; chữ `auth` ở dưới là service phát token, nay là `identity` (audience `identity`, dependency `<caller>-identity-token`/`<caller>-identity-jwks`, `TOKEN_ISSUER=aiops-lms-identity`). URL `/internal/v1/auth/service-token` giữ nguyên, scope `student:profile:write` và client `auth` đã bỏ._

## Bối cảnh

Sau R-04/R-05, danh tính được truyền theo hai cách tin cậy ngầm:

- Gateway verify JWT người dùng (HS256, secret chung) rồi đặt `x-principal-id/role`; service downstream tin hai header này vì "ở mạng nội bộ".
- Route `/internal/v1/*` (hiện chỉ `student`) được đánh dấu công khai, không xác thực; an toàn chỉ nhờ Gateway không route tới.

Hệ quả: bất kỳ tiến trình nào trong mạng nội bộ đều giả được principal hoặc gọi route nội bộ; HS256 buộc mọi service muốn verify phải giữ secret có khả năng ký; controller trộn route public và internal trong cùng file nên khó đọc và khó kiểm tra bằng máy. Với đề tài RCA còn một lý do riêng: dependency graph phải phản ánh đúng mọi cạnh thật, mà "cạnh không xác thực" không có danh tính nên không gán được caller/callee ổn định.

## Quyết định

1. **Hai bề mặt HTTP tách bạch.** Public `/api/v1/*` chỉ do Gateway gọi; internal `/internal/v1/*` dành cho service-to-service và không bao giờ đi qua Gateway. Mỗi service tách controller thành `adapters/http/public/` và `adapters/http/internal/`, dùng chung use case. Prefix là hằng số `PUBLIC_PREFIX`/`INTERNAL_PREFIX` trong `@aiops-lms/contracts`.
2. **Auth cấp hai loại token**, cùng chữ ký EdDSA nhưng phân biệt bằng claim `typ`:
   - _User access token_ (`typ=user`, `sub`=user id, `role`, `aud=aiops-lms`) từ đăng nhập/refresh.
   - _Service access token_ (`typ=service`, `sub`=tên service, `aud`=service đích, `scope`) từ xác thực dịch vụ kiểu client-credentials: `POST /internal/v1/auth/service-token` với `client_id`/`client_secret`/`audience`. TTL mặc định 10 phút, không có refresh token.
3. **Ký bất đối xứng EdDSA (Ed25519) + JWKS.** Chỉ `auth` giữ khóa riêng; mọi service verify cục bộ bằng khóa công khai lấy từ `GET /.well-known/jwks.json` (cache, chỉ tải lại khi hết hạn cache hoặc gặp `kid` lạ, có giới hạn tần suất). Không thêm thư viện JWT, dùng `node:crypto`.
4. **Mọi request vào service đều cần service token, kể cả route public** (phương án "P1"). Route public chỉ nhận token có `sub=gateway` và scope `gateway:proxy`; chỉ khi đó mới tin `x-principal-*`. Route internal khai báo scope bắt buộc bằng `@InternalApi({ scopes })`. Ngoại lệ không cần token: `/health`, `/ready` và JWKS (`@SkipAuth()`), cùng `POST /internal/v1/auth/service-token` (xác thực bằng client-credentials trong body).
5. **Gateway** verify user token bằng JWKS, từ chối `typ=service` (`TOKEN_TYPE_MISMATCH`), và gắn service token của chính nó (audience = upstream) khi proxy. `Authorization` của client không bao giờ được chuyển tiếp.
6. **Registry client** trong `auth_db` (`auth_service_clients`): `client_id`, secret băm scrypt, `allowed_audiences`, `allowed_scopes`, `active`. Đồng bộ khi khởi động từ `SERVICE_CLIENTS_BOOTSTRAP`; không hard-code secret trong code.
7. **Mã lỗi mới** (chỉ phần xác thực; mã nghiệp vụ giữ nguyên): `SERVICE_TOKEN_MISSING` (401), `SERVICE_TOKEN_INVALID` (401), `TOKEN_TYPE_MISMATCH` (401), `SERVICE_SCOPE_FORBIDDEN` (403), `SERVICE_CLIENT_INVALID` (401).

## Vì sao chọn P1 cho route public (đánh giá cho dữ liệu huấn luyện)

Phương án thay thế (P2) chỉ bắt `/internal` có token, còn route public vẫn tin header theo "mạng tin cậy". Chọn P1 vì:

1. **Topology ổn định, một mô hình tin cậy.** Mọi cạnh trong dependency graph đều có danh tính (`sub`) và loại token; không còn đường vòng không xác thực làm graph khác thực tế. Phải chốt trước khi sinh dataset và ground truth.
2. **Nhiễu nền thấp và xác định.** Token verify cục bộ, không có lời gọi mạng theo từng request. Service cache token, làm mới nền ở 50% TTL (single-flight) nên request thường không bao giờ chờ `auth`. Lưu lượng nền chỉ là một lần lấy token mỗi (caller, audience) mỗi ~5 phút, theo chu kỳ cố định, gắn nhãn được qua dependency identity `<caller>-auth-token`.
3. **Thêm một lớp lỗi có giá trị RCA.** `auth` chậm/chết hoặc JWKS không truy cập được → token hết hạn → lỗi lan "cách hai bước" (triệu chứng ở course/media, gốc ở auth). Ghi vào ma trận fault ở `data-ownership-and-fault-matrix-v2` (F-AUTH-\*).
4. **Một guard duy nhất.** P2 cần hai chế độ tin cậy (có/không token) và dễ rò; P1 chỉ có một đường kiểm tra.

Rủi ro chính là `auth` thành điểm lỗi chung. Giảm bằng: làm mới chủ động trước hạn; **stale-while-error** (lấy token lỗi vẫn dùng token cũ đến hết hạn; JWKS lỗi vẫn dùng khóa đã cache); circuit breaker trên lời gọi lấy token; JWKS chỉ tải lại khi cần.

## Hệ quả

- Thêm hai loại cạnh telemetry: `<caller>-auth-jwks` (tải JWKS) và `<caller>-auth-token` (lấy service token), xem `service-catalogue-and-topology-v2` §5.4 và edge `e25–e26`.
- Đổi HS256 → EdDSA làm mọi token cũ mất hiệu lực (testbed, chạy lại `reset-and-seed`). Biến `AUTH_JWT_SECRET`/`GATEWAY_JWT_SECRET` bị bỏ; thêm `AUTH_SIGNING_KEY_PEM`, `SERVICE_CLIENT_ID/SECRET`, `AUTH_BASE_URL`.
- Xoay khóa: đặt khóa mới ở `AUTH_SIGNING_KEY_PEM` và khóa cũ (chỉ phần công khai) ở `AUTH_PREVIOUS_PUBLIC_KEY_PEM`; JWKS công bố cả hai trong cửa sổ TTL của token.
- Vòng khởi động `auth` ↔ `student`: `auth` seed tài khoản bằng cách gọi `student`, mà `student` cần JWKS của `auth` để verify. Vì vậy `auth` seed client dịch vụ trước khi listen, seed tài khoản nền sau khi listen (thử lại), và `/ready` chỉ ok khi seed xong.
- Chưa có giới hạn tốc độ cho `service-token` (chống dò secret); client secret dài ≥ 16 ký tự và so sánh thời gian cố định. Xem xét lại ở R-12.
- Template service (`lms/templates/service`), ESLint (`public` ↔ `internal` không import nhau) và `lms/test/http-surface.test.mjs` ép quy ước cho service mới (media, notification, scheduler, ai).

## Phương án đã loại

- **P2** (chỉ `/internal` cần token): xem trên.
- **HS256 với secret chung**: mọi service verify đều giữ được khả năng ký; không phân biệt được ai là bên phát.
- **mTLS giữa service**: đúng hướng production nhưng thêm hạ tầng chứng chỉ mà không tạo thêm tín hiệu cho RCA; token ứng dụng đủ cho phạm vi đề tài.
- **Tách `auth` thành hai service** (user auth / service auth): tăng số service và edge mà không có lợi ích tương ứng.
