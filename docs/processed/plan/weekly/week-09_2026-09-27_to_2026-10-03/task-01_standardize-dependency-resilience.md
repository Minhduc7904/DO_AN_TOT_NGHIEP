# Task tuần: Chuẩn hóa resilience cho dependency HTTP

## Thông tin chung

| Trường          | Nội dung                                                     |
| --------------- | ------------------------------------------------------------ |
| Mã task         | `task-01_standardize-dependency-resilience`                  |
| Tuần            | `week-09_2026-09-27_to_2026-10-03`                           |
| Trạng thái      | Chờ review                                                   |
| Người phụ trách | Đức                                                          |
| Collaborator    | Không có                                                     |
| Ưu tiên         | Cao                                                          |
| Hạn dự kiến     | 12/10/2026 — mốc bù tiến độ                                  |
| Nhánh thực hiện | `refactor/week-09/task-01-standardize-dependency-resilience` |

## Yêu cầu và phạm vi

### Cần thực hiện

Lập ma trận và chuẩn hóa timeout, retry, error mapping cho các dependency HTTP hiện có: Gateway→service, Enrollment→Course, Submission→Course/Enrollment/Storage Mock và Grading→Submission. Mỗi dependency phải có timeout hữu hạn, quy tắc retry rõ ràng, lỗi `503`/`504` nhất quán, telemetry giữ dependency identity và test chứng minh latency/error propagation.

### Không thực hiện

- Không thay đổi business contract hoặc thêm endpoint LMS.
- Không xử lý RabbitMQ publisher/consumer; thuộc task-02.
- Không tạo một shared library mới nếu chưa chứng minh có abstraction ổn định cho ít nhất hai service.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: code đã merge từ W6–W8; HTTP contract v1; telemetry schema và backend blueprint canonical.
- Người hoặc phần việc cần phối hợp: Không có; các thay đổi ngoài phạm vi service phải được nêu rõ trong PR.
- Rủi ro/giả định: retry ở nhiều tầng có thể gây retry amplification; chỉ retry operation an toàn hoặc được chứng minh idempotent.

## Sản phẩm kỳ vọng

| Sản phẩm                                        | Loại          | Vị trí hoặc link dự kiến                                     |
| ----------------------------------------------- | ------------- | ------------------------------------------------------------ |
| Policy/matrix timeout, retry và error mapping   | Docs          | `docs/processed/architecture/` hoặc README service liên quan |
| Code/config/test resilience cho dependency HTTP | Code / Config | `lms/services/`, `lms/test/`                                 |

## Definition of Done

- [ ] Mọi outbound HTTP dependency có timeout cấu hình được, giá trị mặc định/range được tài liệu hóa và không chờ vô hạn.
- [ ] Retry chỉ áp dụng cho operation phù hợp, có giới hạn attempt/backoff và test chứng minh không tạo retry amplification hoặc duplicate write.
- [ ] Timeout/unavailable được map nhất quán sang error envelope `504`/`503`; lỗi nghiệp vụ không bị tính sai thành dependency failure.
- [ ] Telemetry assertions kiểm tra dependency identity, operation, status/error semantics và không dùng ID người dùng làm metric label.
- [ ] Unit/integration test liên quan pass; `pnpm run ci:verify` và Compose config pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-01_standardize-dependency-resilience/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-01_standardize-dependency-resilience/output/task-output.md).
- Pull request: [#35](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/35).
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 11/10/2026 — substantive work và bằng chứng đã push; PR #35 sẵn sàng review.
- Ghi chú/tồn đọng: Chờ agent độc lập review theo ngoại lệ Đức đã xác nhận; không ghi review nội bộ thành GitHub `APPROVED`.
