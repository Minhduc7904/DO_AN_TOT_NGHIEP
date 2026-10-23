# Task tuần: Xuất service metrics và kiểm chứng metrics baseline

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_export-service-metrics` |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Đức |
| Collaborator | Bách kiểm tra khả năng query cho anomaly |
| Ưu tiên | Cao |
| Hạn dự kiến | 22/10/2026 — mốc bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-03-export-service-metrics` |

## Yêu cầu và phạm vi

### Cần thực hiện

Hoàn thiện export metrics từ toàn bộ service qua OTel Collector tới Prometheus. Chuẩn hóa service-level RED metrics và các dependency/messaging signal cần cho anomaly/RCA, ưu tiên request count, error count, duration histogram, dependency error/latency và RabbitMQ backlog/processing signal khả dụng. Mọi label phải bounded, dùng route template/status class/dependency identity ổn định và có test ngăn high-cardinality identifiers.

### Không thực hiện

- Không xây feature engineering hoặc data normalization của W11.
- Không đưa `trace_id`, `span_id`, request/user/event ID hoặc `run_id` vào metric labels.
- Không tạo dashboard Grafana cuối cùng; thuộc task-05.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01; metrics primitive hiện có trong package observability; telemetry schema canonical.
- Người hoặc phần việc cần phối hợp: Bách xác nhận query tối thiểu phục vụ anomaly/RCA; không yêu cầu Bách sửa code Platform.
- Rủi ro/giả định: histogram bucket/cardinality mặc định có thể không phù hợp controlled workload; mọi thay đổi bucket phải có lý do và test/query chứng minh.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Metrics instrumentation/export cho toàn topology | Code / Config | `lms/packages/observability/`, `lms/services/`, `docker-compose/` |
| Test cardinality và query Prometheus | Test | `lms/test/`, test telemetry của service |
| Danh mục metric/label và query mẫu | Docs | README observability hoặc tài liệu architecture liên quan |

## Definition of Done

- [x] Gateway, sáu business service và storage mock export service metrics qua Collector; Prometheus query được series có `service.name` đúng canonical.
- [x] RED metrics dùng route template, method, status class và bucket/label bounded; endpoint động không tạo một series cho từng ID.
- [x] Outbound HTTP/dependency và RabbitMQ có signal latency/error/retry/backlog hoặc giới hạn quan sát được tài liệu hóa rõ.
- [x] Test tự động chặn `trace_id`, `span_id`, request/user/event ID và `run_id` xuất hiện trong metric labels.
- [x] Query mẫu chứng minh phân biệt healthy, HTTP 5xx, timeout và dependency unavailable ở mức service/dependency.
- [x] Test liên quan, `pnpm run ci:verify` và Compose smoke pass; metrics export failure không làm application request path thất bại.
- [x] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-03_export-service-metrics/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-03_export-service-metrics/output/task-output.md).
- Pull request: [#43](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/43).
- Kết quả review: APPROVED nội bộ bởi agent độc lập tại `c132d82`; không có GitHub APPROVED của Bách, finalization theo ngoại lệ Đức xác nhận.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 22/10/2026 20:23 — finalization trước merge sau review độc lập và CI substantive head đạt.
- Reviewer kiểm chứng 29 tests và acceptance Prometheus đủ tám runtime; cold DB khi Collector dừng trả 200, export phục hồi. Chi tiết DoD, feedback DNS và trace nằm trong output.
- CI 39784597102 đạt cả 5 job; CI head finalization phải đạt trước merge. Không có GitHub approval Bách; dùng ngoại lệ Đức đã xác nhận.
- Task-04/05 giữ nguyên; task-03 chỉ hoàn thành canonical sau khi metadata và code vào main.

## Hậu kiểm theo issue #45 ngày 23/10/2026

- Blocker cho task-05 đã sửa trong PR follow-up: Collector giữ `service.name=notification` và `dependency_identity=notification-rabbitmq` cho series broker RabbitMQ nhưng xóa `service.version`/`service.instance.id` (kể cả giá trị prometheus receiver tự gán), đúng telemetry schema §5.1. Metrics smoke kiểm resource identity của mọi series có `service_name` business service.
- CI head cuối `4ecb95b` là [run 39786424620](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39786424620), đạt cả 5 job. Task hoàn thành 22/10/2026, đúng hạn dự kiến.
- Collaborator: chưa có xác nhận của Bách về khả năng query cho anomaly; Bách sẽ xác nhận trong task-04/05.
