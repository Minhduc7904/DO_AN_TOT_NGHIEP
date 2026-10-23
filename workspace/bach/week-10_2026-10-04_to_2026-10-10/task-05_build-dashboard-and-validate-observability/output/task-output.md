# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-dashboard-and-validate-observability` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 23/10/2026 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa ghi nhận |
| Pull request | [PR #49](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/49) |
| Người review | Chưa có |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Đã tạo nhánh `feat/week-10/task-05-build-dashboard-and-validate-observability` từ `main` tại `9a9afa2` (sau PR #47) và hoàn tất [input](../input/task-input.md). Giới hạn "request healthy không có access log" của task-04 được gỡ trong [PR #48](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/48), branch follow-up riêng của task-04, theo đúng phạm vi card (không sửa instrumentation trong branch này). Sau khi PR #48 vào `main` (`77d9edc`), branch task-05 gộp `main` tại `f5c2674`.

- **Liên kết trace ↔ log:** datasource Tempo có `tracesToLogsV2` mở log Loki theo `{service_name="<service.name>"} | trace_id="<trace>"`, khoảng thời gian span ±5 phút. Dùng label filter vì `trace_id` là structured metadata, line filter mặc định không tìm được. Datasource Loki có derived field `trace_id` (`matcherType: label`) mở trace trong Tempo. Biến Grafana phải viết `$${...}` vì provisioning tự thay `${...}` bằng biến môi trường; lỗi này phát hiện khi kiểm trên Grafana 13.2.4 thật.
- **Dashboard:** provider file (`allowUiUpdates: false`, thêm dashboard bằng file JSON mới) và dashboard `aiops-lms-service-overview`, timezone UTC:
  - RED theo service: request rate, error ratio (5xx + `client_aborted`), latency p95.
  - RED theo route: request rate theo route/status class, latency p95 theo route.
  - Dependency lỗi theo `dependency_identity`/`status`, dependency latency p95, backlog RabbitMQ (ready/unacked) và outbox Grading.
  - Trace lỗi gần đây (TraceQL), log `ERROR`/`FATAL`, log volume theo severity.
  - Biến `service` không gồm `submission-storage`; mọi panel HTTP bỏ `/health`. Panel RED/dependency có data link mở TraceQL cùng service/route.
- **Acceptance smoke** `test:observability:acceptance` gọi Grafana bằng credential trong env file, chạy query qua `/api/ds/query` để kiểm đúng cấu hình đã provision. Bước CI chạy sau logs smoke.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Datasource liên kết trace ↔ log | Config | `docker-compose/observability/grafana-datasources.yaml` |
| Dashboard provider và dashboard service overview | Config | `docker-compose/observability/grafana-dashboards.yaml`, `docker-compose/observability/dashboards/service-overview.json`, mount trong `docker-compose/compose.yaml` |
| Acceptance smoke ba modality | Test / Script | `lms/test/observability/acceptance-smoke.mjs`, script `test:observability:acceptance`, bước CI trong `.github/workflows/ci.yml` |
| Tài liệu điều tra và nghiệm thu | Docs | `docker-compose/README.md` mục "Dashboard và nghiệm thu W10" |

## Bằng chứng nghiệm thu

Local Linux, Node 22.13.1, pnpm 11.19.0, stack Compose sạch project `aiops-lms-test-regression`, commit `f5c26740d570a72ace2d4b35b9d603fc69b03146`, chạy xong 23/10/2026 08:01:12 UTC:

- `pnpm install --frozen-lockfile`, `pnpm run ci:verify`, `test:regression` (5/5), `test:observability:tracing`, `metrics`, `logs` pass.
- `test:observability:acceptance` pass:
  - Mọi query panel chạy qua Grafana đều có dữ liệu từ workflow vừa chạy: Request rate 72 điểm, Error ratio 24, Latency p95 72, theo route 216/168, Dependency lỗi 64, Dependency latency 204, Broker backlog 3×12, Trace lỗi 2 hàng, Log lỗi 16 dòng, Log volume 115 điểm.
  - Timeout, trace `b7f1cf2e53bf4072b12b5beda07e0084`: Error ratio Gateway tối đa 0,33; Dependency lỗi có `submission-storage` `timeout`; TraceQL `{ resource.service.name = "gateway" && kind = server && status = error }` trả đúng trace; LogQL `{service_name="submission"} | trace_id="b7f1cf2e53bf4072b12b5beda07e0084"` trả `http.server.error` 504 và `dependency.failure` `submission-storage` `timeout`, `span_id` khớp server/client span, log lúc `2026-10-23T08:00:35.373Z` nằm trong span.
  - Unavailable, trace `4de1a540e893a693ee88c956d09c541d`: Error ratio Gateway 1; 503, `error_type=unavailable`; log lúc `2026-10-23T08:00:40.428Z`.
  - `grade.completed`, trace `4669677ca8a0185221092a47217f2a82`: producer `grading/lms.events publish` → consumer `notification/rabbitmq consume grade.completed` (consumer là con trực tiếp của producer); LogQL `{service_name="notification"} | trace_id="4669677ca8a0185221092a47217f2a82"` trả `outcome=accepted` trong span phía consumer, lúc `2026-10-23T08:00:01.826Z`; Gateway có access log trong trace.
  - Resource identity trong Tempo, Loki và Prometheus khớp `OTEL_SERVICE_VERSION=0.1.0` và `OTEL_SERVICE_INSTANCE_ID=<service>-compose-1` của Compose, khác container name `aiops-lms-test-regression-<service>-1`.
- CI GitHub trên PR head: chờ chạy.

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Grafana provision ba datasource; dashboard RED theo service/route bounded | Đạt | Datasource health OK; dashboard `provisioned=true`; 13 query panel có dữ liệu |
| HTTP 5xx/timeout: metric → trace → log theo `trace_id`, field nhất quán | Đạt | Trace `b7f1cf2e…` (504/timeout) và `4de1a540…` (503/unavailable) |
| `grade.completed`: producer/consumer trace context và log Notification | Đạt | Trace `4669677c…`, consumer con của producer, log `accepted` trong span consumer |
| UTC ISO-8601; resource identity khớp catalogue | Đạt | Dashboard timezone `utc`; thời điểm log so với span theo epoch UTC; identity ba backend khớp Compose |
| Smoke/acceptance trên dữ liệu thật, thất bại rõ khi thiếu modality/field | Đạt | Script fail khi panel rỗng, thiếu trace/log/field hoặc lệch span; JSON bằng chứng gồm commit, query, trace ID |
| Không phụ thuộc secret/user ID/label high-cardinality; ghi giới hạn MVP và tồn đọng W11 | Đạt | Script chặn query dùng `user_id`/`email`/`event_id`...; route là template; giới hạn ghi bên dưới |
| URL PR và `Chờ review` trước review; approval và finalization | Đang thực hiện | PR #49 đã tạo, chờ review của Đức |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Access log cho request healthy được bổ sung trong PR #48 (follow-up task-04) thay vì ghi là giới hạn MVP. Dashboard nằm ở `docker-compose/observability/` cạnh datasource hiện có, không tạo thư mục `grafana/` riêng.
- Giới hạn MVP:
  - Metric chưa có exemplar, nên metric → trace đi bằng TraceQL lọc service/route/thời gian, không nhảy thẳng tới một trace.
  - "Logs for this span" trong Tempo chỉ hiện log của service chứa span; xem log toàn trace bằng `{service_name=~".+"} | trace_id="..."`.
  - Dashboard chưa có alert rule, SLO hay panel theo instance; một node, retention 24 giờ như task-01.
- Tồn đọng sang W11: feature pipeline/detector dùng các query này (log volume theo severity, error ratio, dependency lỗi), thêm exemplar khi SDK metrics hỗ trợ, alert rule.
- Bước tiếp theo: Chờ CI GitHub trên PR #49 và review của Đức.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
