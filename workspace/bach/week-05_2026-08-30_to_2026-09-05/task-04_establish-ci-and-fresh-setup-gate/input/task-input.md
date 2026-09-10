# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_establish-ci-and-fresh-setup-gate` |
| Tên task | Thiết lập CI baseline và kiểm chứng fresh setup |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Chờ xử lý |
| Ngày tạo | 10/09/2026 |
| Thời gian dự kiến | 10/09/2026 — triển khai CI, tự kiểm chứng và chuẩn bị PR để Đức review |
| Nhánh thực hiện | `chore/week-05/task-04-establish-ci-and-fresh-setup-gate` |
| Pull request dự kiến | [PR #18](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/18) vào `main`; chờ PR #17 merge trước khi Đức thực hiện fresh setup/review |

## Mục tiêu và phạm vi

### Task cần làm gì?

Thiết lập CI baseline cho repository và service `course`: CI phải thực hiện clean install, build, lint, unit test cùng telemetry assertion, đồng thời kiểm tra cấu hình Compose không phụ thuộc secret hoặc file local. Bách sẽ tự kiểm chứng đầy đủ thay đổi; Đức sẽ chạy fresh setup độc lập từ checkout sạch theo Quick Start, kiểm tra `/health` và telemetry bootstrap tối thiểu trước khi review PR.

### Phạm vi không thực hiện

- Không xây deployment pipeline, release automation hoặc production environment.
- Không thêm E2E business flow, load test hoặc fault test ngoài phạm vi tuần 5.
- Không dùng cache CI để che giấu dependency hoặc bước cài đặt chưa được khai báo.
- Không đánh dấu task hoàn thành chỉ vì CI pass khi fresh setup độc lập chưa có bằng chứng.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| CI workflow baseline | Code/Config | `.github/workflows/` |
| Scripts/config kiểm tra build, lint, test và Compose | Code/Config | `lms/` và `docker-compose/` |
| Bằng chứng fresh setup và cập nhật Quick Start nếu cần | Docs/Khác | PR, output task và `README.md` hoặc guide liên quan |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: artifact task-01, task-02 và head PR #17 của task-03; Quick Start tại `docker-compose/`.
- Người cần phối hợp: Đức chạy fresh setup trên checkout sạch, kiểm tra `/health`, resource identity/trace tối thiểu và review telemetry assertion trong CI.
- Rủi ro hoặc giả định: CI runner có thể không chạy full Compose ổn định; nếu CI chỉ dùng `docker compose config`, fresh setup độc lập của Đức vẫn là gate bắt buộc.

## Definition of Done

- [ ] CI trên pull request chạy clean install, build, lint và unit/telemetry assertion test; workflow pass trên commit được review.
- [ ] CI kiểm tra cấu hình Compose tối thiểu và không phụ thuộc secret thật hoặc file local không được commit.
- [ ] Đức chạy fresh setup từ checkout sạch, khởi động stack, gọi `/health` và xác minh bootstrap telemetry tối thiểu theo Quick Start.
- [ ] Mọi bước thiếu hoặc lỗi tái lập phát hiện trong fresh setup đã được sửa trong code/tài liệu và chạy lại thành công.
- [ ] Gate M1 có bằng chứng từ cả CI và fresh setup độc lập; các giới hạn chưa tự động hóa được ghi rõ, không bị mô tả như đã đạt.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
