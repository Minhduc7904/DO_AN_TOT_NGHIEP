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
| Tám resource identity đúng catalogue | Đạt | Compose/Tempo healthy trace `73b80b27503a0e89fd7024408ab6a7ec`, 51 span qua 8 runtime; đối chiếu name/version/instance với cấu hình thực; shared unit chặn identity sai/rỗng |
| HTTP parent-child và không span trùng | Đạt | Healthy trace có 51 span ID duy nhất; từng parent có mặt, mỗi HTTP client có đúng 1 server child và peer.service đúng |
| Async producer-consumer-process giữ trace | Đạt | Healthy trace có Grading producer→Notification consumer→process với parent span ID đúng; initial CI regression + tracing pass |
| DB/Redis/storage và lỗi không lộ dữ liệu | Đạt | Đủ 9 dependency; timeout trace `0b127efee1d64934304b34438a6b1f04` HTTP 504/`error.type=timeout`; unavailable trace `839de74132dfae453e6bdacd6c7721a9` HTTP 503/`error.type=unavailable`; privacy toàn trace và 3 test Auth DB pass |
| HTTP lifecycle/default flush/AlwaysOn | Đạt | Shared unit 17/17 pass, có actual HTTP socket disconnect và batch chưa export → forceFlush → exported trước shutdown |
| Test/quality/Compose CI | Đạt trên clean Linux CI | [Run 39626518883](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39626518883) tại `b7182a4` đạt cả 5 job, gồm `ci:verify`, full regression + smoke Tempo thật, reset 2 lần và fresh Compose; head cuối `10209da` đạt [run 39627853914](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39627853914). Local full suite vẫn có W1 timeout 100 ms; không ghi local full suite pass |
| URL/readiness trước review | Đạt | Card/input/output/overview có PR #42 và `Chờ review`, push trước agent review |
| Review/finalization | Đạt theo ngoại lệ | Agent độc lập full/focused review APPROVED nội bộ; Đức xác nhận dùng nguồn này thay GitHub approval Bách và ủy quyền điều phối viên finalization/merge |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay span name Gateway client từ raw method/path thành dependency/method để tránh ID động/PII; cập nhật assertion tương ứng và test không có raw identifiers.
- Chưa triển khai metrics task-03, structured logs hoặc dashboard task-04/05.
- Background retry thiếu context gốc tạo trace mới, giữ event ID cho fallback; không bịa parent/correlation.
- Finalization trên chính branch PR trước merge; CI head cuối phải đạt trước merge. Quy trình áp dụng [vòng đời canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical), review nội bộ theo ngoại lệ người phụ trách; không giả GitHub approval của Bách.

Local W1 có lượt 504 tại timeout 100 ms khi Docker build nặng CPU; rerun nguyên test không sửa timeout đạt 7/7. Format baseline 34 file CRLF ngoài diff giữ nguyên, full quality dựa trên CI clean checkout đã đạt. Finalization metadata đã ghi trước merge.

## Sửa lỗi teardown CI ngày 21/10/2026

CI correction tìm thấy shared lifecycle test có 16 assertion pass nhưng `afterAll` SDK shutdown timeout 5 giây trên Linux. Đã tái hiện trong container Node 22.13.1-alpine sạch. Nguyên nhân: NodeSDK 0.222 tạo OTLP metric reader mặc định khi caller bỏ `metricReader`, dù bootstrap dự định `metricsEnabled=false`; middleware ghi metrics khiến shutdown flush ngầm tới endpoint unavailable. Sửa truyền `metricReaders: []` khi không bật metrics, hoặc danh sách reader đã chỉ định khi có. Không tăng test timeout hoặc bỏ shutdown. Test mới ghi counter và cấu hình HTTP endpoint mock thật, xác nhận shutdown không gửi request khi metrics disabled. Linux 17 test pass 3 lượt liên tiếp (0.7–1.7 giây), không có worker forced exit; test socket dùng `agent: false`, track/destroy connections và xác nhận socket set rỗng. Phỏng đoán ban đầu về log exporter bị loại sau kiểm chứng, không thêm sửa logs ngoài phạm vi.

Full `pnpm test` local rerun vẫn có W1 timeout 100 ms transient (6/7), không claim full suite pass; standalone W1 trước đó 7/7 và telemetry suite riêng pass. CI head cuối vẫn là cổng trước merge; CI sửa lỗi đã đạt tại run 39626518883.

## Review và finalization trước merge

Reviewer độc lập kiểm chứng trace 51 span qua 8 runtime `3b20a3aa35ed67deb5d4501831310d08`, timeout `acb932f105b2a10a7a1a65c65a432051`, unavailable `0a2d1d7c4e2baf9396b6fce2ef83c0a8`, parent/dependency/privacy; shared 16 và Auth 3 test đạt. Sau fix exporter, reviewer tự chạy 17/17 đạt và focused APPROVED nội bộ tại `b7182a4`. Không có GitHub approval Bách; nguồn thay thế là review agent độc lập và xác nhận trực tiếp của Đức trong yêu cầu triển khai W10. Finalization chỉ thay lifecycle metadata.

## Hậu kiểm theo issue #45 ngày 23/10/2026

Bổ sung theo [issue #45](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/issues/45) (review độc lập sau merge) và yêu cầu của Bách, xử lý trong [PR #46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46); trạng thái `Hoàn thành` không đổi.

- **Đối chiếu review:** card ghi focused review tại `b7182a4`, mô tả PR #42 ghi "metadata cuối `10209da`". Hai nguồn không mâu thuẫn về verdict: agent focused review APPROVED nội bộ tại `b7182a4`; `e11cd1f` và `10209da` là commit finalization chỉ sửa card/overview/input/output sau approval, không có bằng chứng reviewer kiểm lại hai commit này. CI head cuối `10209da` đạt [run 39627853914](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39627853914) cả 5 job. Mô tả PR #42 đã được sửa theo cách diễn đạt này.
- **Shutdown:** `main.ts` của tám runtime trước đây chạy `app.close()` và `telemetry.shutdown()` song song, span/log phát ra lúc đóng app có thể mất. PR follow-up đổi sang chờ `app.close()` xong rồi mới `telemetry.shutdown()`, kể cả khi đóng app lỗi.
- **Trễ hạn:** hạn dự kiến 20/10/2026 (mốc bù tiến độ), hoàn thành 21/10/2026, trễ 1 ngày.
- **Collaborator:** card giao Bách kiểm tra field phục vụ diagnosis; task-02 hoàn thành khi chưa có xác nhận của Bách. Bách sẽ xác nhận trong task-04/05.
