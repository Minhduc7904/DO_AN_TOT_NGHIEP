# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_deploy-observability-stack` |
| Tên task | Dựng observability stack trong Compose |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Hoàn thành |
| Ngày tạo | 21/10/2026 |
| Thời gian dự kiến | Một phiên triển khai và kiểm chứng, thực hiện bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-01-deploy-observability-stack` |
| Pull request dự kiến | [PR #41](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/41) vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Bổ sung Collector Contrib 0.163.1, Prometheus 3.15.0, Tempo 3.1.0, Loki 3.7.9 và Grafana 13.2.4 vào Compose mặc định. Cấu hình OTLP HTTP/gRPC, ba pipeline, ba datasource, volume và retention MVP 24 giờ; kiểm chứng dữ liệu đi qua Collector tới backend thật. Dùng executable probe HTTP trong image dẫn xuất khi image gốc không có công cụ healthcheck.

### Phạm vi không thực hiện

Không hoàn thiện tracing/metrics service của task-02/03; không làm structured logger/dashboard của Bách (task-04/05). Không thay database schema/seed, không dựng production HA/TLS/SSO.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Compose và cấu hình backend/probe | Config / Code | `docker-compose/compose.yaml`, `docker-compose/observability/` |
| Smoke ingest/query ba modality | Test | `lms/test/observability/` |
| Hướng dẫn vận hành | Docs | `docker-compose/README.md`, `docker-compose/.env.example` |

## Đầu vào và phụ thuộc

- Card canonical: [task-01](../../../../../docs/processed/plan/weekly/week-10_2026-10-04_to_2026-10-10/task-01_deploy-observability-stack.md); Compose/OTel baseline và schema telemetry hiện có.
- Đức đã xác nhận dùng agent implement và agent review độc lập, điều phối viên commit/push/merge. Review agent là bằng chứng review nội bộ, không phải GitHub `APPROVED` của Bách; ghi ngoại lệ theo [quy tắc Git](../../../../../docs/processed/rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).
- Reset xóa mọi volume của project được xác nhận, kể cả telemetry. Chỉ kiểm chứng reset trong project `aiops-lms-test-*` cô lập, không tác động project phát triển.

## Definition of Done

- [x] Compose hợp lệ; toàn bộ 16 thành phần healthy với image pin version.
- [x] 8 runtime gửi OTLP tới Collector nội bộ; Collector có receiver HTTP/gRPC và pipeline traces/metrics/logs.
- [x] Smoke gửi telemetry mẫu qua Collector và query được marker tương ứng tại Prometheus, Tempo và Loki.
- [x] Cấu hình không có credential production; port loopback, volume, retention/resource limit và cách tắt/reset được tài liệu hóa.
- [x] `ci:verify`, Compose smoke, regression W9 và reset hai lần có fingerprint ổn định đạt; mọi giới hạn được ghi trung thực.
- [x] PR dùng template canonical; URL và `Chờ review` được commit/push trước review.
- [x] Điều phối viên finalization/merge sau review nội bộ độc lập theo ngoại lệ Đức xác nhận, không giả GitHub approval.
