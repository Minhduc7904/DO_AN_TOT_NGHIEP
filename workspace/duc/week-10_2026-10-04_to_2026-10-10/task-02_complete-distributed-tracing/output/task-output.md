# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_complete-distributed-tracing` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 21/10/2026 21:49 (Asia/Saigon) |
| Hoàn thành thực tế | 21/10/2026 22:39 (Asia/Saigon), finalization trước merge |
| Tổng thời lượng | Khoảng 50 phút lịch gồm kiểm chứng, chờ CI và xử lý lỗi; không phải timesheet |
| Pull request | [PR #42](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/42) |
| Người review | Agent review độc lập theo yêu cầu Đức, không đại diện Bách |
| Kết quả review | APPROVED nội bộ: full review `3f71b11`, focused review `b7182a4`; không có GitHub APPROVED |

## Báo cáo công việc đã làm

Hoàn thiện lifecycle HTTP server span cho finish/close/abort/exception; tháo listener và kết thúc đúng một lần, không giả HTTP status. Default batch processor nay được flush thật trước shutdown. Giữ AlwaysOn/W3C, tắt auto resource detection tránh capture command-line/environment tùy ý. Chuẩn hóa HTTP peer/method/status, database/cache system/operation; loại raw URL và exception message/stack nhạy cảm. Không đổi API/event/database schema.

Tracing smoke trên Compose/Tempo thật và CI step tận dụng stack regression đã đạt; evidence đối chiếu bên dưới.

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
| HTTP lifecycle/default flush/AlwaysOn | Đạt | Shared unit 17/17 pass, có actual HTTP socket disconnect và batch chưa export → forceFlush → exported trước shutdown |
| Test/quality/Compose CI | Đạt trên clean Linux CI | [Run39626518883](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39626518883) tại `b7182a4` đạt cả5jobs, gồm ci:verify, full regression+actualTempo smoke, reset2x và freshCompose. Local fullsuite vẫn có W1 100ms timeout; không ghi localfullsuitepass |
| URL/readiness trước review | Đạt | Card/input/output/overview có PR42 và Chờreview, push trước agent review |
| Review/finalization | Đạt theo ngoại lệ | Agent độc lập full/focused review APPROVED nội bộ; Đức xác nhận dùng nguồn này thay GitHub approval Bách và ủy quyền điều phối viên finalization/merge |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay span name Gateway client từ raw method/path thành dependency/method để tránh ID động/PII; cập nhật assertion tương ứng và test không có raw identifiers.
- Chưa triển khai metrics task-03, structured logs hoặc dashboard task-04/05.
- Background retry thiếu context gốc tạo trace mới, giữ event ID cho fallback; không bịa parent/correlation.
- Finalization trên chính branch PR trước merge; CI head cuối phải đạt trước merge. Quy trình áp dụng [vòng đời canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical), review nội bộ theo ngoại lệ người phụ trách; không giả GitHub approval của Bách.

Local W1 có lượt504 tại timeout100ms khi Dockerbuild nặngCPU; rerun nguyên test không sửa timeout đạt7/7. Format baseline34fileCRLF ngoài diff giữ nguyên, fullquality dựa clean-checkoutCI đã đạt. Finalization metadata đã ghi trước merge.


## Sửa lỗi teardown CI ngày21/10/2026

CI correction tìm thấy shared lifecycle test có16assertion pass nhưng afterAll SDKshutdown timeout5giây trênLinux. Đã tái hiện trong container Node22.13.1-alpine sạch. Nguyên nhân: NodeSDK0.222 tạo OTLP metric reader mặc định khi caller bỏ metricReader, dù bootstrap intendedmetricsEnabled=false; middleware ghi metrics khiến shutdown flush ngầm tới endpoint unavailable. Sửa truyền `metricReaders: []` khi không bậtmetrics, hoặc danh sách reader đã chỉ định khi có. Không tăng test timeout hoặc bỏ shutdown. Test mới ghi counter và cấu hình HTTP endpoint mock thật, xác nhận shutdown không gửi request khimetricsdisabled. Linux17tests pass3lượt liên tiếp (0.7–1.7giây), không workerforcedexit; test socket dùng agent:false, track/destroy connections và xác nhận socketsetrỗng. Phỏng đoán ban đầu về log exporter bị loại sau kiểm chứng, không thêm sửa logs ngoài phạm vi.

Fullpnpmtestlocal rerun vẫn có W1 timeout100ms transient (6/7), không claimfullsuitepass; standaloneW1 trước đó7/7 và telemetrysuite riêngpass. CIhead cuối vẫn là cổng trước merge; CI sửa lỗi đã đạt tại run39626518883.

## Review và finalization trước merge

Reviewer độc lập kiểm chứng 51spans8runtime trace `3b20a3aa35ed67deb5d4501831310d08`, timeout `acb932f105b2a10a7a1a65c65a432051`, unavailable `0a2d1d7c4e2baf9396b6fce2ef83c0a8`, parent/dependency/privacy; shared16/Auth3 đạt. Sau fix exporter, reviewer tự chạy17/17 đạt và focused APPROVED nội bộ tại `b7182a4`. Không có GitHub approval Bách; nguồn thay thế là review agent độc lập và xác nhận trực tiếp của Đức trong yêu cầu triển khai W10. Finalization chỉ thay lifecycle metadata.
