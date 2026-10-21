# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_export-service-metrics` |
| Tên task | Xuất metrics toàn topology và kiểm chứng Prometheus |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 21/10/2026 (Asia/Saigon) |
| Thời gian dự kiến | Phiên triển khai/kiểm chứng bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-03-export-service-metrics` |
| Pull request dự kiến | PR riêng vào `main`, bổ sung URL sau khi tạo |

## Mục tiêu và phạm vi

### Task cần làm gì?

Bật metrics Auth/Gateway và giữ toàn bộ tám runtime gửi qua Collector; bổ sung metrics endpoint tùy chọn tương thích ngược, interval5giây baseline, histogram seconds buckets `[.005,.01,.025,.05,.1,.25,.5,1,2.5,5,10]`, label allowlist và process CPU/memory. Collector scrape RabbitMQ plugin có sẵn chỉ queue Notification canonical, không nhầm với Grading outbox pending. Kiểm chứng Prometheus thật, delta healthy/5xx/timeout/unavailable, backlog tăng/drain và exporter lỗi không hỏng request nghiệp vụ.

### Phạm vi không thực hiện

Không đổi business API/event/database; không dashboard/structured application logs task-04/05, không feature normalization W11. Không dùng ID correlation/user/event/run/fault hoặc raw URL làm metric label. Không giả signal unavailable thành0.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Shared metrics và config tám runtime | Code | `lms/packages/observability/`, `lms/services/` |
| Broker scrape/pipeline | Config | `docker-compose/observability/`, Compose/env |
| Unit/cardinality và actual Prometheus acceptance | Test | `lms/packages/observability/test/`, `lms/test/observability/` |
| Registry/query/operating limits và CI acceptance | Docs / Config | README observability/Compose và CI |

## Đầu vào và phụ thuộc

- Task-01/02 đã vào `main`; [card canonical](../../../../../docs/processed/plan/weekly/week-10_2026-10-04_to_2026-10-10/task-03_export-service-metrics.md), telemetry schema và catalogue hiện hành.
- Đức xác nhận implement agent/review agent độc lập, điều phối viên finalization/merge; ghi ngoại lệ thiếu GitHub approval Bách trung thực theo [quy tắc Git](../../../../../docs/processed/rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).
- Chỉ test mutation trên project test xác nhận; mọi stop/fault phải restore trong finally. Broker management image đã bật plugin Prometheus, chưa cần thêm image khác.

## Definition of Done

- [ ] Prometheus query được metrics tám service identity qua Collector.
- [ ] RED dùng method/route/status bounded và histogram buckets đúng; exported datapoint tests chặn ID/high-cardinality/fault truth.
- [ ] Dependency/messaging có latency/error/publish/consume/process/outbox và broker backlog thật, giới hạn retry/lag ghi rõ.
- [ ] Process CPU cumulative seconds và memory RSS thật có dữ liệu; không fake network/disk optional signals.
- [ ] Actual Prometheus acceptance dùng baseline/delta chứng minh healthy/5xx/timeout/unavailable, queue backlog tăng/drain, cardinality động và Collector down không phá request.
- [ ] Unit/quality/Compose/regression/tracing/metrics CI phù hợp đạt, mọi failure/giới hạn ghi trung thực.
- [ ] PR URL+Chờreview push trước review; root finalization/merge sau verdict độc lập theo ngoại lệ đã xác nhận.
