# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-submission-service` |
| Tên task | Triển khai Submission service MVP và storage mock điều khiển được |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 24/09/2026 |
| Thời gian dự kiến | Bắt đầu 24/09/2026; hạn canonical 18/09/2026 đã qua và chưa tự thay đổi kế hoạch |
| Nhánh thực hiện | `feat/week-07/task-04-implement-submission-service` |
| Pull request dự kiến | PR từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Triển khai Submission service ở mức MVP: nhận bài nộp cho enrollment hợp lệ, kiểm tra Course và Enrollment qua HTTP, lưu object qua Storage Mock chạy bằng network, và lưu metadata/reference do Submission sở hữu. Service phải có validation, authorization, health/configuration, migration/seed, telemetry dependency và kiểm thử tương ứng theo Definition of Done của card Task 4.

### Phạm vi không thực hiện

Không triển khai Grading, Notification, upload production-grade, MinIO, fault injector F1 đầy đủ, cross-service database/source import hoặc Storage Mock in-process.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Submission API, client Course/Enrollment/Storage Mock và test | Code | `lms/services/submission/` |
| Storage Mock điều khiển latency/error qua network | Code | `lms/services/submission-storage-mock/` hoặc vị trí tương đương theo convention đã chốt |
| Migration/seed `submission_db` | Code | Thuộc Submission theo convention implementation |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: PR #25, #26 và #27 đã merge vào `main`; Course Week 6 đã merge; `docs/processed/architecture/http-and-event-contracts-v1.md`; `docs/processed/architecture/data-ownership-and-fault-matrix-v1.md`; `docs/processed/architecture/service-catalogue-and-topology-v1.md`.
- Người cần phối hợp: Đức review HTTP contract Submission↔Enrollment/Course và ranh giới Storage Mock.
- Rủi ro hoặc giả định: Bách đã xác nhận giữ HTTP contract v1; endpoint đọc là `GET /api/v1/submissions/{submission_id}`, không thêm endpoint danh sách trong Task 4. Storage Mock phải chạy như dependency riêng, có identity `submission-storage`, reset rõ và điều khiển latency/error từ test.

## Definition of Done

- [ ] Endpoint nộp bài và endpoint đọc Submission đã được chốt theo HTTP contract canonical; response/error contract, validation và quyền được kiểm tra.
- [ ] Submission gọi Course và Enrollment qua HTTP để xác nhận hợp lệ trước khi chấp nhận bài nộp; course/enrollment không hợp lệ trả error envelope canonical.
- [ ] Storage Mock chạy qua network, có dependency identity `submission-storage`, điều khiển được latency/error từ test và tạo outbound/dependency span khi Submission gọi tới.
- [ ] Submission là owner duy nhất của `submission_db` và object reference; không cross-service database hoặc source import.
- [ ] Unit, integration test, build, lint, health và CI pass.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
