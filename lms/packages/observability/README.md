# OpenTelemetry bootstrap dùng chung

Package `@aiops-lms/observability` khởi tạo OpenTelemetry trước application code, gắn resource identity canonical và cung cấp HTTP middleware tạo server span với W3C Trace Context. Package chỉ chứa technical primitive; không chứa business model, fault label hoặc ground-truth field.

## Phiên bản đã pin

- OpenTelemetry API `1.9.0`.
- OpenTelemetry SDK/resource `2.11.0`.
- OpenTelemetry Node SDK và OTLP HTTP exporter `0.222.0`.

Các version trên được pin trong `package.json`; không dùng range để tránh semantic-convention thay đổi ngoài kiểm soát.

## Contract cấu hình

Caller truyền đủ `serviceName`, `serviceVersion`, `serviceInstanceId`, trạng thái bật/tắt và URL OTLP traces đầy đủ. `service.name` phải lấy từ catalogue canonical, không lấy từ hostname, tên container hoặc process.

HTTP instrumentation không capture request/response header tùy ý. Với response `5xx`, bootstrap đặt span status `ERROR` và `error.type` bằng status code; không thêm secret, PII, fault label hoặc ground-truth label.

Khi telemetry bị tắt, handle trả về là no-op. Khi bật nhưng OTLP backend chưa sẵn sàng, SDK vẫn khởi tạo và request application vẫn được phục vụ; lỗi export nằm ở diagnostic/export path và không được ném vào request path. Trace chưa export được có thể bị mất khi hết retry/buffer của SDK.

## Tracing baseline W10

Baseline dùng `AlwaysOnSampler` (100%), kể cả caller gửi sampled flag `00`, và W3C Trace Context. Caller cần truyền cùng synthetic parent nếu muốn liên kết nhiều HTTP action độc lập; ứng dụng không tự ghép các lần click/request không có chung context. Resource chỉ lấy ba field identity từ config, tắt auto-detection để không capture command-line/environment tùy ý. Tám runtime là Gateway, Auth, Course, Enrollment, Submission, Grading, Notification và Storage Mock có `service.name=submission-storage`; storage không trở thành RCA service candidate.

HTTP server span dùng route template hoặc `unmatched`, không raw path/query/header/payload. `finish` kết thúc với HTTP status thật; `close`/request `aborted` trước finish đặt `ERROR`, `error.type=client_aborted` và không giả status200. Synchronous exception được rethrow nguyên trạng cho caller nhưng span chỉ giữ exception event đã làm sạch. Một span được kết thúc tối đa một lần và listener được tháo; metric status class cho request chưa hoàn tất là `client_aborted`/`exception`, không giả5xx.

HTTP client manual span giữ `dependency_identity`, operation, method, HTTP response status khi đã nhận được và `peer.service` theo mapping topology cố định. Gateway client name là `<dependency_identity> <method>`; các wrapper còn lại dùng dependency/operation. Không ghi raw URL chứa object/course/user ID. PostgreSQL/Redis span có system/operation và dependency identity; không SQL statement/parameters. Auth PostgreSQL phân biệt timeout (`57014`/`ETIMEDOUT`) với unavailable ở span, không đổi lỗi trả business caller.

Timeout/unavailable có span `ERROR` và bounded `error.type`; HTTP4xx nghiệp vụ không tự thành lỗi dependency. RabbitMQ giữ publish producer → receive consumer → process internal cùng trace, với message/event identity theo schema và không payload. Error exception event không chứa raw message/stack. Background retry không có context gốc tạo root publish trace mới, cùng event ID để fallback correlation; không bịa parent hay khẳng định nó vẫn nối trace request cũ.

`TelemetryStartOptions.traceExporter` là hook tùy chọn cho test/exporter; nếu không truyền `spanProcessor`, bootstrap bọc exporter bằng default `BatchSpanProcessor` và `forceFlush()` chờ processor thật hoàn tất. `spanProcessor` truyền tường minh giữ ưu tiên cũ. `shutdown()` chỉ chạy một lần. Đã có test pending batch chưa export, gọi flush rồi thấy span ở exporter trước shutdown; test lifecycle gồm socket HTTP thật bị ngắt.

Nghiệm thu trên **application container thật** đã build/healthy bằng Compose, không thay bằng nhiều app trong một test process:

```bash
cd lms
pnpm run test:observability:tracing -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script xác nhận đúng project test/host ports, tạo khóa học và dữ liệu test riêng, chạy login/course/enroll/submit/grade, query Tempo theo trace ID và từng service, kiểm tra parent chain tám runtime cùng DB/Redis/storage/RabbitMQ. Nó chạy hai lỗi storage timeout/unavailable và khôi phục fault state trong `finally`; không chạy đồng thời workload/fault test khác trên cùng project. Không reset volume hoặc tự restart service. Mỗi request tối đa15 giây, mỗi poll backend tối đa90 giây. CI chạy bước này sau regression khi stack project test vẫn sẵn sàng. Output chỉ chứa trace IDs, service names và số span, không token/password/payload.
