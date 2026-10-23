# Task tuần: Dựng dashboard và nghiệm thu observability baseline

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-dashboard-and-validate-observability` |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Chờ review |
| Người phụ trách | Bách |
| Collaborator | Đức hỗ trợ topology, telemetry và smoke test |
| Ưu tiên | Cao |
| Hạn dự kiến | 24/10/2026 — mốc bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-05-build-dashboard-and-validate-observability` |

## Yêu cầu và phạm vi

### Cần thực hiện

Provision Grafana datasource/dashboard cho service overview và tạo bộ query nghiệm thu W10 trên dữ liệu thật. Dashboard/query phải liên kết service metrics, Tempo traces và Loki logs để điều tra healthy/error/timeout; kiểm tra HTTP status, error type, dependency identity, resource identity, UTC timestamp và correlation. Chạy ít nhất một workflow HTTP xuyên service và luồng async `grade.completed`, ghi bằng chứng truy vết từ symptom tới service/dependency liên quan.

### Không thực hiện

- Không xây detector ML, feature pipeline, data contract export hoặc RCA automation của các tuần sau.
- Không coi dashboard hiển thị panel là bằng chứng nếu query trả dữ liệu mẫu/static hoặc thiếu provenance workflow.
- Không sửa substantive instrumentation của task-02 đến task-04 trong branch này; lỗi phát hiện phải trả về đúng task/branch phụ trách.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đến task-04; regression workflow W9 khi khả dụng.
- Người hoặc phần việc cần phối hợp: Đức cung cấp topology, query endpoint và hỗ trợ chạy workflow/fault; Bách chịu trách nhiệm dashboard và diagnosis validation.
- Rủi ro/giả định: Bách bắt đầu ngày 23/10/2026 sau khi task-04 vào `main`; request healthy không có access log nên dashboard chỉ nối trace lỗi và luồng Notification với log. *(Đã gỡ: access log bổ sung cho task-04 qua [PR #48](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/48) trước khi mở PR task-05.)*

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Grafana datasource/dashboard provisioned | Config | `docker-compose/observability/grafana-datasources.yaml`, `grafana-dashboards.yaml`, `dashboards/service-overview.json` |
| Query/smoke test nghiệm thu ba modality | Test / Script | `lms/test/observability/acceptance-smoke.mjs` (`test:observability:acceptance`) |
| Báo cáo bằng chứng baseline W10 | Docs | output task và tài liệu observability liên quan |

## Definition of Done

- [x] Grafana tự provision Prometheus, Tempo và Loki datasource; dashboard service overview hiển thị request rate, error rate và latency theo service/route bounded.
- [x] Từ một HTTP 5xx/timeout có thể đi từ metric panel tới trace liên quan rồi tìm structured log bằng `trace_id`, với HTTP status, error type và dependency identity nhất quán.
- [x] Luồng `grade.completed` hiển thị producer/consumer trace context và log Notification; query chứng minh correlation xuyên RabbitMQ.
- [x] Timestamp hiển thị/so sánh theo UTC ISO-8601; resource identity của mọi business service khớp catalogue canonical và không bị thay bằng container name.
- [x] Smoke/acceptance test chạy trên dữ liệu phát sinh thật, lưu query/kết quả/commit làm bằng chứng và thất bại rõ khi thiếu một modality hoặc field bắt buộc.
- [x] Dashboard/query không phụ thuộc secret, ID người dùng hoặc label high-cardinality; giới hạn MVP và tồn đọng sang W11 được ghi rõ.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-10_2026-10-04_to_2026-10-10/task-05_build-dashboard-and-validate-observability/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-10_2026-10-04_to_2026-10-10/task-05_build-dashboard-and-validate-observability/output/task-output.md).
- Pull request: [PR #49](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/49).
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 23/10/2026 — tạo [PR #49](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/49), ghi URL PR và chuyển `Chờ review`; chờ CI GitHub trên PR head và review của Đức.
- 23/10/2026: Bách xác nhận bắt đầu; tạo nhánh từ `main` tại `9a9afa2` (sau PR #47), tạo input/output và chuyển `Đang thực hiện`.
- 23/10/2026: provision dashboard service overview và liên kết trace ↔ log; `test:observability:acceptance` pass local tại `f5c2674` (đã gộp PR #48).
- Ghi chú/tồn đọng: Theo issue #45, cần thêm `tracesToLogsV2`/`derivedFields`, metric → trace dùng TraceQL vì chưa có exemplar, loại `submission-storage` và `/health` khỏi panel business service. Không dùng dashboard rỗng hoặc dữ liệu mẫu để xác nhận DoD.
