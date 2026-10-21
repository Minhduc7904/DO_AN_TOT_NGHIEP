# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_complete-distributed-tracing` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 21/10/2026 21:49 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa finalization |
| Tổng thời lượng | Đang thực hiện |
| Pull request | Bổ sung sau khi tạo |
| Người review | Agent review độc lập theo yêu cầu Đức, không đại diện Bách |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Hoàn thiện lifecycle HTTP server span cho finish/close/abort/exception; tháo listener và kết thúc đúng một lần, không giả HTTP status. Default batch processor nay được flush thật trước shutdown. Giữ AlwaysOn/W3C, tắt auto resource detection tránh capture command-line/environment tùy ý. Chuẩn hóa HTTP peer/method/status, database/cache system/operation; loại raw URL và exception message/stack nhạy cảm. Không đổi API/event/database schema.

Thêm tracing smoke trên Compose/Tempo thật và CI step tận dụng stack regression đã sẵn sàng; chưa kết luận đạt trước khi các kiểm chứng này hoàn tất.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Shared tracing và tests lifecycle/flush | Code / Test | [observability](../../../../../lms/packages/observability/) |
| Adapter HTTP/DB/cache/messaging | Code | [services](../../../../../lms/services/) |
| Actual Compose/Tempo tracing smoke | Test | [tracing-smoke.mjs](../../../../../lms/test/observability/tracing-smoke.mjs) |
| CI và semantics | Config / Docs | [CI](../../../../../.github/workflows/ci.yml), [README](../../../../../lms/packages/observability/README.md#tracing-baseline-w10) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Tám resource identity đúng catalogue | Đang kiểm chứng | Smoke kiểm tra đúng ba identity từ runtime/Compose, không dùng resource test giả thay container |
| HTTP parent-child và không span trùng | Đang kiểm chứng | Smoke kiểm tra từng parent và mỗi HTTP client có đúng một server child |
| Async producer-consumer-process giữ trace | Đang kiểm chứng | Smoke yêu cầu parent chain thực trên Tempo |
| DB/Redis/storage và lỗi không lộ dữ liệu | Đang kiểm chứng | Instrumentation và smoke có kiểm tra dependency/error/privacy |
| HTTP lifecycle/default flush/AlwaysOn | Đạt | Shared unit 13/13 pass, có actual HTTP socket disconnect và batch chưa export → forceFlush → exported trước shutdown |
| Test/quality/Compose CI | Đang kiểm chứng | Build/lint local pass; full tests và Compose build đang chạy, chưa ghi là đạt |
| URL/readiness/review/finalization | Chưa đạt | Chưa chuyển Chờ review; chờ test và review agent độc lập theo ngoại lệ Đức đã xác nhận |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay span name Gateway client từ raw method/path thành dependency/method để tránh ID động/PII; cập nhật assertion tương ứng và test không có raw identifiers.
- Chưa triển khai metrics task-03, structured logs hoặc dashboard task-04/05.
- Background retry thiếu context gốc tạo trace mới, giữ event ID cho fallback; không bịa parent/correlation.
- Chưa finalization/merge. Quy trình áp dụng [vòng đời canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical), review nội bộ theo ngoại lệ người phụ trách; không giả GitHub approval của Bách.
