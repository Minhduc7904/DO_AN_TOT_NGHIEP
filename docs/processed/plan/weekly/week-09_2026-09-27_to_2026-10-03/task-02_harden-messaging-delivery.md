# Task tuần: Hardening messaging delivery

## Thông tin chung

| Trường          | Nội dung                                         |
| --------------- | ------------------------------------------------ |
| Mã task         | `task-02_harden-messaging-delivery`              |
| Tuần            | `week-09_2026-09-27_to_2026-10-03`               |
| Trạng thái      | Chờ review                                       |
| Người phụ trách | Đức                                              |
| Collaborator    | Không có                                         |
| Ưu tiên         | Cao                                              |
| Hạn dự kiến     | 14/10/2026 — mốc bù tiến độ                      |
| Nhánh thực hiện | `test/week-09/task-02-harden-messaging-delivery` |

## Yêu cầu và phạm vi

### Cần thực hiện

Kiểm chứng và hardening luồng `grade.completed` trên publisher/consumer thật sau khi W8 task-02 merge: semantics at-least-once, event ID ổn định, consumer deduplicate, confirm/retry/reconnect, queue binding, recovery khi RabbitMQ lỗi và trace-context propagation. Bổ sung test hoặc sửa lỗi phát hiện được, đồng thời chốt giới hạn MVP.

### Không thực hiện

- Không triển khai lại Notification consumer hoặc publisher đã thuộc W8.
- Không xây exactly-once, DLQ/retry topology production-grade hoặc nhà cung cấp notification thật.
- Không đổi event schema v1 nếu không có quyết định kiến trúc riêng.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: W8 task-01, task-02 và task-05 đã merge; event contract `grade.completed` v1.
- Người hoặc phần việc cần phối hợp: Người phụ trách W8 task-02 cung cấp trạng thái consumer; hiện chưa có collaborator khả dụng.
- Rủi ro/giả định: Dependency Notification consumer W8 đã merge; stability test cần Docker và RabbitMQ thật.

## Sản phẩm kỳ vọng

| Sản phẩm                                  | Loại | Vị trí hoặc link dự kiến                                             |
| ----------------------------------------- | ---- | -------------------------------------------------------------------- |
| Messaging hardening tests và lỗi được sửa | Code | `lms/services/grading/`, `lms/services/notification/`, `lms/test/`   |
| Tài liệu semantics/giới hạn delivery MVP  | Docs | README của Grading/Notification hoặc tài liệu architecture canonical |

## Definition of Done

- [x] Publish/consume dùng cùng exchange, routing key, schema và trace headers; queue tồn tại trước khi test publish.
- [x] Duplicate delivery cùng `event_id` không tạo notification thứ hai; retry/reconnect không tạo event logic mới.
- [x] Broker unavailable, confirm timeout, consumer restart và slowdown/backlog có test recovery với fault hook mặc định tắt.
- [x] Span/metrics/logs của publish, consume và process giữ correlation, dependency identity và error semantics; không lộ credential/PII.
- [ ] Test RabbitMQ integration chạy ổn định ít nhất ba lần liên tiếp và `pnpm run ci:verify` pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-02_harden-messaging-delivery/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-02_harden-messaging-delivery/output/task-output.md).
- Pull request: [#37](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/37).
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 13/10/2026 — substantive work đã push, PR #37 đã mở và task chuyển `Chờ review` trên PR head.
- Ghi chú/tồn đọng: RabbitMQ integration và stability 3/3 vòng đã pass; CI Linux của PR đang chạy. Local `ci:verify` bị chặn tại baseline Prettier trên checkout Windows và được ghi nguyên trong output.
