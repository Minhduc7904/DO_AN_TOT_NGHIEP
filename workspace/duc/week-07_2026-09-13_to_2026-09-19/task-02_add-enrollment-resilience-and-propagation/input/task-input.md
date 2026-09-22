# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_add-enrollment-resilience-and-propagation` |
| Tên task | Bổ sung resilience và trace-context propagation cho Enrollment→Course |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 22/09/2026 |
| Thời gian dự kiến | 1 phiên làm việc |
| Nhánh thực hiện | `feat/week-07/task-02-add-enrollment-resilience-and-propagation` |
| Pull request dự kiến | Sẽ tạo sau khi hoàn tất code + test |

## Mục tiêu và phạm vi

### Task cần làm gì?

Bổ sung resilience cơ bản (timeout rõ ràng và circuit-breaker đơn giản) cho lời gọi Enrollment→Course, kiểm tra hành vi khi Course lỗi/timeout và trả error envelope ổn định. Đảm bảo W3C trace-context được forward xuyên Gateway→Enrollment→Course. Instrument dependency span/metric cho `enrollment-postgres` và client call `enrollment→course` theo identity/schema canonical.

### Phạm vi không thực hiện

- Không triển khai Submission hoặc storage mock (thuộc task-04/05 của Bách).
- Không thêm fault injector F1 hoặc benchmark/experiment campaign.
- Không đưa student/course ID, trace ID hoặc error message tùy ý thành Prometheus label cardinality cao.
- Không sửa Gateway routing, `docker-compose/` hay CI (thuộc task-03, theo tiền lệ Week 6).

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Resilience policy và trace propagation cho Enrollment | Code | `lms/services/enrollment/` |
| Telemetry assertions cho Enrollment dependencies | Code | `lms/services/enrollment/test/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: nhánh `feat/week-07/task-01-implement-enrollment-service` (PR #25, chưa merge — task-02 base trực tiếp lên nhánh này theo chỉ thị Đức); OpenTelemetry bootstrap và dependency telemetry pattern Week 5–6; policy canonical "Retry OFF mặc định trong MVP" (`data-ownership-and-fault-matrix-v1.md` §4.2).
- Người cần phối hợp: Bách kiểm tra resilience policy nhất quán và dependency identity đủ cho phân tích sau này (khi Bách rảnh trở lại).
- Rủi ro hoặc giả định: chọn circuit-breaker thay vì retry để tuân thủ policy retry-off nhưng vẫn thoả DoD "retry hoặc circuit-breaker đơn giản"; resilience behavior không được che lỗi thật của Course.

## Definition of Done

- [ ] Lời gọi Enrollment→Course có timeout rõ ràng; circuit-breaker đơn giản được tài liệu hóa; Course lỗi/timeout trả error envelope canonical (`DEPENDENCY_UNAVAILABLE`/`DEPENDENCY_TIMEOUT`).
- [ ] Test bao phủ Course unavailable/timeout/circuit-open theo behavior đã chốt.
- [ ] W3C trace-context được forward xuyên Gateway→Enrollment→Course; span cho HTTP server, `enrollment-postgres` và client call `enrollment-course` có dependency identity canonical.
- [ ] Telemetry không chứa secret, JWT, PII, ground-truth label hoặc label cardinality cao bị cấm.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc; verdict `APPROVED` hợp lệ từ Bách và completion metadata được xử lý ở bước finalization riêng, không thuộc phạm vi input này.
