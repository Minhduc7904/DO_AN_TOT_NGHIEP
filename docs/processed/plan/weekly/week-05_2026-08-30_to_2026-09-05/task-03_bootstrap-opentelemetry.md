# Task tuần: Tích hợp OpenTelemetry bootstrap và resource identity

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_bootstrap-opentelemetry` |
| Tuần | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Đức tích hợp bootstrap vào service mẫu và kiểm tra khả năng export khi chạy cục bộ |
| Ưu tiên | Cao |
| Hạn dự kiến | 03/09/2026 |
| Nhánh thực hiện | `feat/week-05/task-03-bootstrap-opentelemetry` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo shared OpenTelemetry bootstrap cho ứng dụng NestJS và tích hợp vào service mẫu. Chuẩn hóa resource identity, HTTP trace context và error attributes tối thiểu theo telemetry schema v0; cung cấp cách kiểm tra bootstrap hoạt động mà chưa cần dựng toàn bộ observability stack.

### Không thực hiện

- Không dựng Collector, Prometheus, Tempo, Loki hoặc Grafana đầy đủ trong task này.
- Không triển khai feature extraction, anomaly detection, RCA hoặc ground-truth pipeline.
- Không đưa fault label hay business secret/PII vào telemetry.
- Không tạo business library dùng chung trong `lms/packages/observability/`.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01, telemetry và ground-truth schema v0, service catalogue/topology v1 và backend blueprint.
- Người hoặc phần việc cần phối hợp: Đức kiểm tra bootstrap khởi tạo trước application, biến môi trường exporter có thể cấu hình và service vẫn chạy được trong Compose.
- Rủi ro/giả định: version OpenTelemetry và semantic convention cần được pin; test không được phụ thuộc vào backend observability bên ngoài không ổn định.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Shared OpenTelemetry bootstrap | Code | `lms/packages/observability/` |
| Tích hợp và telemetry assertion cho service mẫu | Code | `lms/services/course/` |

## Definition of Done

- [x] Bootstrap gán đúng `service.name=course`, `service.version` và `service.instance.id` theo cấu hình; không dùng container/process name thay identity canonical.
- [x] Request tới `/health` sinh HTTP server span tối thiểu và giữ W3C trace context khi caller gửi context hợp lệ.
- [x] Một error path được kiểm tra có span status/error attributes phù hợp, không chứa secret, PII hoặc ground-truth label.
- [x] Bootstrap có thể bật/tắt hoặc đổi OTLP endpoint qua cấu hình; service không crash khi telemetry backend chưa sẵn sàng theo behavior đã tài liệu hóa.
- [x] Telemetry assertion tự động hoặc test exporter chứng minh các resource/span field trọng yếu, không chỉ dựa vào quan sát thủ công.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-05_2026-08-30_to_2026-09-05/task-03_bootstrap-opentelemetry/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-05_2026-08-30_to_2026-09-05/task-03_bootstrap-opentelemetry/output/task-output.md).
- Pull request: [#17](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/17).
- Kết quả review: Approval ngoài GitHub theo xác nhận trực tiếp của Bách ngày 10/09/2026: Đức xác nhận đã approve sau khi review; GitHub không có verdict `APPROVED` trên head `ba9bc4f`.

> Finalization này dùng ngoại lệ theo xác nhận trực tiếp của Bách: GitHub không có verdict `APPROVED` trên head `ba9bc4f`, nhưng Bách xác nhận Đức đã approval sau review. Trạng thái `Hoàn thành` mới sẵn sàng merge trên branch/PR; chỉ canonically hoàn thành khi commit này vào nhánh canonical. Xem [quy tắc ưu tiên chỉ thị trực tiếp](../../../rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — Bách xử lý finding `http.route`, push commit `ba9bc4f` và finalization Task 3 theo approval ngoài GitHub do Bách xác nhận.
- Ghi chú/tồn đọng: PR #17 đã sẵn sàng để Bách merge theo ngoại lệ đã xác nhận; chưa merge nên chưa canonically hoàn thành trên `main`.
