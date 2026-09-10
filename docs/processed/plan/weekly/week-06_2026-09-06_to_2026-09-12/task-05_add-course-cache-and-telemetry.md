# Task tuần: Bổ sung Redis cache và telemetry dependency cho Course

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-course-cache-and-telemetry` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách review cache semantics và telemetry field phục vụ phân tích |
| Ưu tiên | Cao |
| Hạn dự kiến | 11/09/2026 |
| Nhánh thực hiện | `feat/week-06/task-05-add-course-cache-and-telemetry` |

## Yêu cầu và phạm vi

### Cần thực hiện

Bổ sung Redis cache cho Course read path với `course_db` là source of truth, quy tắc key/TTL/invalidation rõ và behavior khi Redis lỗi/timeout được kiểm tra. Instrument HTTP server, PostgreSQL và Redis dependency signal theo identity/schema canonical.

### Không thực hiện

- Không triển khai fault injector F1 hoặc benchmark/experiment campaign.
- Không cho service khác đọc Redis trực tiếp và không biến cache thành source of truth.
- Không đưa course/user ID, trace ID hoặc error message tùy ý thành Prometheus label cardinality cao.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-04 đã merge; OpenTelemetry bootstrap Week 5; telemetry schema và fault matrix F1.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra dependency identity, RED metrics và field đủ cho phân tích sau này.
- Rủi ro/giả định: cache failure behavior cần nhất quán với error/timeout policy và không che lỗi persistence.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Course Redis adapter/cache policy | Code | `lms/services/course/` |
| Telemetry assertions cho Course dependencies | Code | `lms/services/course/` hoặc `lms/test/` |

## Definition of Done

- [ ] Course get/list sử dụng Redis theo cache-aside policy được tài liệu hóa; write path invalidates/updates cache nhất quán và PostgreSQL vẫn là source of truth.
- [ ] Test bao phủ cache hit, cache miss, invalidation và Redis unavailable/timeout theo behavior đã chốt.
- [ ] Span/metric cho Course HTTP, `course-postgres` và `course-redis` có service/dependency identity canonical cùng status/duration/error cần thiết.
- [ ] Telemetry không chứa secret, JWT, PII, ground-truth label hoặc label cardinality cao bị cấm.
- [ ] Bách kiểm tra telemetry assertions đủ phân biệt HTTP, PostgreSQL và Redis path phục vụ phân tích sau này.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo — Đức tạo khi nhận task.
- Output workspace: Chưa tạo — Đức tạo khi nhận task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — task được giao cho Đức, thực hiện sau task-04.
- Ghi chú/tồn đọng: Đức cần tự tạo hồ sơ trong `workspace/duc/`; chờ Course persistence/API merge vào `main`.
