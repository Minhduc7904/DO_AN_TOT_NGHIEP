# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_add-enrollment-resilience-and-propagation` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành theo ngoại lệ review |
| Bắt đầu thực tế | 22/09/2026 |
| Hoàn thành thực tế | 22/09/2026 12:05 ICT |
| Tổng thời lượng | ~1 phiên làm việc (22/09/2026), tiếp nối task-01 |
| Pull request | [#26](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/26) (xếp chồng trên #25, #25 đã merge vào `main`) |
| Người review | Đức tự review thay Bách (Bách không thể review) |
| Kết quả review | Đạt theo ngoại lệ workflow, xác nhận trực tiếp ngày 22/09/2026 bởi người phụ trách: Bách không thể review nên Đức tự thực hiện review thay Bách (xem các phát hiện/sửa lỗi ở mục "Báo cáo công việc đã làm"); không có submission `APPROVED` trên GitHub và không có review độc lập từ Bách — đây là xác nhận của chính người phụ trách, không phải verdict GitHub. |

## Báo cáo công việc đã làm

- Nâng `CourseHttpClient.exists()` chạy trong `observeDependency('enrollment-course', 'exists', ...)`, tạo `CLIENT` span + metric `enrollment.dependency.*` với `dependency_identity: 'enrollment-course'` — cùng schema với `enrollment-postgres` đã có ở task-01.
- Forward W3C trace-context (`traceparent`/`tracestate`) bằng `propagation.inject(context.active(), headers)`; xác nhận qua test rằng header gửi đi chứa đúng `trace_id` của span đang active — không cần truyền tay traceparent qua application layer vì middleware HTTP đã extract context vào AsyncLocalStorage của request.
- Thêm `CircuitBreaker` đơn giản (`adapters/clients/circuit-breaker.ts`, có docstring giải thích lý do chọn circuit-breaker thay vì retry): mở sau `ENROLLMENT_COURSE_BREAKER_THRESHOLD` lỗi liên tiếp (mặc định 3), half-open sau `ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS` (mặc định 5000ms); khi mở, short-circuit ngay thành `EnrollmentDependencyError('enrollment-course','unavailable')` không gọi mạng, gắn attribute `circuit_breaker_open` lên span.
- Đơn giản hoá `CourseClient` port: bỏ tham số `context` (traceparent/tracestate) đã thêm nhưng chưa dùng ở task-01, vì thiết kế cuối cùng dùng `context.active()` implicit.
- Test mới: `test/unit/course-http.client.spec.ts` (6 case: 200/404, forward principal + traceparent, timeout không retry, network error → unavailable, breaker mở sau N lỗi liên tiếp, breaker đóng lại sau cooldown khi request tiếp theo thành công) và `test/telemetry/dependency.telemetry-test.mjs` (span/metric `enrollment-postgres`/`enrollment-course`, phân biệt status `conflict` khỏi `unavailable`/`timeout` cho lỗi unique-violation, guard không leak `student-001`/`course-001`/secret/`root_cause`/`fault_id`).
- **Chưa** đụng Gateway routing, `docker-compose/`, CI hay root script dùng chung — theo tiền lệ Week 6, các phần này thuộc task-03.
- Mở PR [#26](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/26) từ `feat/week-07/task-02-add-enrollment-resilience-and-propagation` vào nhánh task-01 (xếp chồng trên #25), cập nhật card task và `weekly-overview.md` sang `Chờ review`.
- Tự review lại (self-review) sau khi chuyển `Chờ review`, phát hiện và sửa qua commit `3f34a39`: circuit breaker ở trạng thái half-open cho phép nhiều request đồng thời đi thử lại thay vì chỉ một probe (trái với docstring), sửa thành single-flight; test telemetry mới (`dependency.telemetry-test.mjs`) chưa được wire vào `test:telemetry`/CI — đã bổ sung.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Resilience (circuit breaker) và trace propagation cho Enrollment | Code | [lms/services/enrollment/src/adapters/clients/](../../../../../lms/services/enrollment/src/adapters/clients/) |
| Telemetry assertions cho Enrollment dependencies | Code | [lms/services/enrollment/test/](../../../../../lms/services/enrollment/test/) |
| Pull request | Code | [PR #26](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/26) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Timeout rõ ràng; circuit-breaker đơn giản được tài liệu hóa; Course lỗi/timeout trả error envelope canonical | Đạt | `course-http.client.ts` + `circuit-breaker.ts` (docstring giải thích lựa chọn); `HttpExceptionFilter` map `EnrollmentDependencyError` sang `DEPENDENCY_UNAVAILABLE`/`DEPENDENCY_TIMEOUT` (không đổi so với task-01). |
| Test bao phủ Course unavailable/timeout/circuit-open | Đạt | `test/unit/course-http.client.spec.ts` — 20/20 test pass cục bộ (bao gồm 7 case của client, kể cả case single-flight half-open thêm ở commit `3f34a39`). |
| W3C trace-context forward Gateway→Enrollment→Course; span HTTP server, `enrollment-postgres`, client `enrollment-course` có dependency identity canonical | Đạt (ở mức Enrollment; đường Gateway thật đo ở task-03) | Test "forwards the trusted principal headers and the active W3C trace context" xác nhận `traceparent` gửi đi chứa đúng `trace_id` của span cha; `dependency.telemetry-test.mjs` xác nhận `dependency_identity: 'enrollment-course'`/`'enrollment-postgres'` trên span `CLIENT`. |
| Telemetry không chứa secret, JWT, PII, ground-truth label hoặc cardinality cao bị cấm | Đạt | `dependency.telemetry-test.mjs` — `assert.doesNotMatch` với regex chặn `student-001`/`course-001`/secret/`root_cause`/`fault_id`. |
| URL/số PR và `Chờ review` đã commit/push vào PR head trước review | Đạt | Commit cập nhật card/weekly-overview/output nằm trên chính nhánh `feat/week-07/task-02-add-enrollment-resilience-and-propagation`, đã push lên PR #26 trước khi yêu cầu Bách review. |
| PR có mô tả đúng template, `APPROVED` từ Bách, completion metadata trước merge | Đạt theo ngoại lệ đã xác nhận | PR #26 dùng template; GitHub không có submission `APPROVED` vì Bách không thể review. Đức tự thực hiện review thay Bách (commit fix `3f34a39`) và xác nhận trực tiếp ngày 22/09/2026 chấp nhận bỏ qua cổng GitHub `APPROVED`; completion metadata được commit/push trên PR head trước merge, sau khi PR #25 (task-01) đã merge vào `main`. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Bỏ tham số `context` (traceparent/tracestate) khỏi `CourseClient.exists()` — thêm ở task-01 nhưng không cần thiết vì `context.active()` đã đủ; không ảnh hưởng DoD.
- Việc chưa hoàn thành hoặc trở ngại: Bách không thể review (theo xác nhận của người phụ trách ngày 22/09/2026) nên không có `APPROVED` GitHub — Đức tự thực hiện review thay Bách theo ngoại lệ đã xác nhận; trace propagation qua Gateway thật (không chỉ ở mức unit test) được kiểm chứng ở task-03; `tools/sync-plan-json-and-timeline.ps1` không chạy được (thiếu `pwsh`), timeline đang chờ đồng bộ.
- Bước tiếp theo: Finalization theo ngoại lệ đã hoàn tất trong output này; người phụ trách (Đức) merge PR #26 vào `main` sau khi PR #25 đã merge.

> Ngoại lệ workflow: GitHub không ghi nhận `APPROVED` vì Bách không thể review. Người phụ trách (Đức) xác nhận trực tiếp ngày 22/09/2026 rằng Đức đã tự thực hiện review thay Bách và chấp nhận bỏ qua cổng GitHub `APPROVED` để finalization. Không diễn giải ngoại lệ này thành GitHub approval hay review độc lập từ Bách. `Hoàn thành thực tế` là thời điểm work, DoD và finalization đã hoàn tất; không ghi merge time.
