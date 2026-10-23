# Task tuần: Hoàn thiện distributed tracing toàn topology

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_complete-distributed-tracing` |
| Tuần | `week-10_2026-10-04_to_2026-10-10` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Đức |
| Collaborator | Bách kiểm tra field phục vụ diagnosis |
| Ưu tiên | Cao |
| Hạn dự kiến | 20/10/2026 — mốc bù tiến độ |
| Nhánh thực hiện | `feat/week-10/task-02-complete-distributed-tracing` |

## Yêu cầu và phạm vi

### Cần thực hiện

Hoàn thiện tracing trên sáu business service, Gateway và storage mock để workflow đồng bộ/async tạo trace liên tục. Kiểm tra và bổ sung span cho inbound/outbound HTTP, PostgreSQL, Redis, storage và RabbitMQ; chuẩn hóa `service.name`, `service.version`, `service.instance.id`, dependency identity, status/error/timeout semantics và W3C Trace Context. Baseline controlled run phải dùng 100% sampling và có test/query chứng minh trace context qua `grade.completed` tới Notification.

### Không thực hiện

- Không dựng backend observability; thuộc task-01.
- Không triển khai metrics dashboard hoặc structured-log pipeline; thuộc task-03 đến task-05.
- Không capture payload, authorization header, credential, PII, fault label hoặc ground-truth label vào span.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01; tracing primitive hiện có trong `@aiops-lms/observability`; HTTP/event contract và telemetry schema canonical.
- Người hoặc phần việc cần phối hợp: Bách xác nhận field tối thiểu dùng cho diagnosis; Đức giữ quyết định instrumentation kỹ thuật.
- Rủi ro/giả định: auto-instrumentation có thể không bao phủ wrapper/custom client; bổ sung manual span có kiểm soát và tránh tạo span trùng.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Instrumentation/config tracing đầy đủ | Code / Config | `lms/packages/observability/`, `lms/services/` |
| Test trace xuyên HTTP, dependency và RabbitMQ | Test | `lms/test/`, test telemetry của service |
| Tài liệu span/resource/error semantics | Docs | README observability hoặc tài liệu architecture liên quan |

## Definition of Done

- [x] Mọi service runtime phát resource có `service.name`, `service.version`, `service.instance.id` đúng catalogue; test chặn identity thiếu hoặc sai.
- [x] Workflow `login → course → enroll → submit` cho thấy parent/child trace liên tục qua Gateway và outbound HTTP; span dependency có identity/operation/status hữu ích.
- [x] Workflow `submit → grade → grade.completed → notification` giữ cùng trace context qua RabbitMQ; producer/consumer/process span có event/dependency identity bounded.
- [x] PostgreSQL, Redis và storage có span hoặc manual instrumentation kiểm chứng được; timeout/unavailable đặt status/error semantics đúng contract mà không lộ dữ liệu nhạy cảm.
- [x] Baseline controlled run dùng `AlwaysOn`/100% sampling; test/query Tempo chứng minh trace có thể tìm theo trace ID và service.
- [x] Test liên quan, `pnpm run ci:verify` và Compose smoke pass; không tạo duplicate span ngoài chủ đích.
- [x] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-02_complete-distributed-tracing/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-10_2026-10-04_to_2026-10-10/task-02_complete-distributed-tracing/output/task-output.md).
- Pull request: [#42](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/42).
- Kết quả review: APPROVED nội bộ bởi agent độc lập (full `3f71b11`, focused `b7182a4`); không có GitHub APPROVED của Bách, finalization theo ngoại lệ Đức xác nhận.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/10/2026 — push readiness PR #42; evidence Compose/Tempo trong output.
- Ghi chú/tồn đọng: Bắt đầu sau task-01; không gộp task-03 metrics vào cùng branch.

## Finalization ngày 21/10/2026 22:39

CI 39626518883 cả 5 job đạt; reviewer độc lập full/focused APPROVED nội bộ. Điều phối viên finalization trước merge theo ngoại lệ đã xác nhận; phải kiểm CI head cuối trước merge. Output ghi rõ W1 local flaky, không giả GitHub approval.

## Hậu kiểm theo issue #45 ngày 23/10/2026

Xử lý trong [PR #46](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/46); trạng thái `Hoàn thành` không đổi.

- Trễ hạn: hạn dự kiến 20/10/2026, hoàn thành (finalization) 21/10/2026, trễ 1 ngày so với mốc bù tiến độ.
- Đối chiếu review: agent focused review APPROVED nội bộ tại `b7182a4`. `e11cd1f` và `10209da` là hai commit finalization chỉ gồm metadata sau approval; CI head cuối `10209da` là [run 39627853914](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39627853914), đạt cả 5 job. Câu "metadata cuối `10209da`" trong mô tả PR #42 không có nghĩa reviewer đã review lại commit đó.
- Shutdown runtime nay chờ `app.close()` xong rồi mới `telemetry.shutdown()` để span/log lúc đóng app không bị mất; sửa trong PR follow-up của issue #45.
- Collaborator: chưa có xác nhận của Bách về field phục vụ diagnosis; Bách sẽ xác nhận trong task-04/05.
