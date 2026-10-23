# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_build-dashboard-and-validate-observability` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 23/10/2026 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa ghi nhận |
| Pull request | Chưa tạo |
| Người review | Chưa có |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Đã tạo nhánh `feat/week-10/task-05-build-dashboard-and-validate-observability` từ `main` tại `9a9afa2` (sau PR #47) và hoàn tất [input](../input/task-input.md). Chưa có thay đổi substantive.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Chưa có | — | — |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Grafana provision ba datasource; dashboard RED theo service/route bounded | Chưa đạt | — |
| HTTP 5xx/timeout: metric → trace → log theo `trace_id`, field nhất quán | Chưa đạt | — |
| `grade.completed`: producer/consumer trace context và log Notification | Chưa đạt | — |
| UTC ISO-8601; resource identity khớp catalogue | Chưa đạt | — |
| Smoke/acceptance trên dữ liệu thật, thất bại rõ khi thiếu modality/field | Chưa đạt | — |
| Không phụ thuộc secret/user ID/label high-cardinality; ghi giới hạn MVP và tồn đọng W11 | Chưa đạt | — |
| URL PR và `Chờ review` trước review; approval và finalization | Chưa đạt | — |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có.
- Việc chưa hoàn thành hoặc trở ngại: Request healthy không có access log (giới hạn từ task-04), cần chốt với Đức có bổ sung ở task riêng hay ghi là giới hạn MVP.
- Bước tiếp theo: Thêm liên kết trace ↔ log vào datasource, provision dashboard service overview, rồi viết acceptance smoke ba modality.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
