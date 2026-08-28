# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-data-ownership-and-fault-matrix` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 28/08/2026 — chuẩn bị branch, workspace và metadata |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa xác định |
| Pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã tạo branch riêng cho W4-T3 theo tên branch trong card.
- Đã tạo hồ sơ input/output trong workspace cá nhân của Bách.
- Đã cập nhật owner, collaborator, trạng thái và liên kết workspace trong metadata của task.
- Chưa thực hiện sản phẩm tài liệu và chưa bắt đầu phần triển khai chính của task.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Khác | [`input/task-input.md`](../input/task-input.md) |
| Hồ sơ output task | Khác | [`output/task-output.md`](../output/task-output.md) |
| Data ownership và fault matrix MVP | Docs | Chưa tạo; dự kiến tại `docs/processed/architecture/data-ownership-and-fault-matrix-v1.md` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Có bảng ownership cho PostgreSQL logical database, Redis, RabbitMQ và storage mock; không có database access chéo. | Chưa đạt | Chưa bắt đầu sản phẩm chính. |
| Fault matrix có tối thiểu năm scenario MVP với đủ target, injector/hook, workload, ground truth, symptom/propagation và reset/verification. | Chưa đạt | Chưa bắt đầu sản phẩm chính. |
| Mỗi fault có thể ánh xạ tới service-level RCA evaluation và không vượt scope MVP. | Chưa đạt | Chưa bắt đầu sản phẩm chính. |
| Đức review label ground truth/evidence; các rủi ro chưa giải quyết được ghi rõ. | Chưa đạt | Chưa review. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Chưa đạt | Chưa tạo sản phẩm chính. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Chưa đạt | Chưa tạo PR. |
| Pull request có mô tả đúng quy tắc, verdict `APPROVED` hợp lệ và completion metadata trước merge. | Chưa đạt | Chưa tạo PR hoặc review. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: chưa có thay đổi phạm vi; task được chuyển owner từ Đức sang Bách theo điều chỉnh phân công.
- Việc chưa hoàn thành hoặc trở ngại: chưa thực hiện tài liệu data ownership/fault matrix; chưa có PR hoặc review.
- Bước tiếp theo: thực hiện nội dung W4-T3 trên branch này, sau đó tạo PR và cập nhật metadata theo workflow.
