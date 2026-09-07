# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-data-ownership-and-fault-matrix` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành trên branch task — sẵn sàng merge vào `main` theo ngoại lệ workflow Bách đã xác nhận |
| Bắt đầu thực tế | 28/08/2026 — chuẩn bị branch, workspace và metadata |
| Hoàn thành thực tế | 28/08/2026 — Bách đã xác nhận `APPROVED` theo ngoại lệ self-review AI và completion record đã được finalization trên branch task |
| Tổng thời lượng | Trong ngày 28/08/2026 |
| Pull request | [PR #11](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/11) |
| Người review | Bách (AI self-review theo ngoại lệ workflow được xác nhận) |
| Kết quả review | `APPROVED` theo ngoại lệ self-review AI do Bách xác nhận; không có review submission trên GitHub từ Đức |

## Báo cáo công việc đã làm

- Đã tạo branch riêng cho W4-T3 theo tên branch trong card.
- Đã tạo hồ sơ input/output trong workspace cá nhân của Bách.
- Đã cập nhật owner, collaborator, trạng thái và liên kết workspace trong metadata của task.
- Đã hoàn thiện artifact tại vị trí canonical và cross-check với W4-T4 đã merge.
- Đã tạo PR #11, chuyển task sang `Chờ review`, thực hiện self-review bằng AI và finalization metadata theo ngoại lệ workflow Bách đã xác nhận.

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
| Đức review label ground truth/evidence; các rủi ro chưa giải quyết được ghi rõ. | Đạt theo ngoại lệ | Bách xác nhận self-review bằng AI thay cho review từ Đức; artifact đã cross-check ground truth, lineage, RQ4 và guard chống leakage với W4-T4. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Đạt | Artifact đã được commit/push trên nhánh task. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Đạt | [PR #11](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/11); commit `17ea748` đã được push vào PR head trước finalization. |
| Pull request có mô tả đúng quy tắc, verdict `APPROVED` hợp lệ và completion metadata trước merge. | Đạt theo ngoại lệ | PR #11 có mô tả theo template; Bách xác nhận `APPROVED` qua self-review AI. Không có review submission GitHub từ Đức tại thời điểm finalization. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: chưa có thay đổi phạm vi; task được chuyển owner từ Đức sang Bách theo điều chỉnh phân công.
- Việc chưa hoàn thành hoặc trở ngại: không còn tồn đọng trong phạm vi task theo ngoại lệ self-review AI Bách đã xác nhận; PR #11 chưa merge.
- Bước tiếp theo: Bách có thể tự merge PR #11 vào `main` theo quyền ngoại lệ đã xác nhận.

> `Hoàn thành` ở hồ sơ này là trạng thái finalization trên branch task. PR #11 chưa merge vào `main`; ngoại lệ self-review AI do Bách xác nhận được ghi rõ thay cho approval GitHub từ thành viên còn lại.
