# Issue #44: Review tổng thể W5–W10 task-03: lệch code, hồ sơ và tài liệu canonical

> Nguồn: [issue #44 trên GitHub](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/44). Đây là issue tổng hợp, chỉ ghi nhận phát hiện của một đợt review chỉ đọc trên `main` tại `3e7dedf`. Mỗi hạng mục cần được xử lý trong task/branch/PR riêng; khi bắt đầu xử lý, tách thành issue hoặc task riêng.

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Issue GitHub | [#44](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/44) |
| Trạng thái | Chưa fix |
| Mức độ | Hỗn hợp (xem từng hạng mục) |
| Nhãn GitHub | `bug`, `documentation` |
| Người báo | bachmk |
| Ngày mở | 22/10/2026 |
| Người xử lý | Chưa nhận |
| Nhánh fix | Chưa tạo |
| PR fix | Chưa có (đã có hai hạng mục được xử lý gián tiếp qua PR #46, xem bảng) |

## Quy tắc dùng ticket tổng hợp

- PR xử lý một phần dùng `Refs #44`, không dùng `Closes #44`. Chỉ `Closes #44` khi mọi hạng mục là `Đã fix` hoặc `Không áp dụng` có lý do.
- Mỗi PR cập nhật cột trạng thái và cột PR của đúng các hạng mục nó xử lý, trong chính branch của PR.
- Trạng thái `Chưa xác minh` nghĩa là chưa có ai đối chiếu lại với `main` hiện tại. Phải xác minh còn đúng trước khi fix; có thể đã được sửa bởi PR khác.

## Hạng mục

### A. Code cần sửa (ưu tiên giảm dần)

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| A01 | Course/Enrollment/Submission/Grading dùng chung superuser Postgres, đọc/ghi được DB của service khác (`compose.yaml`) | Chưa xác minh | — |
| A02 | Contract `grade.completed` dùng `.strict()` cho header và payload; field/header lạ hoặc thiếu `traceparent` khiến consumer `nack(requeue=false)`, không có DLQ nên mất message | Chưa xác minh | — |
| A03 | Metrics RabbitMQ mang `service.name=notification` cùng version/instance giả | Đã fix (trùng blocker của #45) | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| A04 | NodeSDK tự tạo OTLP log exporter ngầm (`telemetry-bootstrap.ts`), bỏ qua transport chung và không nằm trong `forceFlush` | Chưa xác minh (thuộc W10 task-04, PR [#47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47)) | — |
| A05 | Ngân sách timeout không nhất quán: Gateway 5.000 ms nhưng Submission tuần tự 3×3.000 ms + DB; client nhận 504 trong khi downstream vẫn commit, POST submission không idempotent nên retry tạo bản ghi trùng | Chưa xác minh | — |
| A06 | Gateway trả 404 với `code: INTERNAL_ERROR` (`codeFor` thiếu 404/409/413) | Chưa xác minh | — |
| A07 | Auth Postgres không có timeout, lỗi DB trả 500 thay vì 503/504, metric dùng `status='error'` ngoài tập hợp lệ | Chưa xác minh | — |
| A08 | Endpoint điều khiển fault của Storage Mock (`/internal/v1/fault`, `/state`) sinh telemetry, lộ thời điểm inject F2 | Chưa xác minh | — |
| A09 | Storage Mock dùng `service.name=submission-storage`, không có trong catalogue, có nguy cơ lọt vào candidate set RCA | Chưa xác minh | — |
| A10 | Client Course coi mọi 2xx là hợp lệ, policy yêu cầu 2xx sai schema → 503 | Chưa xác minh | — |

### B. Nhỏ và dọn dẹp

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| B01 | `health.e2e-spec.ts` của Course chờ 404 nhưng route trả 401; `test:e2e` không nằm trong `ci:verify` | Chưa xác minh | — |
| B02 | Job CI `testbed-reset` không có `actions/setup-node` (không pin Node 22.13.1) | Chưa xác minh | — |
| B03 | Event `EVENT_INVALID` bị worker retry vô hạn, `findPending` có thể nghẽn đầu hàng; consumer `nack(requeue=true)` không delay | Chưa xác minh | — |
| B04 | Dedup Notification chỉ trong bộ nhớ; test "restart" thực chất là reconnect cùng process | Chưa xác minh | — |
| B05 | Auth bỏ qua scrypt khi email không tồn tại, lộ thông tin qua thời gian phản hồi | Chưa xác minh | — |
| B06 | JWT secret mặc định vẫn được chấp nhận khi `NODE_ENV=production` | Chưa xác minh | — |
| B07 | `/health` sinh span và RED series; `http_status_class` trộn `client_aborted`/`exception` | Chưa xác minh | — |
| B08 | ESLint boundary không chặn `import()` động, chưa có test cho layer rule | Chưa xác minh | — |
| B09 | Sleep cố định có nguy cơ flaky trong nhiều test | Chưa xác minh | — |
| B10 | Tên queue trong Collector vừa dùng env vừa hardcode regex | Chưa xác minh | — |
| B11 | Course Dockerfile copy `package.json` không cần thiết; `.dockerignore` thiếu `**/.env.*` | Chưa xác minh | — |

### C. Bằng chứng test bị mô tả quá mức

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| C01 | E2E W3/W5/W9 chạy in-process, W5 dùng queue khác queue canonical; output cần ghi rõ giới hạn hoặc bổ sung smoke black-box qua Gateway container | Chưa xác minh | — |
| C02 | Assertion F4 `messageCount >= 1` đúng cả khi không bật fault; CI không chạy `test:w5:postgres:slowdown` | Chưa xác minh | — |

### D. Hồ sơ và quy trình

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| D01 | PR #41 merge khi GitGuardian `failure` mà hồ sơ không giải trình | Đã fix một phần (bỏ fallback password, ghi giải trình); còn việc đánh dấu false positive trên dashboard GitGuardian, xem [ticket #45](issue-045_w10-task-01-03-followup.md) | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| D02 | PR #15 merge khi verdict còn `CHANGES_REQUESTED`; điều khoản ngoại lệ thêm sau, cần ghi hồi tố | Chưa xác minh | — |
| D03 | W9 task-05 (PR #40): tiếp quản và bỏ cổng review không do người phụ trách khi đó chỉ thị; commit sửa `workspace/` của người khác | Chưa xác minh | — |
| D04 | Card `Hoàn thành` nhưng DoD chưa tick (W6-02, W7-01/02/03, W9-05) | Chưa xác minh | — |
| D05 | DoD tick chỉ dựa trên lời xác nhận, không có bằng chứng (W5-02 DoD 5, W8-01 DoD 3) | Chưa xác minh | — |
| D06 | Thứ tự readiness sai ở PR #16, #19, #33, #42 | Chưa xác minh | — |
| D07 | Commit thẳng `main` trộn quy ước dùng chung với hồ sơ task (`24b7a32`, `8b7d52d`) | Chưa xác minh | — |
| D08 | Overview W6 và W8 vẫn `Đang thực hiện` dù mọi task đã `Hoàn thành` | Chưa fix (kiểm lại ngày 24/10/2026: cả hai overview vẫn ghi `Đang thực hiện`) | — |
| D09 | Hồ sơ W8 task-02 trong workspace vẫn ghi "Đang thực hiện" dù đã có commit, cần ghi chú bàn giao sang PR #34 | Chưa xác minh | — |
| D10 | Thông tin merge lỗi thời trong Markdown (trái quy tắc không ghi trạng thái mutable `Đã merge`) | Chưa xác minh | — |
| D11 | Text hỏng định dạng ở W10 overview, `docker-compose/README.md`, `lms/packages/observability/README.md` | Đã fix (PR #46 sửa text mất khoảng trắng); chưa tự kiểm lại từng dòng | [#46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) |
| D12 | Gate M2 vẫn `Chờ xử lý`: thiếu bằng chứng thành viên B tự giải thích ít nhất hai workflow xuyên service (một sync, một async `grade.completed`); cần task/PR mới vì W9-05 đã đóng | Chưa fix (W10 overview ngày 24/10/2026 vẫn ghi Gate M2 `Chờ xử lý`) | — |

### E. Đề xuất sửa tài liệu (cần thống nhất trước khi sửa)

| Mã | Hạng mục | Trạng thái | PR |
| --- | --- | --- | --- |
| E01 | `git-and-pull-request-rules.md`: thay "mặc định + bỏ qua tùy ý" bằng 3 mức review rõ ràng; thêm mục "Tiếp quản task"; sửa câu về branch protection | Chưa xác minh | — |
| E02 | Template card: câu "Thành viên còn lại phải gửi `APPROVED`" mâu thuẫn điều khoản ngoại lệ | Chưa xác minh | — |
| E03 | `http-and-event-contracts-v1`: §2.5, §4.2 lỗi thời; ví dụ `evt-grade-001` trái schema `uuid`; bổ sung 403/503/504; mô tả `POST /grades` trả 503 khi grade đã commit nhưng publish lỗi | Chưa xác minh | — |
| E04 | `dependency-resilience-policy-v1`: bất biến "timeout Gateway > tổng timeout downstream", tham số circuit breaker, hành vi retry messaging, nguồn timeout DB/Redis | Chưa xác minh | — |
| E05 | Thống nhất `dependency_identity` giữa policy §5 và telemetry schema §3.2 / catalogue §2 | Chưa xác minh | — |
| E06 | Catalogue/telemetry schema: bổ sung vị trí của Storage Mock trong candidate set RCA | Chưa xác minh | — |
| E07 | `data-ownership-and-fault-matrix-v1` §2: chốt key/TTL/invalidation cache Course theo implementation | Chưa xác minh | — |
| E08 | `backend_microservice_testbed_blueprint.md:182–197`: cấu trúc thư mục không khớp thực tế | Chưa xác minh | — |
| E09 | Bất nhất nhỏ: `weekly-summary.md` vs `weekly-overview.md`; kebab-case vs `_` trong tên tuần/task; `copilot-instructions.md` chép lại quy tắc commit | Chưa xác minh | — |
| E10 | Chính sách cho biểu mẫu học phần (`.docx`) và dữ liệu cá nhân trong repository public | Chưa xác minh | — |

## Còn lại hoặc ngoài phạm vi

- Ticket này chưa được xác minh từng hạng mục với `main` hiện tại. Các hạng mục `Chưa xác minh` cần được đối chiếu trước khi nhận xử lý.
- Hạng mục E cần thống nhất giữa hai thành viên trước khi sửa tài liệu canonical.

## Lịch sử trạng thái

| Ngày | Trạng thái | Ghi chú |
| --- | --- | --- |
| 22/10/2026 | Chưa fix | Issue được mở |
| 24/10/2026 | Chưa fix | Lập ticket trong repository. A03, D01, D11 lấy từ mô tả PR #46; D08, D12 đối chiếu trực tiếp với overview W6, W8, W10; các hạng mục còn lại chưa xác minh |
