# Task tuần: Tạo lệnh reset và seed Testbed MVP

## Thông tin chung

| Trường          | Nội dung                                                |
| --------------- | ------------------------------------------------------- |
| Mã task         | `task-03_implement-reset-and-seed-command`              |
| Tuần            | `week-09_2026-09-27_to_2026-10-03`                      |
| Trạng thái      | Đang thực hiện                                          |
| Người phụ trách | Đức                                                     |
| Collaborator    | Không có                                                |
| Ưu tiên         | Cao                                                     |
| Hạn dự kiến     | 13/10/2026 — mốc bù tiến độ                             |
| Nhánh thực hiện | `feat/week-09/task-03-implement-reset-and-seed-command` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo một entrypoint reset/seed có kiểm soát cho môi trường local/test, tái lập dữ liệu của Auth, Course, Enrollment, Submission và Grading, dọn cache Redis và trạng thái RabbitMQ/Notification liên quan theo thứ tự dependency. Lệnh phải có guard môi trường, output rõ, chạy lặp lại cho kết quả xác định và được dùng lại bởi regression suite.

### Không thực hiện

- Không chạy trên production hoặc xóa volume/dữ liệu ngoài project Compose được chỉ định.
- Không đổi dữ liệu seed nghiệp vụ nếu không cần cho hai workflow kiểm chứng canonical.
- Không dùng shell-specific script nếu có thể triển khai entrypoint Node đa nền tảng.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: migration/seed hiện tại của năm database; Compose baseline W8.
- Người hoặc phần việc cần phối hợp: Không có.
- Rủi ro/giả định: reset là destructive trong môi trường local/test; phải từ chối chạy khi thiếu xác nhận environment/project target an toàn.

## Sản phẩm kỳ vọng

| Sản phẩm                                    | Loại          | Vị trí hoặc link dự kiến                                         |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| Entry point reset/seed và script hỗ trợ     | Code          | `lms/scripts/`, `lms/package.json` hoặc vị trí canonical phù hợp |
| Hướng dẫn sử dụng và dữ liệu seed canonical | Docs / Config | `docker-compose/README.md`, README service liên quan             |

## Definition of Done

- [x] Một lệnh duy nhất reset/seed đúng năm database và trạng thái Redis/RabbitMQ cần thiết trong project local/test được chỉ định.
- [x] Có guard chống chạy nhầm môi trường hoặc target rộng; log không chứa credential và báo rõ từng bước/thất bại.
- [x] Chạy từ trạng thái sạch và chạy lặp lại đều tạo cùng tập dữ liệu định danh phục vụ ít nhất hai workflow E2E.
- [x] Khi một bước lỗi, lệnh dừng với exit code khác 0 và không báo thành công giả; hướng dẫn recovery được tài liệu hóa.
- [ ] Test hoặc smoke tự động chứng minh reset/seed hoạt động trên Compose; `pnpm run ci:verify` và Compose config pass.
- [ ] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-03_implement-reset-and-seed-command/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-09_2026-09-27_to_2026-10-03/task-03_implement-reset-and-seed-command/output/task-output.md).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 13/10/2026 — substantive work và Compose reset smoke hai vòng đã hoàn tất; đang chuẩn bị PR.
- Ghi chú/tồn đọng: Fingerprint hai vòng cùng SHA-256 `c0222dc2c158f2f46368db43fe77752a044832ef76a218b9836da2fa5256f522`. Local `ci:verify` còn ghi nhận baseline Prettier ngoài diff và W1 timeout; CI Linux sẽ là bằng chứng canonical.
