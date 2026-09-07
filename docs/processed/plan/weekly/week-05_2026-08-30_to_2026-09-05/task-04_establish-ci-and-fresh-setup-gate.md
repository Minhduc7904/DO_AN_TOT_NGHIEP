# Task tuần: Thiết lập CI baseline và kiểm chứng fresh setup

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_establish-ci-and-fresh-setup-gate` |
| Tuần | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách chạy lại toàn bộ Quick Start và review telemetry assertion trong CI |
| Ưu tiên | Cao |
| Hạn dự kiến | 05/09/2026 |
| Nhánh thực hiện | `chore/week-05/task-04-establish-ci-and-fresh-setup-gate` |

## Yêu cầu và phạm vi

### Cần thực hiện

Thiết lập CI baseline cho phần code tuần 5 và đóng gate M1 bằng một lượt fresh setup độc lập. CI phải chạy các kiểm tra có ý nghĩa cho repository/service template; quy trình fresh setup phải đối chiếu từ clean clone đến Compose, `/health` và telemetry bootstrap tối thiểu.

### Không thực hiện

- Không xây deployment pipeline, release automation hoặc production environment.
- Không thêm E2E business flow, load test hoặc fault test chưa thuộc phạm vi tuần 5.
- Không dùng cache CI để che giấu dependency hoặc bước cài đặt chưa được khai báo.
- Không đánh dấu task hoàn thành nếu CI pass nhưng fresh setup độc lập chưa có bằng chứng.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01, task-02 và task-03 đã có artifact sẵn sàng tích hợp; Quick Start từ task-02.
- Người hoặc phần việc cần phối hợp: Bách thực hiện fresh setup trên checkout sạch, kiểm tra `/health`, resource identity/trace tối thiểu và phản hồi các bước không tái lập.
- Rủi ro/giả định: CI runner có thể không chạy full stack ổn định; nếu chỉ kiểm tra `docker compose config`, fresh setup local độc lập vẫn là gate bắt buộc và phải có bằng chứng.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| CI workflow baseline | Code | `.github/workflows/` |
| Scripts/config lint và test | Code | Repository root và module liên quan |
| Bằng chứng fresh setup và Quick Start đã sửa | Docs / Khác | PR, output task và `README.md` hoặc guide được liên kết |

## Definition of Done

- [ ] CI trên pull request chạy clean install, build, lint và unit/telemetry assertion test; workflow pass trên commit được review.
- [ ] CI kiểm tra cấu hình Compose tối thiểu và không phụ thuộc secret thật hoặc file local không được commit.
- [ ] Bách chạy fresh setup từ checkout sạch, khởi động stack, gọi `/health` và xác minh bootstrap telemetry tối thiểu theo Quick Start.
- [ ] Mọi bước thiếu hoặc lỗi tái lập phát hiện trong fresh setup đã được sửa trong code/tài liệu và chạy lại thành công.
- [ ] Gate M1 có bằng chứng từ cả CI và fresh setup độc lập; các giới hạn chưa tự động hóa được ghi rõ, không bị mô tả như đã đạt.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 30/08/2026 — task được phân rã làm gate tích hợp cuối tuần 5.
- Ghi chú/tồn đọng: chỉ bắt đầu khi task-01, task-02 và task-03 có artifact sẵn sàng tích hợp; không dùng CI pass thay cho fresh setup của Bách.
