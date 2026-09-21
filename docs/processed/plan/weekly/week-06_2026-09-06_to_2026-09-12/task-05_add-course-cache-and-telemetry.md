# Task tuần: Bổ sung Redis cache và telemetry dependency cho Course

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-course-cache-and-telemetry` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Hoàn thành |
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

- Tài liệu/task cần có trước: nhánh task-04 là base theo chỉ thị Đức trước merge; OpenTelemetry bootstrap Week 5; telemetry schema và fault matrix F1. Chỉ merge task-05 sau task-04.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra dependency identity, RED metrics và field đủ cho phân tích sau này.
- Rủi ro/giả định: cache failure behavior cần nhất quán với error/timeout policy và không che lỗi persistence.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Course Redis adapter/cache policy | Code | `lms/services/course/` |
| Telemetry assertions cho Course dependencies | Code | `lms/services/course/` hoặc `lms/test/` |

## Definition of Done

- [x] Course get/list sử dụng Redis theo cache-aside policy được tài liệu hóa; write path invalidates/updates cache nhất quán và PostgreSQL vẫn là source of truth.
- [x] Test bao phủ cache hit, cache miss, invalidation và Redis unavailable/timeout theo behavior đã chốt.
- [x] Span/metric cho Course HTTP, `course-postgres` và `course-redis` có service/dependency identity canonical cùng status/duration/error cần thiết.
- [x] Telemetry không chứa secret, JWT, PII, ground-truth label hoặc label cardinality cao bị cấm.
- [x] Bách kiểm tra telemetry assertions đủ phân biệt HTTP, PostgreSQL và Redis path phục vụ phân tích sau này (ngoại lệ: Bách nghỉ ốm, không thực hiện được; Đức tự xác nhận thay).

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-06_2026-09-06_to_2026-09-12/task-05_add-course-cache-and-telemetry/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-06_2026-09-06_to_2026-09-12/task-05_add-course-cache-and-telemetry/output/task-output.md).
- Pull request: [#23](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/23) (xếp chồng trên #22).
- Kết quả review: Ngoại lệ — không có GitHub `APPROVED`. Bách không thể review do nghỉ ốm; Đức (người phụ trách) xác nhận bỏ qua bước review độc lập ngày 21/09/2026 theo cơ chế ngoại lệ trong [quy tắc Git và pull request](../../../rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — cache/telemetry assertions và quality/security checks đã xanh; Redis/PostgreSQL thực đã chạy thành công trong CI của PR #24 phụ thuộc. Chuyển `Chờ review` trên PR head.
- Cập nhật gần nhất: 21/09/2026 — Bách nghỉ ốm, không thể review. Đức (người phụ trách) xác nhận ngoại lệ, tự finalization và chuyển `Hoàn thành` trước khi tự merge task của mình.
- Ghi chú/tồn đọng: Không còn tồn đọng; thiếu duy nhất review độc lập của Bách do lý do bất khả kháng đã nêu.
