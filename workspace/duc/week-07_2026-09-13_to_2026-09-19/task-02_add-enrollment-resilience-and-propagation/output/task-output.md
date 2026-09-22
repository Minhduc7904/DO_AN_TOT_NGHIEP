# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_add-enrollment-resilience-and-propagation` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 22/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành — đang chờ `APPROVED` từ Bách, xem [vòng đời task canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical). |
| Tổng thời lượng | ~1 phiên làm việc (22/09/2026), tiếp nối task-01 |
| Pull request | [#26](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/26) (xếp chồng trên #25) |
| Người review | Bách (chưa review) |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Nâng `CourseHttpClient.exists()` chạy trong `observeDependency('enrollment-course', 'exists', ...)`, tạo `CLIENT` span + metric `enrollment.dependency.*` với `dependency_identity: 'enrollment-course'` — cùng schema với `enrollment-postgres` đã có ở task-01.
- Forward W3C trace-context (`traceparent`/`tracestate`) bằng `propagation.inject(context.active(), headers)`; xác nhận qua test rằng header gửi đi chứa đúng `trace_id` của span đang active — không cần truyền tay traceparent qua application layer vì middleware HTTP đã extract context vào AsyncLocalStorage của request.
- Thêm `CircuitBreaker` đơn giản (`adapters/clients/circuit-breaker.ts`, có docstring giải thích lý do chọn circuit-breaker thay vì retry): mở sau `ENROLLMENT_COURSE_BREAKER_THRESHOLD` lỗi liên tiếp (mặc định 3), half-open sau `ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS` (mặc định 5000ms); khi mở, short-circuit ngay thành `EnrollmentDependencyError('enrollment-course','unavailable')` không gọi mạng, gắn attribute `circuit_breaker_open` lên span.
- Đơn giản hoá `CourseClient` port: bỏ tham số `context` (traceparent/tracestate) đã thêm nhưng chưa dùng ở task-01, vì thiết kế cuối cùng dùng `context.active()` implicit.
- Test mới: `test/unit/course-http.client.spec.ts` (6 case: 200/404, forward principal + traceparent, timeout không retry, network error → unavailable, breaker mở sau N lỗi liên tiếp, breaker đóng lại sau cooldown khi request tiếp theo thành công) và `test/telemetry/dependency.telemetry-test.mjs` (span/metric `enrollment-postgres`/`enrollment-course`, phân biệt status `conflict` khỏi `unavailable`/`timeout` cho lỗi unique-violation, guard không leak `student-001`/`course-001`/secret/`root_cause`/`fault_id`).
- **Chưa** đụng Gateway routing, `docker-compose/`, CI hay root script dùng chung — theo tiền lệ Week 6, các phần này thuộc task-03.
- Mở PR [#26](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/26) từ `feat/week-07/task-02-add-enrollment-resilience-and-propagation` vào nhánh task-01 (xếp chồng trên #25), cập nhật card task và `weekly-overview.md` sang `Chờ review`.

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
| Test bao phủ Course unavailable/timeout/circuit-open | Đạt | `test/unit/course-http.client.spec.ts` — 18/18 test pass cục bộ (bao gồm 6 case mới của client). |
| W3C trace-context forward Gateway→Enrollment→Course; span HTTP server, `enrollment-postgres`, client `enrollment-course` có dependency identity canonical | Đạt (ở mức Enrollment; đường Gateway thật đo ở task-03) | Test "forwards the trusted principal headers and the active W3C trace context" xác nhận `traceparent` gửi đi chứa đúng `trace_id` của span cha; `dependency.telemetry-test.mjs` xác nhận `dependency_identity: 'enrollment-course'`/`'enrollment-postgres'` trên span `CLIENT`. |
| Telemetry không chứa secret, JWT, PII, ground-truth label hoặc cardinality cao bị cấm | Đạt | `dependency.telemetry-test.mjs` — `assert.doesNotMatch` với regex chặn `student-001`/`course-001`/secret/`root_cause`/`fault_id`. |
| URL/số PR và `Chờ review` đã commit/push vào PR head trước review | Đạt | Commit cập nhật card/weekly-overview/output nằm trên chính nhánh `feat/week-07/task-02-add-enrollment-resilience-and-propagation`, đã push lên PR #26 trước khi yêu cầu Bách review. |
| PR có mô tả đúng template, `APPROVED` từ Bách, completion metadata trước merge | Chưa đạt | Đang chờ Bách review PR #26 (và PR #25 vì #26 xếp chồng); finalization thực hiện riêng sau khi có `APPROVED`, không nằm trong phạm vi output này. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Bỏ tham số `context` (traceparent/tracestate) khỏi `CourseClient.exists()` — thêm ở task-01 nhưng không cần thiết vì `context.active()` đã đủ; không ảnh hưởng DoD.
- Việc chưa hoàn thành hoặc trở ngại: Chờ Bách review resilience policy và dependency identity; trace propagation qua Gateway thật (không chỉ ở mức unit test) sẽ được kiểm chứng ở task-03 khi Gateway routing tồn tại; `tools/sync-plan-json-and-timeline.ps1` không chạy được (thiếu `pwsh`), timeline đang chờ đồng bộ.
- Bước tiếp theo: Sau khi PR #25 và #26 có `APPROVED`, tạo nhánh task-03 (`test/week-07/task-03-verify-enrollment-workflow`) lấy base từ chính nhánh task-02 (chưa merge); finalization task-01/task-02 thực hiện riêng bằng `task-completion-recording` trước merge, không nằm trong phạm vi output này.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
