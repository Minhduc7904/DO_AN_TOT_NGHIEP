# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_publish-grade-completed-event` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 08/10/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa tổng kết |
| Pull request | Chưa tạo |
| Người review | Chưa có |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Khởi tạo hồ sơ task, chuyển card và `weekly-overview.md` sang `Đang thực hiện`.
- Timeline/JSON chờ đồng bộ bằng Windows PowerShell: `tools/sync-plan-json-and-timeline.ps1` không chạy được trên Linux (đã biết từ task-04); Đức chỉ thị tiếp tục, không sửa tay JSON/timeline và không commit timeline sinh lại.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
|  | Code |  |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Publish đúng `grade.completed` v1 | Chưa đạt | Đang thực hiện |
| Failure/retry không tạo grade hoặc event ID trùng | Chưa đạt | Đang thực hiện |
| Span/metrics/logs và headers tương thích | Chưa đạt | Đang thực hiện |
| Integration test RabbitMQ thật, config/CI | Chưa đạt | Đang thực hiện |
| URL/số PR và `Chờ review` đã commit/push | Chưa đạt | Chưa tạo PR |
| PR đúng quy tắc, `APPROVED`, completion metadata | Chưa đạt | Chưa tạo PR |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: chưa có.
- Việc chưa hoàn thành hoặc trở ngại: toàn bộ DoD đang thực hiện.
- Bước tiếp theo: triển khai publication state, publisher, worker, test và wiring Compose/CI.
