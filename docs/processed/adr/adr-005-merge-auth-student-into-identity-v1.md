# ADR-005 — Gộp `auth` và `student` thành service `identity`

| Trường            | Nội dung                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trạng thái        | Đề xuất (Đức tự thực hiện, không cần Bách review)                                                                                                                                                                                         |
| Ngày              | 30/10/2026                                                                                                                                                                                                                                |
| Người đề xuất     | Đức                                                                                                                                                                                                                                       |
| Thay thế một phần | Quyết định 1 và 5 và mục "Phương án đã loại" (gộp `auth` vào `student`) của [ADR-001](adr-001-restructure-lms-testbed-v1.md); quyết định 3 của [ADR-003](adr-003-remove-admin-service-v1.md) (giữ `student` là service riêng)           |
| Liên quan         | [ADR-004](adr-004-service-access-token-and-api-surfaces-v1.md) (service token, JWKS): cơ chế giữ nguyên, chỉ đổi tên service phát token                                                                                                  |

## Bối cảnh

Hồ sơ của `student` chỉ có email, tên và trạng thái, gần như trùng với tài khoản ở `auth`; `auth` cũng không có nghiệp vụ nào độc lập với việc student có hồ sơ (đăng nhập student đòi hồ sơ `ACTIVE`). Việc tách hai service buộc đăng ký phải tạo dữ liệu ở hai database:

- Bản đầu tiên tạo tài khoản rồi gọi `student`, lỗi thì xóa tài khoản; xóa bù có thể cũng lỗi và để lại hồ sơ mồ côi.
- Bản thiết kế đồng bộ có trạng thái `PENDING` ở cả hai bên, bước `activate`, nhận lại tài khoản bỏ dở và job dọn. Đã thử ở nhánh task-14 và nhận ra mỗi bước thêm lại mở ra một khoảng lệch mới (ví dụ `student` đã `ACTIVE` mà `auth` kích hoạt lỗi, hồ sơ `ACTIVE` nằm trong danh sách recipient của `notification-worker` trước khi tài khoản dùng được).
- Khi khởi động, `auth` cần `student` để seed hồ sơ student mẫu và `student` cần JWKS của `auth` để verify token, tạo vòng phụ thuộc bootstrap và phải thêm retry nền.

Microservice không có transaction chung nên phần phức tạp này không bỏ được, chỉ giảm được bằng cách bỏ ranh giới giữa hai service. Ở quy mô testbed này ranh giới đó không bảo vệ một nhu cầu thay đổi, mở rộng hay sở hữu dữ liệu độc lập nào.

## Quyết định

1. Gộp `auth` và `student` thành **một service `identity`** (`service.name=identity`, package `@aiops-lms/identity`, cổng 3001, database `identity_db`). Topology còn **7 service + 4 worker (11 runtime)** và 6 logical DB.
2. Một bảng tài khoản dùng chung cho 3 role (`identity_users`) và một bảng hồ sơ riêng của student (`identity_student_profiles`, khóa chính `user_id` là khóa ngoại tới `identity_users`, `ON DELETE CASCADE`). Email và tên chỉ nằm ở `identity_users`.
3. Đăng ký student là **một transaction PostgreSQL cục bộ** tạo tài khoản `ACTIVE` và hồ sơ `ACTIVE`; email trùng trả `409`. Bỏ trạng thái `PENDING`, bước `activate`, pre-check email qua HTTP và job dọn. Đăng nhập student vẫn đòi hồ sơ `ACTIVE` (không có hồ sơ hoặc `INACTIVE`/`BLOCKED` → 403) nhưng đọc cùng truy vấn với tài khoản.
4. Giữ nguyên URL public: `/api/v1/auth/*`, `/api/v1/students/*` và `/internal/v1/auth/service-token`; Gateway chuyển cả hai prefix tới upstream `identity`. Route nội bộ `GET /internal/v1/students` và `/{id}` giữ nguyên cho `media` và `notification-worker` (scope `student:profile:read`, audience `identity`). Bỏ `POST /internal/v1/students` và scope `student:profile:write`.
5. Bỏ client `auth` khỏi registry dịch vụ và các biến `AUTH_STUDENT_*`: `identity` không gọi service nào, tự verify token bằng khóa cục bộ. Seed client dịch vụ rồi tài khoản chạy **trước khi service listen**, lỗi thì không khởi động.
6. Đổi tên đầy đủ để không còn tên cũ gây hiểu nhầm: bảng/enum `identity_*`, env `AUTH_*` → `IDENTITY_*` ở mọi service, `GATEWAY_{AUTH,STUDENT}_BASE_URL` → `GATEWAY_IDENTITY_BASE_URL`, `MEDIA_STUDENT_*` → `MEDIA_IDENTITY_*`, `NOTIFICATION_STUDENT_*` → `NOTIFICATION_IDENTITY_*`, `TOKEN_ISSUER=aiops-lms-identity`, dependency identity `identity-postgres`, `<caller>-identity-token`, `<caller>-identity-jwks`, `media-identity`, `notification-worker-identity`.
7. Giữ chữ "auth" cho khái niệm xác thực (URL `/api/v1/auth/*`, `packages/common/src/auth`, header `authorization`, role JWT `student`, từ "student" trong miền `course`).
8. Tạo baseline migration `init` mới cho `identity`, bỏ ba migration cũ của `auth` (hai) và `student` (một). Chấp nhận được vì testbed luôn dựng lại từ volume sạch (`down --volumes`) và chưa có dữ liệu thật cần giữ.

## Hệ quả

- Số liệu topology: 12 → 11 runtime, 7 → 6 logical DB, 22 → 21 thành phần Compose, candidate set RCA 11 → 10. Cạnh `e03` (`gateway → student`) nhập vào `e02`, cạnh `e09` (`auth → student`) bỏ; giữ nguyên mã cạnh còn lại để các tài liệu khác không phải đánh số lại. Các số đo (cặp service-identity, cạnh HTTP, độ trễ) được đo lại sau khi gộp, ghi ở board R-13.
- Dễ hơn: đăng ký và seed là một transaction/một service; không còn hồ sơ mồ côi, trạng thái chờ, vòng phụ thuộc bootstrap, retry nền và hai client dịch vụ chỉ để gọi nhau.
- **Mất chuỗi nhiều bước cho RCA:** cạnh `auth → student` từng tạo chuỗi `gateway → auth → student` trong luồng đăng ký, giờ chỉ còn `gateway → identity`.
- **Ba case dồn về một root cause:** C5 (FE, trước là `student`), C6 (FG) và C7 (FH) đều có `root_cause_service=identity`. Primary metric ở mức service không phân biệt được ba case này; chúng chỉ khác nhau ở `component` (`identity-postgres`, tiến trình `identity`, `identity-jwks`). Ranking hằng tốt nhất đặt `identity` cộng hai service khác ở Top-3 đúng 5/7 case (≈ 71%, trước đó 4/7 ≈ 57%) và Top-1 đúng 3/7 (≈ 43%, trước đó 2/7 ≈ 29%). Phải đọc cùng `K` khi báo cáo và cân nhắc thêm case ở các service còn lại hoặc báo cáo diagnostic theo component (xem evaluation-protocol mục 4.1 và 18).
- **Vùng ảnh hưởng của `identity-postgres` rộng hơn:** làm chậm DB này giờ ảnh hưởng cả đăng nhập, cấp service token lẫn lấy recipient, trước đây chỉ đăng nhập student và snapshot notification bị ảnh hưởng qua `student-postgres`. FE và FG chia sẻ `identity-postgres`; phân biệt bằng route và tên span.
- Cấu hình cũ (`AUTH_*`, `docker-compose/.env`, volume Postgres có `auth_db`/`student_db`) không dùng được nữa; phải cập nhật `.env` và tạo lại volume.

## Phương án đã loại

- Giữ hai service và dùng saga/`PENDING` (đã làm thử ở task-14, bỏ): thêm trạng thái, job dọn và các khoảng lệch mà không có nhu cầu tách thật.
- Gộp vào tên `student` hoặc giữ tên `auth`: tên không còn đúng khi service vừa giữ tài khoản và token vừa giữ hồ sơ student.
- Bảng tài khoản riêng cho từng role: không cần, ba role dùng chung email/mật khẩu/trạng thái; hồ sơ riêng chỉ có ở student.
- Hai database trong một service: không cần, một transaction cục bộ là mục đích chính của việc gộp.
