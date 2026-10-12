# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-mvp-regression-suite` |
| Tên task | Xây regression suite cho Testbed MVP |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-09_2026-09-27_to_2026-10-03` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 12/10/2026 |
| Thời gian dự kiến | 12/10/2026–16/10/2026 (mốc bù tiến độ W9) |
| Nhánh thực hiện | `test/week-09/task-04-build-mvp-regression-suite` |
| Pull request dự kiến | PR từ nhánh task vào `main` sau khi hoàn tất work và bằng chứng DoD |

## Mục tiêu và phạm vi

### Task cần làm gì?

Xây một regression entrypoint cho Testbed MVP chạy từ dữ liệu sạch, bao phủ tối thiểu workflow `login → course → enroll → submit` và `submit → grade → grade.completed → notification`. Suite kiểm tra happy path, error/latency propagation quan trọng, topology HTTP + RabbitMQ và telemetry assertions; khi thất bại phải chỉ ra bước/service gây lỗi.

### Phạm vi không thực hiện

- Không thay thế unit/integration test riêng của từng service.
- Không mở rộng business feature, thêm Assignment/UI hoặc dựng observability backend W10.
- Không dùng sleep cố định làm cơ chế đồng bộ async nếu có thể poll với timeout hữu hạn.
- Không sửa substantive code của W9 task-01, task-02 hoặc task-03.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Regression E2E entrypoint và test suite | Code | `lms/test/`, `lms/package.json` |
| Báo cáo coverage workflow/failure/telemetry | Docs | `workspace/bach/week-09_2026-09-27_to_2026-10-03/task-04_build-mvp-regression-suite/output/task-output.md` và PR của task |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: W8 task-03 và W9 task-01 đã hoàn thành trên `main`; W9 task-02 (messaging hardening) và task-03 (reset/seed) của Đức phải merge trước khi hoàn tất và merge task này.
- Người cần phối hợp: Đức hỗ trợ cấu hình Gateway, Grading, RabbitMQ và lệnh reset/seed; kết quả cần đủ rõ để chạy độc lập ở W9 task-05.
- Rủi ro hoặc giả định: Trong lúc chờ task-02/task-03, dựng khung suite, happy path và các ca lỗi HTTP dựa trên `main` hiện tại; bước chuẩn bị dữ liệu và ca failure/recovery messaging được hoàn thiện sau khi dependency merge. Async assertions dễ flaky nên mọi poll/retry của test phải có timeout, interval và failure diagnostics rõ.

## Definition of Done

- [ ] Một command chạy reset/seed rồi kiểm chứng hai workflow xuyên service qua Gateway và RabbitMQ từ trạng thái sạch.
- [ ] Suite bao phủ tối thiểu một timeout HTTP, một dependency unavailable và một failure/recovery messaging; error propagation đúng contract.
- [ ] Assertions xác minh topology có sáu business service + Gateway, PostgreSQL/Redis/RabbitMQ liên quan và trace correlation xuyên sync/async.
- [ ] Async test dùng polling có timeout hữu hạn, chạy ổn định ít nhất ba lần liên tiếp và in diagnostics đủ xác định bước lỗi.
- [ ] Regression entrypoint chạy trong CI hoặc có lý do/tách job rõ; `pnpm run ci:verify` và Compose smoke pass.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
