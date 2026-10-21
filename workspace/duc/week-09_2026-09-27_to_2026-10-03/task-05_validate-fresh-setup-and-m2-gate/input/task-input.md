# Input task

## Thông tin chung

| Trường               | Nội dung                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Mã task              | `task-05_validate-fresh-setup-and-m2-gate`                                                 |
| Tên task             | Xác minh fresh setup và Gate M2                                                            |
| Người phụ trách      | Đức                                                                                       |
| Tuần thực hiện       | `week-09_2026-09-27_to_2026-10-03`                                                         |
| Trạng thái           | Chờ review                                                                             |
| Ngày tạo             | 14/10/2026                                                                                 |
| Thời gian dự kiến    | 14/10/2026–17/10/2026 (mốc bù tiến độ W9)                                                  |
| Nhánh thực hiện      | `test/week-09/task-05-validate-fresh-setup-and-m2-gate`                                    |
| Pull request dự kiến | PR từ nhánh task vào `main` sau khi hoàn tất validation, báo cáo Gate M2 và bằng chứng DoD |

## Mục tiêu và phạm vi

### Task cần làm gì?

Từ checkout/môi trường sạch, làm theo tài liệu để dựng Testbed MVP v0.1, chạy reset/seed và regression suite (`pnpm run test:regression` của W9 task-04), rồi ghi bằng chứng về topology, hai workflow xuyên service và khả năng vận hành/giải thích. Sửa các lỗi tài liệu setup phát hiện được, kiểm tra lại từ trạng thái sạch và đối chiếu Gate M2 theo [Plan v0.2](../../../../../docs/processed/plan/plan-v0.2-24-weeks.md) và B07 trong [implementation backlog](../../../../../docs/processed/plan/implementation-backlog-v1.md); nếu thiếu kiểm chứng độc lập của người thứ hai, ghi Gate M2 `Chờ xử lý` thay vì tự xác nhận.

### Phạm vi không thực hiện

- Không sửa substantive code của các task hardening trước dưới danh nghĩa validation.
- Không dùng cache, volume hoặc cấu hình bí mật từ môi trường phát triển hiện có để làm bằng chứng fresh setup.
- Không đánh dấu Gate M2 đạt khi chỉ có một thành viên thực hiện, và không ghi kết quả kiểm chứng thay Đức.

## Sản phẩm dự kiến

| Sản phẩm                                      | Loại | Vị trí hoặc link dự kiến                                                                                                        |
| --------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| Báo cáo fresh setup và Gate M2                | Docs | `workspace/bach/week-09_2026-09-27_to_2026-10-03/task-05_validate-fresh-setup-and-m2-gate/output/task-output.md` và PR của task |
| Sửa tài liệu setup phát hiện trong validation | Docs | `README.md`, `docker-compose/README.md`                                                                                         |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: W9 task-01 đến task-04 đã hoàn thành trên `main` (task-04 merge qua PR #39); Quick Start trong `README.md` và `docker-compose/README.md` hiện hành.
- Người cần phối hợp: Đức cùng vận hành hai workflow và kiểm chứng độc lập theo tài liệu đã sửa; Bách thực hiện fresh setup độc lập.
- Rủi ro hoặc giả định: Gate M2 canonical yêu cầu cả hai thành viên tự vận hành và giải thích được ít nhất hai workflow xuyên nhiều service; nếu Đức chưa kiểm chứng trước khi chuyển `Chờ review` thì Gate M2 ghi `Chờ xử lý`. Tài liệu setup hiện chưa nhắc `pnpm run test:regression`, dự kiến cần bổ sung.

## Definition of Done

- [ ] Checkout sạch chỉ dùng dependency/version được tài liệu hóa; Compose dựng đủ sáu business service + Gateway, PostgreSQL, Redis và RabbitMQ healthy.
- [ ] Reset/seed và regression suite chạy pass, có log/thời lượng/commit làm bằng chứng tái lập.
- [ ] Người thực hiện vận hành và giải thích được ít nhất hai workflow xuyên nhiều service, gồm một luồng async.
- [ ] Một người thứ hai chạy hoặc kiểm chứng độc lập và ghi kết quả; nếu chưa có, Gate M2 được ghi `Chờ xử lý`, không ghi đạt.
- [ ] Mọi lỗi tài liệu setup được sửa và kiểm tra lại từ trạng thái sạch; không còn bước thủ công chưa được ghi.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.

## Tiếp quản theo chỉ thị trực tiếp

Ngày 21/10/2026, Đức chỉ thị tiếp quản task thay Bách và xác nhận ngoại lệ, cho phép commit/push/merge PR #40 sau cảnh báo. Không có GitHub APPROVED; không xác nhận Gate M2 hai thành viên đạt khi thiếu phần giải thích của Bách.

Input tiếp quản hồi tố từ hồ sơ gốc của Bách; giữ nguyên nguồn và số liệu ngày 14/10. Phạm vi còn lại: đối chiếu kiểm chứng độc lập của Đức, ghi giới hạn Gate M2, hoàn tất hồ sơ theo ngoại lệ. Các checkbox kế thừa bên trên là baseline ban đầu; bảng DoD trong output tiếp quản là kết quả hiện hành.
