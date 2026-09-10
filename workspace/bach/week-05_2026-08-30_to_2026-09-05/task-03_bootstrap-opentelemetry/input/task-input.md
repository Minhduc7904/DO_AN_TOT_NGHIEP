# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_bootstrap-opentelemetry` |
| Tên task | Tích hợp OpenTelemetry bootstrap và resource identity |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Chờ review |
| Ngày tạo | 10/09/2026 |
| Thời gian dự kiến | 10/09/2026, theo chỉ thị thực hiện task của Bách |
| Nhánh thực hiện | `feat/week-05/task-03-bootstrap-opentelemetry` |
| Pull request | [PR #17](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/17) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo shared OpenTelemetry bootstrap cho ứng dụng NestJS, tích hợp vào service `course` trước khi khởi tạo application và kiểm chứng tự động resource identity, HTTP trace context cùng error telemetry tối thiểu theo schema v0. Bootstrap phải cấu hình được trạng thái bật/tắt và OTLP endpoint, đồng thời không làm service crash khi backend telemetry chưa sẵn sàng.

### Phạm vi không thực hiện

- Không dựng Collector, Prometheus, Tempo, Loki hoặc Grafana đầy đủ.
- Không triển khai feature extraction, anomaly detection, RCA hoặc ground-truth pipeline.
- Không đưa fault label, business secret hoặc PII vào telemetry.
- Không đưa business model hoặc business library dùng chung vào package observability.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Shared OpenTelemetry bootstrap | Code | `lms/packages/observability/` |
| Tích hợp bootstrap vào service mẫu | Code | `lms/services/course/` |
| Telemetry assertion tự động | Code/Test | `lms/packages/observability/` hoặc `lms/services/course/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 đã hoàn thành; telemetry và ground-truth schema v0; service catalogue/topology v1; backend blueprint.
- Người cần phối hợp: Đức kiểm tra bootstrap khởi tạo trước application, exporter cấu hình được và service vẫn chạy trong Compose.
- Rủi ro hoặc giả định: version OpenTelemetry và semantic convention phải được pin; test không phụ thuộc backend observability bên ngoài.

## Definition of Done

- [x] Bootstrap gán đúng `service.name=course`, `service.version` và `service.instance.id` theo cấu hình; không dùng container/process name thay identity canonical.
- [x] Request tới `/health` sinh HTTP server span tối thiểu và giữ W3C trace context khi caller gửi context hợp lệ.
- [x] Một error path được kiểm tra có span status/error attributes phù hợp, không chứa secret, PII hoặc ground-truth label.
- [x] Bootstrap có thể bật/tắt hoặc đổi OTLP endpoint qua cấu hình; service không crash khi telemetry backend chưa sẵn sàng theo behavior đã tài liệu hóa.
- [x] Telemetry assertion tự động hoặc test exporter chứng minh các resource/span field trọng yếu, không chỉ dựa vào quan sát thủ công.
- [x] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [x] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
