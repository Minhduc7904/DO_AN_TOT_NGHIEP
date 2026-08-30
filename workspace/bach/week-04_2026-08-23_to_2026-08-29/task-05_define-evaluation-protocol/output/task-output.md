# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_define-evaluation-protocol` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 30/08/2026 — tạo lại branch và workspace mới |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa ghi nhận |
| Pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Mới hoàn tất bước chuẩn bị branch và workspace cho lần thực hiện mới.
- Chưa tạo hoặc chỉnh sửa artifact evaluation protocol.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Workspace input | Docs | `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol/input/task-input.md` |
| Workspace output | Docs | `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol/output/task-output.md` |
| Evaluation protocol v0 | Docs | Chưa tạo; sẽ tạo sau khi bắt đầu task chính. |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Protocol định nghĩa experiment manifest/metadata, run artifact, cách split theo run và quy tắc freeze test campaign. | Chưa đạt | Chưa bắt đầu triển khai artifact. |
| Có metric detection, RCA service-level và system phù hợp RQ/AI-RCA blueprint, cùng cách xử lý baseline/ablation/robustness MVP. | Chưa đạt | Chưa bắt đầu triển khai artifact. |
| Protocol nêu rõ đầu vào ground truth, thiếu dữ liệu/missing modality và điều kiện tái lập. | Chưa đạt | Chưa bắt đầu triển khai artifact. |
| Đức review khả năng orchestration/lưu artifact; các requirement không khả thi được ghi rõ trước tuần 5. | Chưa đạt | Chưa gửi artifact để review. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Chưa đạt | Artifact chính chưa tạo. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Chưa đạt | PR chưa tạo. |
| Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge. | Chưa đạt | PR chưa tạo và chưa review. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có.
- Việc chưa hoàn thành hoặc trở ngại: Chưa bắt đầu phần triển khai chính.
- Bước tiếp theo: Đọc và đối chiếu các tài liệu phụ thuộc, sau đó xây dựng evaluation protocol v0 theo phạm vi và DoD trong input.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
