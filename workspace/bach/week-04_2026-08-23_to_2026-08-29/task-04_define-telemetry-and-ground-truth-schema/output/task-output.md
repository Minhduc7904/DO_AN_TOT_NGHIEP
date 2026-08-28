# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_define-telemetry-and-ground-truth-schema` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 28/08/2026 — chuẩn bị branch, workspace và metadata |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa xác định |
| Pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã tạo branch riêng cho W4-T4 theo tên branch trong card.
- Đã tạo hồ sơ input/output trong workspace cá nhân của Bách.
- Đã cập nhật trạng thái và liên kết workspace trong metadata của task.
- Chưa thực hiện sản phẩm schema và chưa bắt đầu phần triển khai chính của task.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Khác | [`input/task-input.md`](../input/task-input.md) |
| Hồ sơ output task | Khác | [`output/task-output.md`](../output/task-output.md) |
| Telemetry và ground-truth schema v0 | Docs | Chưa tạo; dự kiến tại `docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Schema nêu identity, UTC time, trace/log/metric correlation, resource attributes và coverage/data-quality cho mỗi modality. | Chưa đạt | Chưa bắt đầu sản phẩm chính. |
| Ground truth có run ID, fault target/type, start/end, parameters, expected symptom và reset/verification metadata. | Chưa đạt | Chưa bắt đầu sản phẩm chính. |
| Schema ánh xạ được tới service/edge feature và service-level RCA trong AI/RCA blueprint. | Chưa đạt | Chưa bắt đầu sản phẩm chính. |
| Đức review khả năng instrument/export; field không thể thu được đã được loại hoặc ghi rõ giải pháp. | Chưa đạt | Chưa review. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Chưa đạt | Chưa tạo sản phẩm chính. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Chưa đạt | Chưa tạo PR. |
| Pull request có mô tả đúng quy tắc, verdict `APPROVED` hợp lệ và completion metadata trước merge. | Chưa đạt | Chưa tạo PR hoặc review. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: chưa có thay đổi phạm vi.
- Việc chưa hoàn thành hoặc trở ngại: chưa thực hiện tài liệu telemetry/ground-truth schema; chưa có PR hoặc review.
- Bước tiếp theo: thực hiện nội dung W4-T4 trên branch này, sau đó tạo PR và cập nhật metadata theo workflow.
