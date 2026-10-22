# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_export-service-metrics` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 21/10/2026 22:48 (Asia/Saigon) |
| Hoàn thành thực tế | 22/10/2026 20:23 (Asia/Saigon) — finalization trước merge |
| Tổng thời lượng | Nhiều phiên ngày 21–22/10/2026; không có timesheet, không suy diễn thời gian công từ khoảng lịch |
| Pull request | [PR #43](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/43) |
| Người review | Agent độc lập theo yêu cầu Đức; không đại diện Bách |
| Kết quả review | APPROVED nội bộ tại `c132d82`; không có GitHub APPROVED |

## Báo cáo công việc đã làm

- Bật metrics cho Auth/Gateway để đủ tám runtime; thêm endpoint và interval tùy chọn tương thích ngược.
- Áp dụng allowlist attributes, histogram duration theo giây, CPU cumulative seconds và memory RSS thực; bổ sung retry-attempt counter, giữ nguyên nghiệp vụ/API/event/database.
- Collector thu ba queue gauge thật từ RabbitMQ, chỉ queue canonical; map owner Notification và dependency `notification-rabbitmq`. Phân biệt broker backlog với outbox pending của Grading.
- Cô lập DNS của OTLP HTTP exporter bằng c-ares, giới hạn timeout/concurrency/socket, tránh chiếm libuv thread pool của kết nối PostgreSQL khi Collector mất DNS. Không thay DNS hoặc timeout nghiệp vụ.
- Bổ sung acceptance Prometheus trên project test xác nhận, bao gồm freshness/delta, cardinality, backlog tăng/drain, cold DB và Collector outage; khôi phục mọi service trong finally.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link |
| --- | --- | --- |
| Metrics, transport OTLP và unit tests | Code / Test | [Package observability](../../../../../lms/packages/observability/) |
| Cấu hình tám runtime | Code / Config | [Services](../../../../../lms/services/) |
| Broker pipeline và endpoint | Config | [Collector](../../../../../docker-compose/observability/otel-collector.yaml), [Compose](../../../../../docker-compose/compose.yaml) |
| Acceptance backend thật | Test | [metrics-smoke.mjs](../../../../../lms/test/observability/metrics-smoke.mjs) |
| Metric registry, PromQL, giới hạn vận hành | Docs | [README metrics](../../../../../lms/packages/observability/README.md#metrics-baseline-w10) |
| CI acceptance | Config | [Workflow CI](../../../../../.github/workflows/ci.yml) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Metrics tám runtime qua Collector | Đạt | Reviewer query resource identity, RED, CPU/RSS thực của đủ tám runtime; trace `8dcaf26e3188b577a10bffc72f1fce1a` |
| RED, histogram và labels hữu hạn | Đạt | 29 unit tests đạt; exact buckets/p95; 10 ID động không tăng tập series; 1.000 series qua kiểm privacy, không correlation/user/event/run/fault ID |
| Dependency/messaging và backlog thật | Đạt | Query latency/error; broker tăng ít nhất 4 message rồi drain về 0; mapping Notification/dependency đúng, không dùng outbox pending thay queue depth |
| CPU và memory | Đạt | CPU cumulative seconds và RSS lớn hơn 0 trên tám runtime; optional network/disk/lag chưa có không được giả thành 0 |
| Fresh delta và Collector outage | Đạt | Reviewer độc lập delta healthy/5xx/timeout/unavailable `16/1/1/1`; cache miss + pool idle 12 giây + Collector dừng 6 giây vẫn HTTP 200, export phục hồi |
| Tests, quality và CI | Đạt trên substantive head | [CI39784597102](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39784597102) tại `8320e98` đạt cả 5 jobs: quality/ci:verify, Compose config, fresh Compose, reset hai lần, regression/tracing/metrics. Local full build/test/lint đã đạt trước sửa DNS; sau sửa DNS build/lint/format và 29 shared tests đạt. CI finalization head phải đạt trước merge |
| URL PR và readiness trước review | Đạt | Readiness tại `16124aa`, corrective readiness tại `c132d82`; card/input/output/overview đã push vào PR head trước review |
| Review và finalization | Đạt theo ngoại lệ đã xác nhận | Agent độc lập full/focused review APPROVED nội bộ tại `c132d82`; Đức xác nhận dùng review này thay cổng approval Bách và ủy quyền điều phối viên commit/push/merge. Không có GitHub approval của Bách |

## Feedback và bằng chứng sửa lỗi

Reviewer và CI đã phát hiện HTTP 504 khi Collector dừng. Tái hiện trước sửa 2/2 với cache miss và PostgreSQL pool idle: Gateway 1261/4594 ms, direct Course khoảng 989 ms. Trong cùng Node process, `dns.resolve4(postgres)` trả ngay nhưng `dns.lookup(postgres)` chờ 5733 ms khi các lookup Collector chiếm thread pool. Đây là lỗi thật, không ghi nhận là flaky.

Bản sửa `8320e98` chỉ đổi transport exporter. Sau sửa, ba lượt cold DB đều HTTP 200 trong 30/24/23 ms, direct Course 9/6/5 ms; business timeout giữ nguyên. Unit kiểm IPv4/IPv6, literal IP, localhost, lỗi DNS và giới hạn transport. Reviewer tự chạy lại 29 tests và full acceptance trên `c132d82`, đặc biệt cold DB khi Collector dừng đạt; không còn blocker.

Các lỗi harness đã sửa: đường dẫn env dùng absolute path đã validate; baseline chờ sample mới sau warm-up, không thay missing metric bằng 0; khôi phục container dùng `up --wait` tương thích runner. Lượt CI đầu lỗi Course env default được sửa bằng giữ strict equality và thêm case cấu hình hợp lệ/không hợp lệ.

## Giới hạn và bước tiếp theo

- Histogram hiện có trong registry dùng giây; không tuyên bố đã hỗ trợ histogram unit khác.
- Broker metrics có resource của observer, map ownership về Notification; không giả identity của application process.
- DNS exporter không dùng alias chỉ tồn tại trong hosts file; hỗ trợ DNS, localhost và literal IP, ghi rõ trong README.
- Task-04 structured logs và task-05 dashboard của Bách giữ nguyên. W10 chưa hoàn thành toàn bộ; Gate M2 vẫn chưa đủ bằng chứng hai thành viên tự giải thích.
- Finalization chỉ sửa metadata trên chính PR; kiểm CI head cuối và reviewer kiểm metadata trước merge. Không ghi agent verdict thành GitHub approval.
