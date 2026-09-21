# Task tuần: Bổ sung resilience và trace-context propagation cho Enrollment→Course

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_add-enrollment-resilience-and-propagation` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách review resilience policy và dependency telemetry |
| Ưu tiên | Cao |
| Hạn dự kiến | 18/09/2026 |
| Nhánh thực hiện | `feat/week-07/task-02-add-enrollment-resilience-and-propagation` |

## Yêu cầu và phạm vi

### Cần thực hiện

Bổ sung resilience cơ bản (timeout rõ ràng và retry hoặc circuit-breaker đơn giản) cho lời gọi Enrollment→Course, hành vi khi Course lỗi/timeout được kiểm tra và trả error envelope ổn định. Đảm bảo W3C trace-context được forward xuyên Gateway→Enrollment→Course. Instrument dependency span/metric cho `enrollment-postgres` và lời gọi client `enrollment→course` theo identity/schema canonical (giống mẫu `course-postgres`/`course-redis` ở Week 6).

### Không thực hiện

- Không triển khai Submission hoặc storage mock; các phần này thuộc task-04/05.
- Không thêm fault injector F1 hoặc benchmark/experiment campaign.
- Không đưa student/course ID, trace ID hoặc error message tùy ý thành Prometheus label cardinality cao.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 (Enrollment MVP) đã merge vào `main`; OpenTelemetry bootstrap và dependency telemetry pattern từ Week 5–6.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra resilience policy nhất quán với error/timeout policy chung và dependency identity đủ cho phân tích sau này.
- Rủi ro/giả định: resilience behavior cần nhất quán với Course's error/timeout policy (Week 6) và không che lỗi thật của Course.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Resilience policy và trace propagation cho Enrollment | Code | `lms/services/enrollment/` |
| Telemetry assertions cho Enrollment dependencies | Code | `lms/services/enrollment/` hoặc `lms/test/` |

## Definition of Done

- [ ] Lời gọi Enrollment→Course có timeout rõ ràng; retry hoặc circuit-breaker đơn giản được tài liệu hóa; Course lỗi/timeout trả error envelope canonical (`DEPENDENCY_UNAVAILABLE`/`DEPENDENCY_TIMEOUT`).
- [ ] Test bao phủ Course unavailable/timeout theo behavior đã chốt.
- [ ] W3C trace-context được forward xuyên Gateway→Enrollment→Course; span cho HTTP server, `enrollment-postgres` và client call `enrollment→course` có dependency identity canonical.
- [ ] Telemetry không chứa secret, JWT, PII, ground-truth label hoặc label cardinality cao bị cấm.
- [ ] Bách kiểm tra resilience policy và telemetry assertions đủ phân biệt các path phục vụ phân tích sau này.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo — Đức tạo khi nhận task.
- Output workspace: Chưa tạo — Đức tạo khi nhận task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Đức theo yêu cầu chia task tuần 7; thực hiện sau task-01.
- Ghi chú/tồn đọng: Đức cần tự tạo hồ sơ trong `workspace/duc/`; chờ task-01 merge vào `main`.
