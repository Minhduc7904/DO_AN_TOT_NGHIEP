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
