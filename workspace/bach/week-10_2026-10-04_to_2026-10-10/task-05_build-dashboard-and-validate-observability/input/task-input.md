# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-dashboard-and-validate-observability` |
| Tên task | Dựng dashboard và nghiệm thu baseline observability W10 |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Chờ review |
| Ngày tạo | 23/10/2026 (Asia/Saigon) |
| Thời gian dự kiến | 23/10/2026–24/10/2026 (hạn trên card 24/10/2026) |
| Nhánh thực hiện | `feat/week-10/task-05-build-dashboard-and-validate-observability` |
| Pull request dự kiến | [PR #49](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/49) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Provision Grafana dashboard service overview và bộ query nghiệm thu W10 trên dữ liệu thật, liên kết metrics (Prometheus), traces (Tempo) và structured logs (Loki) để điều tra healthy/error/timeout. Chạy ít nhất một workflow HTTP xuyên service và luồng async `grade.completed`, ghi bằng chứng truy vết từ symptom tới service/dependency liên quan.

Hiện trạng trên `main` tại `9a9afa2` (sau PR #46 và PR #47):

- Grafana 13.2.4 đã provision ba datasource Prometheus/Tempo/Loki (`docker-compose/observability/grafana-datasources.yaml`), chưa có dashboard và chưa cấu hình liên kết trace ↔ log (`tracesToLogsV2`, `derivedFields`).
- Metrics: RED theo `service_name`/`http_route_template`/`http_status_class`, dependency latency/error theo `dependency_identity`, CPU/RSS, broker backlog; series broker RabbitMQ không có `service_version`/`service_instance_id` (PR #46). Metric chưa có exemplar (SDK metrics 2.11 chưa gắn), nên metric → trace đi bằng TraceQL theo service/route/status/thời gian.
- Logs (task-04): Loki chỉ index `service_name`; `trace_id`, `span_id`, `severity_text`, `error_type`, `dependency_identity`, `http_status_code`, `event`, `outcome` là structured metadata. Chỉ có log khi lỗi HTTP 5xx/dependency và kết quả xử lý Notification; request healthy không có access log.
- Smoke hiện có: `test:observability:stack`, `tracing`, `metrics`, `logs`.

Hướng triển khai dự kiến:

1. Thêm `tracesToLogsV2` (Tempo → Loki theo `trace_id`) và `derivedFields`/liên kết Loki → Tempo trong datasource provisioning; provision dashboard service overview từ file JSON.
2. Dashboard: request rate, error rate, p95 latency theo service/route bounded; dependency error theo `dependency_identity`/`status`; broker backlog; panel log lỗi Loki. Loại `submission-storage` và route `/health` khỏi panel business service.
3. Acceptance smoke chạy workflow thật (HTTP lỗi timeout/unavailable và `grade.completed`), đi từ metric → TraceQL → Loki theo `trace_id`, kiểm HTTP status/error type/dependency identity nhất quán, UTC timestamp và resource identity khớp catalogue; thất bại rõ khi thiếu modality hoặc field.

### Phạm vi không thực hiện

- Không xây detector ML, feature pipeline, data contract export hoặc RCA automation của các tuần sau.
- Không coi panel hiển thị là bằng chứng nếu query trả dữ liệu mẫu/static hoặc thiếu provenance workflow.
- Không sửa substantive instrumentation của task-02 đến task-04 trong branch này; lỗi phát hiện phải trả về đúng task/branch phụ trách.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Grafana datasource liên kết trace ↔ log và dashboard provisioned | Config | `docker-compose/observability/` (datasource, dashboard provider, dashboard JSON) |
| Acceptance smoke ba modality | Test / Script | `lms/test/observability/` |
| Báo cáo bằng chứng baseline W10 và giới hạn MVP | Docs | Output task, `lms/packages/observability/README.md`, `docker-compose/README.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 đến task-04 đã hoàn thành trên `main` (task-04 qua [PR #47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47)); blocker identity broker của [issue #45](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45) đã sửa ở PR #46. [Card canonical](../../../../../docs/processed/plan/weekly/week-10_2026-10-04_to_2026-10-10/task-05_build-dashboard-and-validate-observability.md), telemetry schema và catalogue runtime hiện hành.
- Người cần phối hợp: Đức hỗ trợ topology, query endpoint và chạy workflow/fault. Cần chốt với Đức việc request healthy không có access log (giới hạn ghi ở README task-04): dashboard chỉ nối được trace lỗi và luồng Notification với log.
- Rủi ro hoặc giả định: Grafana 13 có thể đổi schema provisioning dashboard/datasource so với tài liệu cũ, cần kiểm trên đúng version pin. Không có exemplar nên liên kết metric → trace dựa trên TraceQL theo thời gian/service. Mọi kiểm chứng phá hủy chỉ chạy trên project test cô lập.

## Definition of Done

- [ ] Grafana tự provision Prometheus, Tempo và Loki datasource; dashboard service overview hiển thị request rate, error rate và latency theo service/route bounded.
- [ ] Từ một HTTP 5xx/timeout có thể đi từ metric panel tới trace liên quan rồi tìm structured log bằng `trace_id`, với HTTP status, error type và dependency identity nhất quán.
- [ ] Luồng `grade.completed` hiển thị producer/consumer trace context và log Notification; query chứng minh correlation xuyên RabbitMQ.
- [ ] Timestamp hiển thị/so sánh theo UTC ISO-8601; resource identity của mọi business service khớp catalogue canonical và không bị thay bằng container name.
- [ ] Smoke/acceptance test chạy trên dữ liệu phát sinh thật, lưu query/kết quả/commit làm bằng chứng và thất bại rõ khi thiếu một modality hoặc field bắt buộc.
- [ ] Dashboard/query không phụ thuộc secret, ID người dùng hoặc label high-cardinality; giới hạn MVP và tồn đọng sang W11 được ghi rõ.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
