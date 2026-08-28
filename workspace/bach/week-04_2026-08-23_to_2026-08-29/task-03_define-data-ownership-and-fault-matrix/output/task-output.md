# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-data-ownership-and-fault-matrix` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 28/08/2026 — chuẩn bị branch, workspace và metadata |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa xác định |
| Pull request | [PR #11](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/11) |
| Người review | Bách (AI self-review theo xác nhận của người phụ trách) |
| Kết quả review | Đang chờ finalization metadata |

## Báo cáo công việc đã làm

- Đã tạo branch riêng cho W4-T3 theo tên branch trong card.
- Đã tạo hồ sơ input/output trong workspace cá nhân của Bách.
- Đã cập nhật owner, collaborator, trạng thái và liên kết workspace trong metadata của task.
- Đã hoàn thiện artifact tại vị trí canonical và cross-check với W4-T4 đã merge.
- Đã tạo PR #11 và chuyển task sang `Chờ review`; finalization metadata sẽ được ghi ở commit kế tiếp.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Khác | [`input/task-input.md`](../input/task-input.md) |
| Hồ sơ output task | Khác | [`output/task-output.md`](../output/task-output.md) |
| Data ownership và fault matrix MVP | Docs | [`data-ownership-and-fault-matrix-v1.md`](../../../../../docs/processed/architecture/data-ownership-and-fault-matrix-v1.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Có bảng ownership cho PostgreSQL logical database, Redis, RabbitMQ và storage mock; không có database access chéo. | Đạt | [`data-ownership-and-fault-matrix-v1.md`](../../../../../docs/processed/architecture/data-ownership-and-fault-matrix-v1.md) (mục 2–4). |
| Fault matrix có tối thiểu năm scenario MVP với đủ target, injector/hook, workload, ground truth, symptom/propagation và reset/verification. | Đạt | [`data-ownership-and-fault-matrix-v1.md`](../../../../../docs/processed/architecture/data-ownership-and-fault-matrix-v1.md) (mục 5–7). |
| Mỗi fault có thể ánh xạ tới service-level RCA evaluation và không vượt scope MVP. | Đạt | [`data-ownership-and-fault-matrix-v1.md`](../../../../../docs/processed/architecture/data-ownership-and-fault-matrix-v1.md) (mục 6–8). |
| Đức review label ground truth/evidence; các rủi ro chưa giải quyết được ghi rõ. | Chưa đạt | Chưa review. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Đạt | Artifact đã được commit/push trên nhánh task. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Đang cập nhật | PR #11 đã tạo; transition `Chờ review` nằm trong commit metadata hiện tại. |
| Pull request có mô tả đúng quy tắc, verdict `APPROVED` hợp lệ và completion metadata trước merge. | Chưa đạt | Chưa tạo PR hoặc review. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: chưa có thay đổi phạm vi; task được chuyển owner từ Đức sang Bách theo điều chỉnh phân công.
- Việc chưa hoàn thành hoặc trở ngại: chờ commit/push transition `Chờ review`, sau đó ghi completion metadata theo approval AI Bách đã xác nhận.
- Bước tiếp theo: finalization metadata trên chính PR #11 trước merge.
