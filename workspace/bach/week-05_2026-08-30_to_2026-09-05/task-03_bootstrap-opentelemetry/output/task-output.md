# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_bootstrap-opentelemetry` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 10/09/2026 12:38 (UTC+7) — tạo nhánh task và khởi tạo metadata |
| Hoàn thành thực tế | 10/09/2026 17:22 (UTC+7) — Bách finalization theo approval ngoài GitHub do Bách xác nhận |
| Tổng thời lượng | Khoảng 4 giờ 44 phút theo thời gian lịch, gồm implementation, self-verification, xử lý review và thời gian chờ review |
| Pull request | [PR #17](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/17) |
| Người review | Đức (`Minhduc7904`) |
| Kết quả review | Approval ngoài GitHub theo xác nhận trực tiếp của Bách: Đức xác nhận đã approve sau khi review; GitHub không có verdict `APPROVED` trên head `ba9bc4f` |

## Báo cáo công việc đã làm

- Đã tạo và push metadata `Đang thực hiện` trên nhánh riêng trước khi sửa code.
- Đã tạo package `@aiops-lms/observability`, pin OpenTelemetry API `1.9.0`, SDK/resource `2.11.0` và Node SDK/OTLP exporter `0.222.0`.
- Đã chuẩn hóa resource identity, cấu hình bật/tắt, OTLP endpoint và HTTP middleware giữ W3C `traceparent`/`tracestate`.
- Đã tách OpenTelemetry bootstrap chạy trước dynamic import NestJS application, bổ sung shutdown lifecycle và tích hợp package vào Docker runtime.
- Đã bổ sung telemetry assertion dùng in-memory exporter cho `/health` và error path `5xx`, gồm kiểm tra không capture secret, PII hoặc fault/ground-truth label.
- Đã xử lý finding review: HTTP server span lấy route template sau khi Express/Nest match route, emit `http.route=/health` và đổi span name theo template thay vì dùng raw path làm route.
- Đã verify frozen install, test, format, lint, build, Docker image và Compose stack khi chưa có Collector.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Khác | [`input/task-input.md`](../input/task-input.md) |
| Shared OpenTelemetry bootstrap | Code | [`lms/packages/observability/`](../../../../../lms/packages/observability/) |
| Tích hợp Course bootstrap và cấu hình | Code | [`lms/services/course/`](../../../../../lms/services/course/) |
| Telemetry assertion tự động | Test | [`http.telemetry-test.mjs`](../../../../../lms/services/course/test/telemetry/http.telemetry-test.mjs) |
| Docker/Compose telemetry config | Code/Config | [`compose.yaml`](../../../../../docker-compose/compose.yaml) |
| Pull request | Khác | [PR #17](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/17) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Resource identity dùng `service.name=course`, version và instance ID theo cấu hình. | Đạt | `telemetry-resource.spec.ts`, `http.telemetry-test.mjs`; assertion kiểm tra đủ ba resource attributes. |
| `/health` sinh HTTP server span và giữ W3C trace context hợp lệ. | Đạt | `pnpm test:telemetry` kiểm tra trace ID, parent span ID, `tracestate` và `http.route=/health` từ caller. |
| Error path có status/attribute phù hợp và không chứa dữ liệu cấm. | Đạt | Telemetry assertion kiểm tra `SpanStatusCode.ERROR`, `error.type=500`, status code và quét secret/PII/fault/ground-truth value. |
| Có thể bật/tắt hoặc đổi endpoint; service không crash khi backend vắng mặt. | Đạt | Unit test no-op khi disabled; env schema test endpoint tùy chỉnh; local runtime và Compose vẫn trả `/health` 200 với OTLP endpoint không tồn tại. |
| Có telemetry assertion tự động cho field trọng yếu. | Đạt | `pnpm test` và `pnpm test:e2e` đều chạy assertion in-memory exporter thành công. |
| Sản phẩm đã được commit/push và truy cập được. | Đạt | Commit substantive `c66b5fa` đã có trên PR #17. |
| URL PR và `Chờ review` nằm trên PR head trước review. | Đạt sau commit metadata này | PR #17 đã mở; card, input, output và weekly overview được cập nhật đồng bộ trước khi gửi review request. |
| PR có mô tả đúng template, GitHub `APPROVED` và completion metadata trước merge. | Đạt theo ngoại lệ | PR #17 dùng đủ heading bắt buộc và completion metadata này được push trước merge. GitHub không có `APPROVED` trên head `ba9bc4f`; Bách xác nhận trực tiếp ngày 10/09/2026 rằng Đức đã approval sau review, nên dùng làm bằng chứng thay thế theo quy tắc ngoại lệ. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: HTTP server span dùng shared middleware dựa trên OpenTelemetry API để bảo đảm W3C propagation, route template ổn định và attribute nhất quán, không phụ thuộc auto-instrumentation patch order.
- Việc chưa hoàn thành hoặc trở ngại: GitHub chỉ ghi `APPROVED` ở commit cũ; finalization này dùng approval ngoài GitHub theo xác nhận trực tiếp của Bách, không trình bày như verdict GitHub.
- Bước tiếp theo: Bách merge PR #17 theo ngoại lệ đã xác nhận. Sau merge, đồng bộ branch Task 4 với `main` trước fresh setup và review Task 4.

> `Hoàn thành thực tế` ở trên là finalization trước merge theo ngoại lệ được Bách xác nhận. PR #17 hiện sẵn sàng để Bách merge, nhưng task chỉ canonically hoàn thành khi commit này vào `main`.
