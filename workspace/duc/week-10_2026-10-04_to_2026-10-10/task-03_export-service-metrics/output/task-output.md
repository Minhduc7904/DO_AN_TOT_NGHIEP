# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_export-service-metrics` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 21/10/2026 22:48 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa finalization |
| Tổng thời lượng | Đang thực hiện |
| Pull request | Bổ sung sau khi tạo |
| Người review | Agent review độc lập theo ngoại lệ Đức xác nhận, không đại diện Bách |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Bật metrics Auth/Gateway để đủ8runtime. Thêm endpoint/interval tùy chọn tương thích ngược; views allowlist attributes, histogramseconds buckets, process CPU/RSS thực và retryattempt counter của Grading worker. Collector scrape pluginRabbitMQ có sẵn, chỉ3depthgauges/queuecanonical và enrich ownership Notification, bỏ queue/vhostlabels. Không đổi controlflow nghiệp vụ, database/API/event.

Thêm actual Prometheus acceptance và CI reuse stack regression: kiểm freshdeltas healthy/5xx/timeout/unavailable,8resources/CPU/RSS/buckets/p95, dynamicroutecardinality, backlog4events tăng/drain và Collector outage businessrequest/recovery. Chưa coi kiểm chứng đang chạy là đạt.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| SDK metrics/config/tám runtime | Code | [observability](../../../../../lms/packages/observability/), [services](../../../../../lms/services/) |
| Broker pipeline và env | Config | [Collector](../../../../../docker-compose/observability/otel-collector.yaml), [Compose](../../../../../docker-compose/compose.yaml) |
| Actual Prometheus acceptance | Test | [metrics-smoke.mjs](../../../../../lms/test/observability/metrics-smoke.mjs) |
| Registry/query/CI | Docs / Config | [README](../../../../../lms/packages/observability/README.md#metrics-baseline-w10), [CI](../../../../../.github/workflows/ci.yml) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Tám resource metrics qua Collector | Đang kiểm chứng | Instrumentation/config sẵn; actualPrometheus acceptance đang chạy |
| RED/cardinality/buckets/denyIDs | Đạt unit, chờ integration | Shared20tests pass trước bổ sung proxy-prefix test; exported datapoint guard chặn ID/faulttruth/rawURL, routeIDcollapse, exactbucket và CPU/RSSpositive |
| Dependency/messaging/backlog/limits | Đang kiểm chứng | Broker receiver khởi động healthy; query thật có `rabbitmq_detailed_queue_messages`, service_name Notification/dependency đúng; chờ peak/drain |
| CPU/RSS thực | Đạt unit, chờ integration | process.cpuUsage cumulative user+systemseconds và memoryUsage.rss, không fake0 |
| ActualPrometheus deltas/outage | Đang kiểm chứng | Chưa kết luận pass trước khi script hoàn tất |
| Test/quality/CI | Đang kiểm chứng | Build local pass sau sửa optionalendpoint type; Dockerbuild/CI chưa hoàn tất |
| PR/readiness/review/finalization | Chưa đạt | Chưa Chờreview; đợi test, review agent và điều phối viên |

## Thay đổi, tồn đọng và bước tiếp theo

- Histogram hiện có đều unitseconds; histogramunit khác chưa thuộc registry này. Optionalruntime/network/disk/lag signals chưa có phải ghi unavailable, không giả0.
- Broker gauges resource là observerRabbitMQ mappedownership Notification; không giả applicationprocess identity. Outboxpending khác queuedepth.
- Không triển khai structuredlogger/dashboard của Bách; task04/05 giữ nguyên.
- Chưa finalization/merge. Review/finalization theo [quy tắc canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và ngoại lệ Đức xác nhận; không giả GitHub approval Bách.
