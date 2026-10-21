# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_complete-distributed-tracing` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 21/10/2026 21:49 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa finalization |
| Tổng thời lượng | Đang thực hiện |
| Pull request | [PR #42](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/42) |
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
| Tám resource identity đúng catalogue | Đạt | Compose/Tempo healthy trace `73b80b27503a0e89fd7024408ab6a7ec`,51spans8runtime; đối chiếu name/version/instance với cấu hình thực; shared unit chặn identity sai/rỗng |
| HTTP parent-child và không span trùng | Đạt | Healthy trace có51spanIDs duy nhất; từng parent có mặt, mỗi HTTP client có đúng1server child và peer.service đúng |
| Async producer-consumer-process giữ trace | Đạt | Healthy trace có Grading producer→Notification consumer→process với parentSpanID đúng; initial CI regression+tracing pass |
| DB/Redis/storage và lỗi không lộ dữ liệu | Đạt | Đủ9dependency; timeout trace `0b127efee1d64934304b34438a6b1f04` HTTP504/error.timeout; unavailable trace `839de74132dfae453e6bdacd6c7721a9` HTTP503/error.unavailable; privacy toàn trace và AuthDB3tests pass |
| HTTP lifecycle/default flush/AlwaysOn | Đạt | Shared unit 16/16 pass, có actual HTTP socket disconnect và batch chưa export → forceFlush → exported trước shutdown |
| Test/quality/Compose CI | Chờ CI cuối | Build/lint, shared16/AuthDB3/W1rerun7/W5direct4 và telemetry local pass;16container healthy, actual tracing smoke pass. Initial CI39622002633 có4jobs pass, quality fail do W5 assertion rawname; correction3021177 sửa lookup dependency/method và giữ parent check. [CI correction](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39625137332) phải đạt trước merge; full local pnpmtest đang cuối rerun |
| URL/readiness trước review | Đạt | Card/input/output/overview có PR42 và Chờreview, push trước agent review |
| Review/finalization | Chưa đạt | Đợi agent reviewer và điều phối viên theo ngoại lệ Đức, không GitHub approval Bách |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay span name Gateway client từ raw method/path thành dependency/method để tránh ID động/PII; cập nhật assertion tương ứng và test không có raw identifiers.
- Chưa triển khai metrics task-03, structured logs hoặc dashboard task-04/05.
- Background retry thiếu context gốc tạo trace mới, giữ event ID cho fallback; không bịa parent/correlation.
- Chưa finalization/merge. Quy trình áp dụng [vòng đời canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical), review nội bộ theo ngoại lệ người phụ trách; không giả GitHub approval của Bách.

Local W1 có lượt504 tại timeout100ms khi Dockerbuild nặngCPU; rerun nguyên test không sửa timeout đạt7/7. Format baseline34fileCRLF ngoài diff giữ nguyên, fullquality dựa clean-checkoutCI. Chưa finalization/merge.


## Sửa lỗi teardown CI ngày21/10/2026

CI correction tìm thấy shared lifecycle test có16assertion pass nhưng afterAll SDKshutdown timeout5giây trênLinux. Đã tái hiện trong container Node22.13.1-alpine sạch. Nguyên nhân: NodeSDK0.222 tạo OTLP metric reader mặc định khi caller bỏ metricReader, dù bootstrap intendedmetricsEnabled=false; middleware ghi metrics khiến shutdown flush ngầm tới endpoint unavailable. Sửa truyền `metricReaders: []` khi không bậtmetrics, hoặc danh sách reader đã chỉ định khi có. Không tăng test timeout hoặc bỏ shutdown. Test mới ghi counter và cấu hình HTTP endpoint mock thật, xác nhận shutdown không gửi request khimetricsdisabled. Linux17tests pass3lượt liên tiếp (0.7–1.7giây), không workerforcedexit; test socket dùng agent:false, track/destroy connections và xác nhận socketsetrỗng. Phỏng đoán ban đầu về log exporter bị loại sau kiểm chứng, không thêm sửa logs ngoài phạm vi.

Fullpnpmtestlocal rerun vẫn có W1 timeout100ms transient (6/7), không claimfullsuitepass; standaloneW1 trước đó7/7 và telemetrysuite riêngpass. CIhead cuối vẫn là cổng trước merge.
