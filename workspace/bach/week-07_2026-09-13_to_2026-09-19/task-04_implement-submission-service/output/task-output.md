# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-submission-service` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 24/09/2026 15:34 (UTC+7) |
| Hoàn thành thực tế | Chưa ghi — chờ Đức `APPROVED` và Bách finalization |
| Tổng thời lượng | Khoảng 22 phút cho phiên substantive implementation và kiểm chứng; chưa tính review/finalization |
| Pull request | [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) |
| Người review | Đức |
| Kết quả review | Chưa review |

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
| Gọi Course và Enrollment qua HTTP, trả lỗi canonical khi không hợp lệ | Đạt | `dependency-http.clients.spec.ts`, `submission.service.spec.ts` và `submission.controller.spec.ts`; Course `404` → `NOT_FOUND`, chưa enroll → `FORBIDDEN` |
| Storage Mock qua network, điều khiển latency/error và có dependency span | Đạt | `storage.controller.spec.ts` kiểm tra put/get, latency, error/reset; `dependency.telemetry-test.mjs` kiểm tra span/metric `submission-storage` |
| Submission sở hữu riêng `submission_db`, không cross-service DB/source import | Đạt | Migration/repository integration pass; architecture boundary test trong `pnpm run ci:verify` pass |
| Unit/integration test, build, lint, health và CI pass | Đạt | `pnpm run ci:verify`; PostgreSQL integration; hai production Docker build; runtime health smoke cho Submission và Storage Mock đều đạt |
| Sản phẩm được push và truy cập qua PR | Đạt | Substantive commit `587198a` đã push; PR [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) |
| URL PR và `Chờ review` có trên PR head trước review | Đạt sau commit metadata này | Card, input, output và overview cùng tham chiếu PR #28; commit metadata được push trước khi review |
| GitHub `APPROVED` và completion metadata trước merge | Chưa đạt | Đang chờ Đức review PR #28; chưa finalization và chưa merge |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thêm endpoint danh sách; giữ đúng HTTP contract v1 với endpoint đọc theo ID. Bổ sung control plane nội bộ `PUT/DELETE /internal/v1/fault` để test điều khiển và reset Storage Mock mà không đưa fault truth vào business payload.
- Việc chưa hoàn thành hoặc trở ngại: Chờ Đức review/`APPROVED`. Runtime đồng bộ plan/timeline thiếu `powershell`, nên timeline sinh tự động vẫn chờ đồng bộ. Môi trường local dùng Node 22.22.0 thay vì bản pin 22.13.1; production Docker build đã dùng đúng Node 22.13.1 và pass.
- Bước tiếp theo: Đức review contract/boundary/telemetry trên PR #28; Bách xử lý feedback nếu có, sau đó finalization trước merge theo workflow canonical.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
