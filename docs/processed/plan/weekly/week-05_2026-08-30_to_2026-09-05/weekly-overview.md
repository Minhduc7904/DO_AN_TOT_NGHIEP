# Tổng quan tuần 5 — Repository, Compose, CI và service template

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-05_2026-08-30_to_2026-09-05` |
| Nguồn plan canonical | [Plan v0.2 — Tuần 5](../../plan-v0.2-24-weeks.md#tuần-5--repository-compose-ci-và-service-template) |
| Mục tiêu tuần | Dựng nền tảng code có thể khởi chạy từ máy sạch gồm service template, Compose, OpenTelemetry bootstrap và CI baseline. |
| Trạng thái tuần | Chưa bắt đầu |

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_scaffold-repository-and-service-template](task-01_scaffold-repository-and-service-template.md) | Khởi tạo cấu trúc repository và service template chạy được | Đức | Bách | Cao | Đã giao |
| [task-02_establish-compose-baseline](task-02_establish-compose-baseline.md) | Dựng Docker Compose baseline và Quick Start | Đức | Bách | Cao | Đã giao |
| [task-03_bootstrap-opentelemetry](task-03_bootstrap-opentelemetry.md) | Tích hợp OpenTelemetry bootstrap và resource identity | Bách | Đức | Cao | Đã giao |
| [task-04_establish-ci-and-fresh-setup-gate](task-04_establish-ci-and-fresh-setup-gate.md) | Thiết lập CI baseline và kiểm chứng fresh setup | Đức | Bách | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: task-01 tạo nền chung; task-02 và task-03 có thể làm song song sau task-01; task-04 là gate tích hợp sau ba task trước. Các artifact tuần 4 và backend blueprint là nguồn contract, topology và telemetry identity.
- Rủi ro: chọn toolchain hoặc convention ngoài blueprint; Compose cần thao tác thủ công; telemetry được gắn muộn gây sửa lại template; CI chỉ kiểm tra hình thức mà không chứng minh stack dựng được.
- Quyết định cần chốt: tuần này chỉ scaffold một service canonical ở mức `/health`, chưa triển khai business flow tuần 6; bốn task phản ánh bốn ranh giới bàn giao độc lập, không cố định theo số task của tuần trước.

## Tiêu chí kết thúc tuần

- [ ] Từ máy sạch có thể cài dependency và chạy service mẫu có `/health` theo Quick Start.
- [ ] `docker compose up` khởi động được service mẫu, PostgreSQL, Redis và RabbitMQ mà không cần bước thủ công ngoài tài liệu.
- [ ] Service mẫu export được trace tối thiểu với resource identity canonical và có kiểm tra error attribute.
- [ ] CI chạy build, lint và test baseline thành công; hai thành viên đã thực hiện fresh setup độc lập.
- [ ] Mỗi task có PR riêng, bằng chứng DoD và trạng thái đúng vòng đời review canonical.
