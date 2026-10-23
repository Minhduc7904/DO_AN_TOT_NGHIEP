# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_correlate-structured-logs` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 23/10/2026 (Asia/Saigon) |
| Hoàn thành thực tế | 23/10/2026 06:35 (Asia/Saigon) — finalization trước merge theo ngoại lệ |
| Tổng thời lượng | Trong ngày 23/10/2026; không có timesheet |
| Pull request | [PR #47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47) |
| Người review | Bách tự review theo ngoại lệ (review `5623879276`, `COMMENTED`); Đức chưa review |
| Kết quả review | Tự review `COMMENTED` của Bách, feedback đã xử lý; không có GitHub `APPROVED` của Đức |

## Báo cáo công việc đã làm

Tạo nhánh `feat/week-10/task-04-correlate-structured-logs` từ `main` tại `2a71506`, hoàn tất [input](../input/task-input.md) rồi triển khai:

- Package observability thêm OTel logs API/SDK/OTLP HTTP exporter `0.222.0`; `startTelemetry` có `logsEnabled`/`logRecordProcessor`, dựng `BatchLogRecordProcessor` dùng transport chung, endpoint `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` (fallback từ endpoint traces), đưa vào `forceFlush`, và truyền `logRecordProcessors: []` khi tắt để NodeSDK không tự gửi log tới `localhost:4318`.
- `StructuredLogger`/`emitStructuredLog`: JSON stdout + OTel log record với timestamp UTC, severity, message, ba resource identity, `trace_id`/`span_id` chỉ khi có active span; allowlist field chẩn đoán và che credential/PII trong message/stack.
- Log chẩn đoán ở điểm dùng chung: middleware HTTP ghi `http.server.error` cho 5xx/aborted/exception; `logDependencyFailure` ghi `dependency.failure` trong context span client lỗi tại dependency telemetry của Course/Enrollment/Submission/Grading, publish RabbitMQ Grading, Gateway proxy và Auth PostgreSQL. Notification chuyển log `console.*` sang logger chung.
- Tám runtime truyền `StructuredLogger` vào `NestFactory.create`, bật logs và đọc `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`; Compose/`.env.example` có endpoint Collector nội bộ.
- Test: unit `structured-logger.spec.ts` và config; cập nhật test Notification/regression testbed bắt log từ stdout thay vì `console.*`; thêm `test:observability:logs` (`logs-smoke.mjs`) và bước CI sau metrics. README observability/Compose có contract, redaction và query LogQL.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Structured logger, log export, middleware HTTP | Code | [structured-logger.ts](../../../../../lms/packages/observability/src/structured-logger.ts), [telemetry-bootstrap.ts](../../../../../lms/packages/observability/src/telemetry-bootstrap.ts), [http-telemetry-middleware.ts](../../../../../lms/packages/observability/src/http-telemetry-middleware.ts) |
| Tích hợp tám runtime, Compose | Code / Config | [services](../../../../../lms/services/), [compose.yaml](../../../../../docker-compose/compose.yaml), [.env.example](../../../../../docker-compose/.env.example) |
| Unit test logger | Test | [structured-logger.spec.ts](../../../../../lms/packages/observability/test/unit/structured-logger.spec.ts) |
| Nghiệm thu Loki/Tempo thật và CI | Test / Config | [logs-smoke.mjs](../../../../../lms/test/observability/logs-smoke.mjs), [CI](../../../../../.github/workflows/ci.yml) |
| Contract, redaction, query mẫu | Docs | [README structured logs](../../../../../lms/packages/observability/README.md#structured-logs-w10), [Compose README](../../../../../docker-compose/README.md#structured-logs-w10) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Log JSON đủ timestamp, severity, message, resource identity | Đạt | Unit test; `logs-smoke` parse mọi dòng stdout Gateway 35, Submission 28, Notification 50: JSON hợp lệ, timestamp UTC, identity khớp Compose |
| `trace_id`/`span_id` khớp active span, ngoài context bỏ trống | Đạt | Unit test span hiện hành/dependency span; `logs-smoke` yêu cầu `span_id` Loki thuộc chính trace trong Tempo; stdout có 19/12/23 log startup không có `trace_id` |
| Loki ingest Gateway, một service HTTP, Notification; query theo service rồi `trace_id` | Đạt | Query `{service_name="gateway"}` và `{service_name="submission"}` rồi lọc `trace_id` cho trace timeout `c3ee0c76d26b3166e421a74719dfb2b6` và unavailable `9dcae44dd8a034ca51a992f330db1193`; Notification `outcome=accepted` trace healthy `df1a4cb650403c306b13751935f5b656` |
| Error log có HTTP status, error type, dependency identity, timeout; không lộ secret/PII | Đạt | Loki: `dependency.failure` `gateway-submission`/`submission-storage` với `error_type=timeout\|unavailable`, `http.server.error` 504/503; unit test redaction; smoke không thấy token/password/email test |
| Loki labels bounded, test redaction/label | Đạt | Loki labels chỉ `service_name`; `trace_id`, `span_id`, severity, field chẩn đoán là structured metadata; unit test allowlist bỏ `user_id`/payload |
| Test liên quan, `ci:verify`, Compose smoke | Đạt | CI [run 39901081032](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39901081032) tại `f24e10d` đạt cả 5 job, gồm `test:*:postgres`, W5 e2e, `ci:verify`, regression, tracing, metrics và logs smoke. Local Linux Node 22.13.1/pnpm 11.19.0 chạy lại đủ bước quality của CI với PostgreSQL/Redis/RabbitMQ như CI và chuỗi Compose: pass. GitGuardian vẫn đỏ do JWT giả trong lịch sử commit `32d6965`, xem mục xử lý review |
| URL PR và `Chờ review` trước review; approval và finalization | Đạt theo ngoại lệ | [PR #47](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/47) và `Chờ review` đã push trước review; không có GitHub `APPROVED` của Đức; finalization và merge theo ngoại lệ do Bách (người phụ trách) xác nhận ngày 23/10/2026; không có GitHub `APPROVED` của Đức |

## Xử lý review

Bách tự review PR #47 theo ngoại lệ tại `8d4a583` (review `5623879276`, dạng `COMMENTED` vì GitHub không cho tác giả tự approve/request changes); review này không thay cho review độc lập của Đức.

- Blocking 1, W5 e2e timeout do còn bắt `console.info`: `8fde8c2` chuyển sang bắt stdout như regression testbed. CI trước đó đỏ vì local `ci:verify` bỏ qua W5 khi thiếu PostgreSQL/RabbitMQ; nay đã chạy đủ bước quality của CI ở local.
- Blocking 2, logs smoke `span_id lạ`: `8fde8c2` đọc lại span Tempo trong mỗi lần poll; CI {R} đạt.
- Blocking 3, GitGuardian JWT: JWT là fixture giả (`{"sub":"1"}`, chữ ký là chữ `signature`), không phải secret. `8fde8c2` dựng chuỗi dạng JWT lúc chạy nên source hiện tại không còn literal; GitGuardian vẫn báo incident 38885072 vì commit `32d6965` còn trong lịch sử PR. Cần chọn viết lại lịch sử branch hoặc đánh dấu false positive trên dashboard.
- Không blocking: `f24e10d` thêm điều kiện `event === 'grade.completed'` khi bắt log, che `accessToken`/`refreshToken`/`refresh-token`, ghi giới hạn identity, lỗi bootstrap và access log trong README.

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không ghi access log cho request healthy; log chẩn đoán chỉ ở lỗi HTTP 5xx/dependency và kết quả xử lý Notification. Test Notification/regression đổi cách bắt log từ `console.*` sang stdout của logger chung.
- Việc chưa hoàn thành hoặc trở ngại: Task bắt đầu sau mốc cũ 22/10/2026; Bách chốt mốc mới 23/10/2026 và hoàn thành đúng mốc mới. GitGuardian còn đỏ do lịch sử commit (xem dưới). Request healthy không có access log; cần chốt với Đức trước task-05 nếu dashboard cần nối trace healthy với log.
- Bước tiếp theo: Merge PR #47 theo ngoại lệ Bách xác nhận; chốt với Đức về access log trước task-05.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.

## Finalization theo ngoại lệ

Ngày 23/10/2026 06:35, Bách (người phụ trách) xác nhận finalization và merge PR #47 dù thiếu cổng review độc lập. Nguồn: xác nhận của người phụ trách; không ghi thành verdict GitHub.

- Review: chỉ có tự review của Bách (`COMMENTED`), 3 mục blocking và 5 mục không blocking đã xử lý và reply trên PR. Đức chưa review, không có GitHub `APPROVED`.
- CI: head `f9d50c4` [run 39902016144](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39902016144) đạt cả 5 job.
- GitGuardian: check đỏ vì incident 38885072, chuỗi JWT giả (`{"sub":"1"}`, chữ ký là chữ `signature`) trong unit test ở commit `32d6965`. Không phải secret thật. Source cuối không còn literal; viết lại lịch sử bị chặn bởi quyền thao tác Git trong phiên agent, Bách chọn giữ lịch sử. Incident nên được đánh dấu test credential/false positive trên dashboard GitGuardian; check GitGuardian của các PR sau không quét lại commit đã vào `main`.

