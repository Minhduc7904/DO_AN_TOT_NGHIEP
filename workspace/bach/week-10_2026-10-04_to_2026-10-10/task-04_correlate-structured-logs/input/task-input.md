# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_correlate-structured-logs` |
| Tên task | Chuẩn hóa structured logs, correlation và Loki ingestion |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Chờ review |
| Ngày tạo | 23/10/2026 (Asia/Saigon) |
| Thời gian dự kiến | 23/10/2026 (Bách chốt lại; mốc cũ trên card 22/10/2026 đã qua khi bắt đầu) |
| Nhánh thực hiện | `feat/week-10/task-04-correlate-structured-logs` |
| Pull request dự kiến | [PR #47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47) vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chuẩn hóa log runtime của Gateway, sáu business service và Storage Mock thành JSON theo [telemetry schema §5.4 `LogRecord`](../../../../../docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md#54-structured-logs--logrecord): timestamp UTC ISO-8601, severity, message, `service.name`, `service.version`, `service.instance.id`, và `trace_id`/`span_id` khi có active span. Định tuyến log qua Collector tới Loki, xác minh query theo service rồi lọc theo `trace_id`, và bảo đảm error log đủ cho diagnosis (HTTP status, error type, dependency identity, timeout semantics) nhưng không lộ secret/PII.

Hiện trạng trên `main` tại `2a71506`:

- Các service dùng logger mặc định của NestJS (text, không có trace context); log chủ động chỉ có ở Grading (HTTP filter, outbox worker, publisher, repository) và Notification (consumer, handler, messaging telemetry).
- `startTelemetry` (`lms/packages/observability/src/telemetry-bootstrap.ts`) chưa cấu hình `logRecordProcessors`; package observability chưa có OTel logs SDK/exporter. Theo issue #45, NodeSDK sẽ tự dựng OTLP log exporter mặc định tới `localhost:4318`, bỏ qua `telemetryHttpTransportOptions()` và không nằm trong `forceFlush`.
- Collector đã có pipeline `logs` (OTLP → Loki native OTLP); Loki chỉ index `service.name`, version/instance là structured metadata. `stack-smoke.mjs` hiện chỉ lọc log theo marker, chưa theo `trace_id`.

Hướng triển khai dự kiến:

1. Thêm log record processor/exporter OTLP HTTP dùng transport chung, endpoint `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` (tùy chọn, fallback từ endpoint traces giống metrics) cho tám runtime; đưa log vào `forceFlush` và flush khi shutdown (đã có thứ tự `app.close()` → `telemetry.shutdown()` từ PR #46).
2. Adapter logger dùng chung (Nest `LoggerService`) phát JSON ra stdout và OTel log record, lấy `trace_id`/`span_id` từ active context; ngoài context thì bỏ trống, không tạo ID giả.
3. Field lỗi bounded cho HTTP/dependency/messaging; redaction chặn token, password, payload và PII.
4. Smoke Compose thật: query Loki theo `service_name` rồi lọc `trace_id` của workflow, đối chiếu với trace Tempo; kiểm label Loki chỉ gồm tập bounded.

### Phạm vi không thực hiện

- Không thay toàn bộ logging framework khi adapter dùng chung đã đáp ứng contract.
- Không đưa `trace_id`, `span_id`, request/user/event/run ID hoặc ID cardinality cao thành Loki label; chỉ query qua field nội dung/structured metadata.
- Không dựng dashboard cuối cùng, `tracesToLogsV2`/`derivedFields` Grafana hoặc data normalization W11 (thuộc task-05 và W11).
- Không sửa substantive metrics/tracing của task-02/03 ngoài phần bootstrap tối thiểu cần để gắn log processor.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Structured logger và log export dùng chung | Code | `lms/packages/observability/` |
| Tích hợp logger vào tám runtime và env Compose | Code / Config | `lms/services/`, `docker-compose/compose.yaml`, `docker-compose/.env.example` |
| Collector/Loki log pipeline và query mẫu | Config / Docs | `docker-compose/observability/`, `lms/packages/observability/README.md`, `docker-compose/README.md` |
| Test schema, redaction, label và trace correlation | Test | `lms/packages/observability/test/`, `lms/test/observability/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 (Collector/Loki), task-02 (trace context), task-03 đã hoàn thành trên `main`; [PR #46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46) đã merge (thứ tự shutdown, identity broker). Theo [issue #45](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45), task-04 không có blocker. [Card canonical](../../../../../docs/processed/plan/weekly/week-10_2026-10-04_to_2026-10-10/task-04_correlate-structured-logs.md), telemetry schema §5.4 và catalogue runtime hiện hành.
- Người cần phối hợp: Đức hỗ trợ Collector/Compose và active span context. Bách chịu trách nhiệm schema/query/diagnosis semantics, đồng thời xác nhận phần collaborator còn thiếu của task-01..03 (nhu cầu query/retention, field phục vụ diagnosis, query cho anomaly) đang được ghi "chưa có xác nhận của Bách".
- Rủi ro hoặc giả định: Log rời rạc từ Nest logger/console phải được gom qua adapter mà không mất startup/error diagnostics. OTel logs SDK là dependency mới, phải pin version tương thích SDK hiện có (`0.222.0`/`2.11.0`). Export log không được chặn request path; khi Collector ngừng chạy, business request vẫn phải thành công. Mọi kiểm chứng phá hủy chỉ chạy trên project test cô lập.

## Definition of Done

- [ ] Log application là JSON hợp lệ với timestamp UTC ISO-8601, severity, message và ba resource identity field canonical.
- [ ] Log trong request/consumer context có `trace_id` và `span_id` khớp active span; log ngoài context ghi thiếu có chủ đích thay vì tạo ID giả.
- [ ] Loki ingest log của ít nhất Gateway, một service HTTP và Notification; query theo `service.name` rồi lọc `trace_id` trả đúng workflow.
- [ ] Error log biểu diễn HTTP status, error type, dependency identity và timeout semantics khi áp dụng; không log token, password, payload nhạy cảm hoặc PII.
- [ ] Loki labels chỉ dùng tập bounded; test/redaction check ngăn correlation/user/event/run ID thành label hoặc dữ liệu nhạy cảm bị ghi.
- [ ] Test liên quan, `pnpm run ci:verify` và Compose smoke pass.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
