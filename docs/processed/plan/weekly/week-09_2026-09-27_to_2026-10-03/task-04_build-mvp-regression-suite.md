# Task tuần: Xây regression suite cho Testbed MVP

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_build-mvp-regression-suite` |
| Tuần | `week-09_2026-09-27_to_2026-10-03` |
| Trạng thái | Chờ xử lý |
| Người phụ trách | Bách |
| Collaborator | Đức hỗ trợ môi trường testbed |
| Ưu tiên | Cao |
| Hạn dự kiến | 16/10/2026 — mốc bù tiến độ |
| Nhánh thực hiện | `test/week-09/task-04-build-mvp-regression-suite` |

## Yêu cầu và phạm vi

### Cần thực hiện

Xây một regression entrypoint cho Testbed MVP chạy từ dữ liệu sạch, bao phủ tối thiểu workflow `login → course → enroll → submit` và `submit → grade → grade.completed → notification`. Suite phải kiểm tra happy path, error/latency propagation quan trọng, topology HTTP + RabbitMQ và telemetry assertions; thất bại phải chỉ ra bước/service gây lỗi.

### Không thực hiện

- Không thay thế unit/integration test riêng của từng service.
- Không mở rộng business feature, thêm Assignment/UI hoặc dựng observability backend W10.
- Không dùng sleep cố định làm cơ chế đồng bộ async nếu có thể poll với timeout hữu hạn.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: W8 task-03; W9 task-01, task-02 và task-03 đã merge.
- Người hoặc phần việc cần phối hợp: Đức hỗ trợ cấu hình Gateway, Grading, RabbitMQ và reset/seed; kết quả cần đủ rõ để chạy độc lập ở task-05.
- Rủi ro/giả định: Bách hiện không tham gia nên task chưa thể bắt đầu; async assertions dễ flaky, mọi poll/retry của test phải có timeout, interval và failure diagnostics rõ.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Regression E2E entrypoint và test suite | Code | `lms/test/`, `lms/package.json` |
| Báo cáo coverage workflow/failure/telemetry | Docs | PR và output task |

## Definition of Done

- [ ] Một command chạy reset/seed rồi kiểm chứng hai workflow xuyên service qua Gateway và RabbitMQ từ trạng thái sạch.
- [ ] Suite bao phủ tối thiểu một timeout HTTP, một dependency unavailable và một failure/recovery messaging; error propagation đúng contract.
- [ ] Assertions xác minh topology có sáu business service + Gateway, PostgreSQL/Redis/RabbitMQ liên quan và trace correlation xuyên sync/async.
- [ ] Async test dùng polling có timeout hữu hạn, chạy ổn định ít nhất ba lần liên tiếp và in diagnostics đủ xác định bước lỗi.
- [ ] Regression entrypoint chạy trong CI hoặc có lý do/tách job rõ; `pnpm run ci:verify` và Compose smoke pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 11/10/2026 — lập task bù tiến độ W9.
- Ghi chú/tồn đọng: Chờ Bách tiếp tục công việc, W8 Notification/E2E và ba task hardening W9; không bắt đầu bằng cách sao chép các script test rời rạc.
