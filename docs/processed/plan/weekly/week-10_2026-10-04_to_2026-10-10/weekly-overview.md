# Tổng quan tuần 10 — Hoàn thiện observability stack

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Nguồn plan canonical | [Plan v0.2 — Tuần 10](../../plan-v0.2-24-weeks.md#tuần-10--hoàn-thiện-observability-stack) |
| Mục tiêu tuần | Hoàn thiện stack OTel Collector, Prometheus, Tempo, Loki và Grafana; bảo đảm trace, metrics và structured logs có correlation, resource identity đúng và truy vấn được cho anomaly/RCA. |
| Trạng thái tuần | Đang thực hiện |

> Kế hoạch W10 được cụ thể hóa hồi tố ngày 13/10/2026 để bù tiến độ sau W9. Mốc tuần canonical vẫn là 04/10/2026–10/10/2026; hạn task bên dưới là mốc bù tiến độ và không thay đổi phạm vi milestone.

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_deploy-observability-stack](task-01_deploy-observability-stack.md) | Dựng OTel Collector, Prometheus, Tempo, Loki và Grafana trong Compose | Đức | Bách góp ý nhu cầu query/retention | Cao | Hoàn thành |
| [task-02_complete-distributed-tracing](task-02_complete-distributed-tracing.md) | Hoàn thiện distributed tracing và resource identity toàn topology | Đức | Bách kiểm tra field phục vụ diagnosis | Cao | Hoàn thành |
| [task-03_export-service-metrics](task-03_export-service-metrics.md) | Xuất service metrics và thêm kiểm chứng metrics baseline | Đức | Bách kiểm tra khả năng query cho anomaly | Cao | Hoàn thành |
| [task-04_correlate-structured-logs](task-04_correlate-structured-logs.md) | Chuẩn hóa structured logs, correlation và Loki ingestion | Bách | Đức hỗ trợ Collector/Compose và trace context | Cao | Chờ xử lý |
| [task-05_build-dashboard-and-validate-observability](task-05_build-dashboard-and-validate-observability.md) | Dựng dashboard và nghiệm thu baseline observability W10 | Bách | Đức hỗ trợ topology, telemetry và smoke test | Cao | Chờ xử lý |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: task-01 cung cấp backend và đường export cho task-02, task-03 và task-04; task-05 chỉ nghiệm thu sau khi task-02, task-03 và task-04 có dữ liệu thật. W9 task-04/task-05 đã hoàn tất theo hồ sơ canonical; Gate M2 vẫn Chờ xử lý do thiếu bằng chứng Bách tự giải thích, không dùng đóng task thay xác nhận gate.
- Rủi ro: Bách hiện chưa tham gia nên task-04 và task-05 đang `Chờ xử lý`; thiếu structured logs/Loki/dashboard khiến W10 chưa thể đạt đủ bàn giao canonical dù phần Platform hoàn thành. Instrumentation database/cache có thể tăng scope nếu triển khai tự động không tương thích với wrapper hiện tại; ưu tiên span hữu ích và kiểm chứng được thay vì coverage hình thức.
- Quyết định cần chốt: Đức phụ trách ba task Platform theo vai trò A; Bách phụ trách structured logs và dashboard/query validation theo vai trò B. Không đưa `trace_id`, `span_id`, user ID, request ID hoặc `run_id` vào Prometheus labels. Baseline controlled run dùng 100% trace sampling.

## Thứ tự thực hiện đề xuất

1. Thực hiện task-01 để có Collector và các backend quan sát chạy ổn định trong Compose.
2. Sau task-01, triển khai task-02 và task-03 song song trên cùng contract resource/export nhưng bằng hai branch riêng.
3. Task-04 có thể bắt đầu sau task-01 và dùng trace context từ task-02 để chuẩn hóa correlation.
4. Thực hiện task-05 sau khi ba modality có dữ liệu thật; dùng ít nhất một workflow HTTP xuyên service và luồng async `grade.completed` để nghiệm thu.

## Tiêu chí kết thúc tuần

- [x] OTel Collector, Prometheus, Tempo, Loki và Grafana chạy bằng Compose, có healthcheck/config pin version và tài liệu vận hành.
- [x] Một request có trace xuyên Gateway và các service liên quan; trace context tiếp tục qua RabbitMQ tới Notification.
- [x] Inbound/outbound HTTP, PostgreSQL, Redis, storage và RabbitMQ có span/error semantics đủ phục vụ dependency graph và RCA.
- [x] Service metrics truy vấn được theo label bounded; không dùng correlation/user/run ID làm label.
- [ ] Structured logs dùng timestamp UTC ISO-8601, có `service.name`, severity, message và `trace_id`/`span_id` khi có active span; Loki truy vấn được theo trace.
- [ ] Grafana có service overview và query kiểm chứng error status, HTTP status, error type, dependency identity và timeout semantics.
- [ ] Mỗi task có PR riêng, bằng chứng DoD và trạng thái theo vòng đời task canonical.

## Tiến độ task-01 ngày 21/10/2026

[PR #41](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/41) có stack 16 thành phần, reset hai lần cùng fingerprint và smoke/query ba backend. [Output Đức](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-01_deploy-observability-stack/output/task-output.md) ghi bằng chứng, giới hạn Windows và ngoại lệ review agent độc lập Đức đã xác nhận. Readiness đã push tại `9c4a422`; reviewer agent độc lập APPROVED nội bộ và điều phối viên finalization trước merge theo ngoại lệ Đức xác nhận. Task-01 đã hoàn tất trên main. Task-02 đã triển khai như phần tiến độ dưới đây; task-03 được cập nhật ở phần tiến độ dưới, task-04/05 giữ nguyên.

## Tiến độ task-02 ngày 21/10/2026

[PR #42](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/42) có trace thật 51 span qua 8 runtime cùng timeout/unavailable; [output Đức](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-02_complete-distributed-tracing/output/task-output.md) ghi bằng chứng và CI 39626518883 đạt cả 5 job. URL + `Chờ review` đã push trước agent review; full/focused APPROVED nội bộ, finalization trước merge theo ngoại lệ Đức xác nhận. Task-03 được cập nhật ở phần tiến độ dưới, task-04/05 giữ nguyên.

Task-02 PR #42: finalization sau agent review độc lập APPROVED nội bộ tại `b7182a4`, CI 39626518883 đạt 5 job; ngoại lệ Đức xác nhận không có GitHub approval Bách. Task-03 được cập nhật ở phần tiến độ dưới, task-04/05 giữ nguyên Chờ xử lý; W10 chưa hoàn thành.

## Tiến độ task-03 ngày 22/10/2026

[PR #43](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/43) hoàn tất metrics tám runtime, CPU/RSS, histogram/cardinality, backlog và Collector outage sau sửa DNS exporter. Reviewer agent độc lập APPROVED nội bộ tại `c132d82`, CI 39784597102 đạt cả 5 job. [Output Đức](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-03_export-service-metrics/output/task-output.md) đối chiếu từng DoD và nguồn ngoại lệ.

Finalization được ghi trước merge; kiểm reviewer/CI head cuối trước merge. Sau PR #43 vào main, ba task Đức hoàn thành; task-04/05 của Bách giữ nguyên Chờ xử lý và trạng thái tuần vẫn Đang thực hiện. Gate M2 không được tự xác nhận đạt.

## Hậu kiểm task-01..03 theo issue #45 ngày 23/10/2026

[Issue #45](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45) là review độc lập chỉ đọc của task-01..03 trên `main` tại `3e7dedf`: không có blocker cho task-04, có 1 blocker cho task-05. Theo yêu cầu của Bách, các tồn đọng được xử lý trong một PR follow-up riêng (branch `fix/week-10/task-03-export-service-metrics-followup`), không sửa trong branch task-04/05:

- Blocker task-05: series broker RabbitMQ không còn gán `service_version`/`service_instance_id` giả cho Notification; metrics smoke kiểm resource identity của mọi series có `service_name` business service.
- Shutdown runtime chờ `app.close()` xong rồi mới `telemetry.shutdown()`; Compose bắt buộc `GRAFANA_ADMIN_PASSWORD` từ env file thay vì fallback trong `compose.yaml`.
- Hồ sơ task-01..03 ghi bổ sung trích dẫn CI head cuối, giải trình GitGuardian, trễ hạn, đối chiếu review task-02 và việc chưa có xác nhận đóng góp collaborator của Bách; sửa text mất khoảng trắng.

Trạng thái `Hoàn thành` của task-01..03 không đổi; task-04/05 vẫn `Chờ xử lý` cho tới khi Bách bắt đầu theo card.
