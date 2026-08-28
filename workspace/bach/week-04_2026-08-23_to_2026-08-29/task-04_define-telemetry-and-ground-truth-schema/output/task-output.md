# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_define-telemetry-and-ground-truth-schema` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 28/08/2026 — chuẩn bị branch, workspace và metadata |
| Hoàn thành thực tế | Chưa finalization; đang chờ review |
| Tổng thời lượng | Chưa tổng kết |
| Pull request | [PR #10](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/10) |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã tạo branch riêng cho W4-T4 theo tên branch trong card.
- Đã tạo hồ sơ input/output trong workspace cá nhân của Bách.
- Đã cập nhật trạng thái và liên kết workspace trong metadata của task.
- Đã hoàn thiện artifact telemetry và ground-truth schema v0 tại vị trí canonical.
- Đã tạo PR #10 và chuyển task sang `Chờ review`; chưa có verdict review hoặc finalization.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Khác | [`input/task-input.md`](../input/task-input.md) |
| Hồ sơ output task | Khác | [`output/task-output.md`](../output/task-output.md) |
| Telemetry và ground-truth schema v0 | Docs | [`telemetry-and-ground-truth-schema-v0.md`](../../../../../docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Schema nêu identity, UTC time, trace/log/metric correlation, resource attributes và coverage/data-quality cho mỗi modality. | Đạt | [`telemetry-and-ground-truth-schema-v0.md`](../../../../../docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md) (mục 3–8). |
| Ground truth có run ID, fault target/type, start/end, parameters, expected symptom và reset/verification metadata. | Đạt | [`telemetry-and-ground-truth-schema-v0.md`](../../../../../docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md) (mục 4, 9–11). |
| Schema ánh xạ được tới service/edge feature và service-level RCA trong AI/RCA blueprint. | Đạt | [`telemetry-and-ground-truth-schema-v0.md`](../../../../../docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md) (mục 12–13). |
| Đức review khả năng instrument/export; field không thể thu được đã được loại hoặc ghi rõ giải pháp. | Chưa đạt | Chưa review. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Đạt | [`telemetry-and-ground-truth-schema-v0.md`](../../../../../docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md) đã được commit/push. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Đạt | [PR #10](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/10); commit metadata này được push vào PR head trước review. |
| Pull request có mô tả đúng quy tắc, verdict `APPROVED` hợp lệ và completion metadata trước merge. | Chưa đạt | PR #10 đã tạo; còn thiếu verdict `APPROVED` hợp lệ và completion metadata. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: chưa có thay đổi phạm vi.
- Việc chưa hoàn thành hoặc trở ngại: chờ Đức review khả năng instrument/export và verdict GitHub hợp lệ; chưa finalization.
- Bước tiếp theo: reviewer thực hiện review trên PR #10; sau `APPROVED` hợp lệ, Bách finalization metadata trên chính PR trước merge.
