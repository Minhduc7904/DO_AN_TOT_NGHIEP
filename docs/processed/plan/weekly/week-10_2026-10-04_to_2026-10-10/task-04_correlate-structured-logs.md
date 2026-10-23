# Task tuần: Chuẩn hóa structured logs và correlation

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_correlate-structured-logs` |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Đức hỗ trợ Collector/Compose và trace context |
| Ưu tiên | Cao |
| Hạn dự kiến | 23/10/2026 — Bách chốt lại ngày 23/10/2026 (mốc bù tiến độ cũ 22/10/2026) |
| Nhánh thực hiện | `feat/week-10/task-04-correlate-structured-logs` |

## Yêu cầu và phạm vi

### Cần thực hiện

Chuẩn hóa log runtime của Gateway, sáu business service và storage mock thành JSON có timestamp UTC ISO-8601, severity, message, `service.name`, `service.version`, `service.instance.id` và `trace_id`/`span_id` khi có active span. Định tuyến logs qua Collector tới Loki, xác minh query theo service/trace và kiểm tra error/timeout/dependency identity đủ dùng cho diagnosis nhưng không lộ secret/PII.

### Không thực hiện

- Không thay toàn bộ logging framework nếu adapter/interceptor dùng chung đã đáp ứng contract.
- Không đưa correlation ID có cardinality cao thành Loki label; dùng field nội dung để query khi phù hợp.
- Không dựng dashboard cuối cùng hoặc data normalization W11; thuộc task-05 và W11.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01; trace context từ task-02; telemetry schema canonical.
- Người hoặc phần việc cần phối hợp: Đức cung cấp Collector/Loki pipeline và hỗ trợ active span context; Bách chịu trách nhiệm schema/query/diagnosis semantics.
- Rủi ro/giả định: Bách bắt đầu ngày 23/10/2026 sau mốc hạn; log rời rạc từ Nest logger/console cần adapter thống nhất nhưng không được làm mất startup/error diagnostics.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Structured logger/correlation integration | Code | `lms/packages/observability/`, `lms/services/` |
| Collector/Loki log pipeline và query mẫu | Config / Docs | `docker-compose/observability/`, README liên quan |
| Test schema, redaction và trace correlation | Test | `lms/test/`, test telemetry của service |

## Definition of Done

- [x] Log application là JSON hợp lệ với timestamp UTC ISO-8601, severity, message và ba resource identity field canonical.
- [x] Log trong request/consumer context có `trace_id` và `span_id` khớp active span; log ngoài context ghi thiếu có chủ đích thay vì tạo ID giả.
- [x] Loki ingest log của ít nhất Gateway, một service HTTP và Notification; query theo `service.name` rồi lọc `trace_id` trả đúng workflow.
- [x] Error log biểu diễn HTTP status, error type, dependency identity và timeout semantics khi áp dụng; không log token, password, payload nhạy cảm hoặc PII.
- [x] Loki labels chỉ dùng tập bounded; test/redaction check ngăn correlation/user/event/run ID thành label hoặc dữ liệu nhạy cảm bị ghi.
- [x] Test liên quan, `pnpm run ci:verify` và Compose smoke pass.
- [x] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical. *(Finalization theo ngoại lệ do Bách (người phụ trách) xác nhận ngày 23/10/2026; không có GitHub `APPROVED` của Đức.)*

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-10_2026-10-04_to_2026-10-10/task-04_correlate-structured-logs/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-10_2026-10-04_to_2026-10-10/task-04_correlate-structured-logs/output/task-output.md).
- Pull request: [#47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47).
- Kết quả review: Bách tự review theo ngoại lệ (review `5623879276`, `COMMENTED`), feedback đã xử lý; không có review/`APPROVED` của Đức. Finalization và merge theo ngoại lệ do Bách (người phụ trách) xác nhận ngày 23/10/2026; không có GitHub `APPROVED` của Đức.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 23/10/2026 06:35 — finalization trước merge theo ngoại lệ Bách xác nhận; CI head `f9d50c4` đạt 5 job, GitGuardian đỏ do JWT giả trong lịch sử commit `32d6965` (đã giải trình trong output).
- Ghi chú/tồn đọng: Theo [issue #45](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45), task-04 không có blocker; cần cấu hình log processor/exporter dùng transport chung, `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` cho 8 runtime, flush khi shutdown và kiểm Loki theo `trace_id`. Quá mốc cũ 22/10/2026; Bách chốt mốc mới 23/10/2026.
- 23/10/2026: đã triển khai structured logger, log export OTLP tới Loki và `test:observability:logs`; regression, tracing, metrics và logs smoke pass local.
- 23/10/2026: tạo [PR #47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47), ghi URL PR và chuyển `Chờ review`; chờ CI GitHub trên PR head và review của Đức.

## Bổ sung sau hoàn thành: access log (23/10/2026)

Bách giao chọn giải pháp theo best practice cho giới hạn "request healthy không có access log", xử lý trong [PR #48](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/48) follow-up riêng (branch `feat/week-10/task-04-correlate-structured-logs-followup`) vì card task-05 không cho sửa instrumentation. Trạng thái `Hoàn thành` không đổi.

- `createHttpTelemetryMiddleware` ghi đúng một log cho mỗi request trong context server span: `http.server.error` (`ERROR`) cho 5xx/aborted/exception như cũ, còn lại là access log `http.server.request` (`INFO`, 4xx là `WARN`). Field bounded: `http_method`, `http_route` (template), `http_status_code`, `duration_ms`; không có user ID hay payload.
- Bỏ qua `/health` để probe Docker không làm nhiễu log; 5xx của `/health` vẫn ghi lỗi. Tám runtime đọc `HTTP_ACCESS_LOG_ENABLED` (mặc định `true`, Compose truyền qua env file) để tắt access log khi cần giảm volume.
- Logs smoke yêu cầu mọi runtime HTTP có access log `INFO` trong trace healthy, access log có `duration_ms`, status 1xx–4xx và không có `/health`.
