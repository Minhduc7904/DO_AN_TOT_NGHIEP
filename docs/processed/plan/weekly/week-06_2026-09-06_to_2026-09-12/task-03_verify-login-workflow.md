# Task tuần: Kiểm chứng contract và workflow W1 qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-login-workflow` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức chạy độc lập workflow và review telemetry assertions |
| Ưu tiên | Cao |
| Hạn dự kiến | 11/09/2026 |
| Nhánh thực hiện | `test/week-06/task-03-verify-login-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tạo kiểm thử contract/integration cho W1 `Client → Gateway → Auth → auth_db → JWT`, gồm happy path, credential sai, JWT hết hạn/sai chữ ký, role bị từ chối, timeout Auth và trace propagation. Cập nhật hướng dẫn chạy khi cần.

### Không thực hiện

- Không triển khai Course hoặc E2E W2.
- Không thay contract đã freeze để làm test pass; sai lệch phải được sửa ở đúng service owner.
- Không coi log quan sát thủ công là thay thế cho assertion tự động trọng yếu.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 và task-02 đã merge; Compose/CI baseline Week 5.
- Người hoặc phần việc cần phối hợp: Đức chạy lại từ checkout sạch và review failure/telemetry path.
- Rủi ro/giả định: test cần cô lập dữ liệu, tránh phụ thuộc thứ tự và không dùng secret thật.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| W1 contract/integration test | Code | `lms/test/` hoặc test suite thuộc Gateway/Auth theo convention repository |
| Hướng dẫn chạy W1 | Docs | `lms/README.md` hoặc tài liệu được liên kết từ Quick Start |

## Definition of Done

- [ ] Test tự động chứng minh login qua Gateway trả JWT hợp lệ từ seed user và request bảo vệ chấp nhận token đó.
- [ ] Test bao phủ credential sai, token hết hạn/sai chữ ký, role không đủ và Auth timeout với status/error code canonical.
- [ ] Trace W1 có Gateway server/client và Auth server span liên kết bằng W3C context; PostgreSQL dependency signal có identity `auth-postgres` khi instrumentation hỗ trợ.
- [ ] Test chạy lặp lại được từ trạng thái dữ liệu sạch và được đưa vào CI phù hợp.
- [ ] Đức chạy độc lập W1 theo hướng dẫn và kết quả/bất kỳ giới hạn telemetry nào được ghi trong PR hoặc output task.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo trên nhánh task.
- Output workspace: Chưa tạo trên nhánh task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — task được giao cho Bách, thực hiện sau task-02.
- Ghi chú/tồn đọng: chỉ bắt đầu khi Auth và Gateway đã merge vào `main`.
