# Task tuần: Chuẩn hóa structured logs và correlation

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_correlate-structured-logs` |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Chờ xử lý |
| Người phụ trách | Bách |
| Collaborator | Đức hỗ trợ Collector/Compose và trace context |
| Ưu tiên | Cao |
| Hạn dự kiến | 22/10/2026 — mốc bù tiến độ, phụ thuộc người phụ trách quay lại |
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
- Rủi ro/giả định: Bách hiện chưa tham gia nên task đang `Chờ xử lý`; log rời rạc từ Nest logger/console cần adapter thống nhất nhưng không được làm mất startup/error diagnostics.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Structured logger/correlation integration | Code | `lms/packages/observability/`, `lms/services/` |
| Collector/Loki log pipeline và query mẫu | Config / Docs | `docker-compose/observability/`, README liên quan |
| Test schema, redaction và trace correlation | Test | `lms/test/`, test telemetry của service |

## Definition of Done

- [ ] Log application là JSON hợp lệ với timestamp UTC ISO-8601, severity, message và ba resource identity field canonical.
- [ ] Log trong request/consumer context có `trace_id` và `span_id` khớp active span; log ngoài context ghi thiếu có chủ đích thay vì tạo ID giả.
- [ ] Loki ingest log của ít nhất Gateway, một service HTTP và Notification; query theo `service.name` rồi lọc `trace_id` trả đúng workflow.
- [ ] Error log biểu diễn HTTP status, error type, dependency identity và timeout semantics khi áp dụng; không log token, password, payload nhạy cảm hoặc PII.
- [ ] Loki labels chỉ dùng tập bounded; test/redaction check ngăn correlation/user/event/run ID thành label hoặc dữ liệu nhạy cảm bị ghi.
- [ ] Test liên quan, `pnpm run ci:verify` và Compose smoke pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 13/10/2026 — lập task bù tiến độ W10.
- Ghi chú/tồn đọng: Chờ Bách tiếp tục công việc; chưa tạo hồ sơ trong `workspace/bach/` và không chuyển `Đang thực hiện` khi chưa có xác nhận của Bách.
