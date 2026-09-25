# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-submission-service` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 24/09/2026 15:34 (UTC+7) |
| Hoàn thành thực tế | 24/09/2026 16:37 (UTC+7) — finalization ngoại lệ |
| Tổng thời lượng | Khoảng 22 phút cho phiên substantive implementation và kiểm chứng; chưa tính review/finalization |
| Pull request | [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) |
| Người review | Không có reviewer/verdict GitHub hợp lệ; review kỹ thuật theo ủy quyền Đức |
| Kết quả review | Ngoại lệ workflow — Bách xác nhận trực tiếp finalization không chờ GitHub `APPROVED` ngày 24/09/2026; vòng re-review kỹ thuật sau commit `1c699f7` không còn feedback blocking |

## Báo cáo công việc đã làm

- Triển khai Submission service với `POST /api/v1/submissions`, `GET /api/v1/submissions/{submission_id}`, validation, authorization và error envelope canonical.
- Triển khai HTTP client tới Course, Enrollment và Storage Mock với timeout cấu hình được, retry mặc định tắt, W3C propagation và dependency telemetry.
- Triển khai `submission_db`, migration/seed idempotent và PostgreSQL repository chỉ sở hữu metadata/object reference.
- Triển khai Storage Mock thành process/service riêng qua network, có object API và control plane deterministic cho latency/error/reset.
- Wire hai service vào build, lint, unit/contract test, telemetry assertion, PostgreSQL integration test và CI.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Submission service, migration, client và test | Code | [lms/services/submission](../../../../../lms/services/submission/) |
| Storage Mock điều khiển được | Code | [lms/services/submission-storage-mock](../../../../../lms/services/submission-storage-mock/) |
| Quality gate và CI wiring | Code / CI | [lms/package.json](../../../../../lms/package.json), [.github/workflows/ci.yml](../../../../../.github/workflows/ci.yml) |
| Pull request | GitHub | [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Endpoint nộp bài và đọc Submission theo ID đúng contract, validation và quyền | Đạt | `submission.controller.spec.ts`: create, validation, role, owner/instructor/internal read và forbidden/not-found paths đều pass |
| Gọi Course và Enrollment qua HTTP, trả lỗi canonical khi không hợp lệ | Đạt | `dependency-http.clients.spec.ts`, `submission.service.spec.ts` và `submission.controller.spec.ts`; Course `404` → `NOT_FOUND`, chưa enroll → `FORBIDDEN`; commit `1c699f7` bổ sung regression cho dependency `504` → timeout và Enrollment JSON lỗi → unavailable |
| Storage Mock qua network, điều khiển latency/error và có dependency span | Đạt | `storage.controller.spec.ts` kiểm tra put/get, latency, error/reset; `dependency.telemetry-test.mjs` kiểm tra span/metric `submission-storage` |
| Submission sở hữu riêng `submission_db`, không cross-service DB/source import | Đạt | Migration/repository integration pass; architecture boundary test trong `pnpm run ci:verify` pass |
| Unit/integration test, build, lint, health và CI pass | Đạt | `pnpm run ci:verify`; PostgreSQL integration; hai production Docker build; runtime health smoke cho Submission và Storage Mock đều đạt |
| Sản phẩm được push và truy cập qua PR | Đạt | Substantive commit `587198a` đã push; PR [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) |
| URL PR và `Chờ review` có trên PR head trước review | Đạt sau commit metadata này | Card, input, output và overview cùng tham chiếu PR #28; commit metadata được push trước khi review |
| GitHub `APPROVED` và completion metadata trước merge | Ngoại lệ đã xác nhận | Không có GitHub `APPROVED`; Bách xác nhận trực tiếp ngày 24/09/2026 cho phép finalization sau vòng re-review kỹ thuật. Metadata được commit/push trên chính PR trước merge |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thêm endpoint danh sách; giữ đúng HTTP contract v1 với endpoint đọc theo ID. Bổ sung control plane nội bộ `PUT/DELETE /internal/v1/fault` để test điều khiển và reset Storage Mock mà không đưa fault truth vào business payload.
- Việc chưa hoàn thành hoặc trở ngại: Không có GitHub `APPROVED`; finalization thực hiện theo ngoại lệ Bách xác nhận trực tiếp. Runtime đồng bộ plan/timeline thiếu `powershell`, nên timeline sinh tự động vẫn chờ đồng bộ. Môi trường local dùng Node 22.22.0 thay vì bản pin 22.13.1; production Docker build đã dùng đúng Node 22.13.1 và pass.
- Bước tiếp theo: Bách chỉ merge PR #28 sau khi GitHub checks của PR head đạt và branch protection cho phép; ngoại lệ approval đã được ghi nhận trung thực ở trên.

> Quy trình mặc định yêu cầu `APPROVED` hợp lệ trước finalization và không ghi merge time. Hồ sơ này áp dụng ngoại lệ do Bách xác nhận trực tiếp: không có GitHub `APPROVED`, và nguồn thay thế được ghi rõ trong bảng kết quả review/DoD. URL/số PR cùng trạng thái **Chờ review** đã có trên PR head trước review; metadata **Hoàn thành** được ghi trên branch PR trước merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical.
