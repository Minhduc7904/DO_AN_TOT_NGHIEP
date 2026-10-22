# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_export-service-metrics` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 21/10/2026 22:48 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa finalization |
| Tổng thời lượng | Đang thực hiện |
| Pull request | [PR #43](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/43) |
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
| Tám resource metrics qua Collector | Đạt | ActualPrometheus acceptance PASS cả8resource name/version/instance, trace `c8dd1743344a14a1328a39edad65f81d` |
| RED/cardinality/buckets/denyIDs | Đạt | Shared29tests PASS; actual1000series khôngID/PII/faulttruth;10dynamicIDs khôngtăngseries; exact11buckets/p95 của8runtime pass |
| Dependency/messaging/backlog/limits | Đạt | Actual dependency/messaging latency queries pass; stopconsumer publish4validfixtureevents, queue>=4; startconsumer currentqueue0; observerownership Notification/dependency đúng, không nhầm outbox |
| CPU/RSS thực | Đạt | QueryCPU/RSS>0 thực ở8runtime, unitguards pass; khôngfake0/network/disk signals |
| ActualPrometheus deltas/outage | Đạt sau sửa lỗi review | Freshdeltas healthy16/serverErrors1/timeout1/unavailable1; Collectorstop6giây→businesscourse request200→start/exportrecovered. Baselinewarmup tránh countercũ sau apprestart, timestamp samplefresh được kiểm |
| Test/quality/CI | Chờ CIhead cuối | Local fullbuild→fullpnpmtest/lint pass,21sharedtests pass,16componentshealthy. InitialCIquality fail Courseenvstrictdefaults do thêm interval5000; correctiona690fd1 giữtoEqual+thêm envcoercion/invalidtests. Nestedtracingenvpath lỗi đã sửa dùngabsoluteoptionsenv; chờCIhead cuối trướcmerge |
| URL/readiness trước review | Đạt | Card/input/output/overview cóPR43+Chờreview vàpush trướcreview |
| Review/finalization | Chưa đạt | Đợi agentreview độc lập/root theo ngoại lệ Đức xác nhận, khôngGitHubapproval Bách |

## Thay đổi, tồn đọng và bước tiếp theo

- Histogram hiện có đều unitseconds; histogramunit khác chưa thuộc registry này. Optionalruntime/network/disk/lag signals chưa có phải ghi unavailable, không giả0.
- Broker gauges resource là observerRabbitMQ mappedownership Notification; không giả applicationprocess identity. Outboxpending khác queuedepth.
- Không triển khai structuredlogger/dashboard của Bách; task04/05 giữ nguyên.
- Chưa finalization/merge. Review/finalization theo [quy tắc canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical) và ngoại lệ Đức xác nhận; không giả GitHub approval Bách.

Acceptance phát hiện lỗi testharness counters cũ sau restart (before1/after1) vàfail đúng; đã thêmwarmup+12giây cho pipeline5+1+5s cùngsampletimestamp mới trướcbaseline, sau đó freshdelta>0. Không dùng or0 hoặc nớiđiềukiện. Fullmetricsacceptance runtime chỉdừng projecttestxácnhận, cảNotification/Collector đãrestorefinally.

Review độc lập và CI tại head f2d00d7 phát hiện Collector outage gây HTTP504 dù các bước metrics trước đó đạt. Ngày22/10 đã tái hiện2/2 khi cachemiss và PGpool idle: Gateway1261/4594ms, directCourse~989ms, DEPENDENCY_TIMEOUT. Diagnostic trong cùng Nodeprocess: dns.resolve4(postgres)0ms nhưng dns.lookup(postgres)5733ms khi4lookup Collector mấtDNS chiếm libuvpool. Sửa chỉ transport telemetry sang c-ares và giới hạn request/socket/timeout; không tăng business timeout. Smoke bổ sung cachemiss+idle12giây, errorcode/elapsed; Kết quả rerun được cập nhật ở dưới; vẫn chờ review độc lập và CI head cuối.

Readiness sửa review22/10: substantive8320e98, shared29tests/build/lint và format các file đổi PASS. LinuxDocker coldDB3/3 PASS sau cacheDEL+idle12giây+Collectorstop6giây: Gateway200 trong30/24/23ms, directCourse200 trong9/6/5ms; trướcfix2/2fail504. Fullmetrics acceptance PASS exit0 trên chính script nâng điều kiện: trace8d12dd733191d7c08562af85dcc0b87c, deltas healthy16/serverErrors2/timeout1/unavailable1,8runtime RED/CPU/RSS/buckets/p95, dependency/messaging latency,10dynamicIDs stable, broker>=4→0, coldDB businessGET200 khiCollectorstop và exportrecovered,1008series qua denylabels. Cả16component đãrestorehealthy. CI39784597102 của8320e98: quality/freshCompose/reset2x/config PASS, regression đang chạy tại lúc ghi; kết quả head cuối do root đối chiếu trướcmerge. Trạng thái tiếp tục Chờ review cho reviewer kiểm tập trung16124aa..8320e98 và evidence này, chưa finalization.
