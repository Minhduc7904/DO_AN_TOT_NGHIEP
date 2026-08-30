# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_define-evaluation-protocol` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 30/08/2026 — tạo lại branch và workspace mới |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa ghi nhận |
| Pull request | [PR #14](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/14) |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Mới hoàn tất bước chuẩn bị branch và workspace cho lần thực hiện mới.
- Đã hoàn thiện evaluation protocol v0 với experiment/evaluation manifest, campaign identity, split theo `run_id`, train/validation/test boundary và quy tắc freeze final test.
- Đã mô tả metric detection, RCA service-level, system/trade-off, baseline/ablation/robustness MVP, ground-truth/missing-modality gate, artifact lineage và reproducibility.
- Đã commit/push artifact substantive và tạo PR #14 vào `main`.
- Chưa có review của Đức.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Workspace input | Docs | `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol/input/task-input.md` |
| Workspace output | Docs | `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol/output/task-output.md` |
| Evaluation protocol v0 | Docs | `docs/processed/architecture/evaluation-protocol-v0.md` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Protocol định nghĩa experiment manifest/metadata, run artifact, cách split theo run và quy tắc freeze test campaign. | Đạt | `docs/processed/architecture/evaluation-protocol-v0.md`, mục 3, 5, 6, 19–22 và 24. |
| Có metric detection, RCA service-level và system phù hợp RQ/AI-RCA blueprint, cùng cách xử lý baseline/ablation/robustness MVP. | Đạt | `docs/processed/architecture/evaluation-protocol-v0.md`, mục 10–18, 20 và 24. |
| Protocol nêu rõ đầu vào ground truth, thiếu dữ liệu/missing modality và điều kiện tái lập. | Đạt | `docs/processed/architecture/evaluation-protocol-v0.md`, mục 3, 8, 9, 13, 19–21 và 24. |
| Đức review khả năng orchestration/lưu artifact; các requirement không khả thi được ghi rõ trước tuần 5. | Chưa đạt | Mục 23 đã chuẩn bị checklist; chờ Đức xác nhận trên PR. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập. | Đạt | Artifact đã được push trong commit `0f23444` tại `docs/processed/architecture/evaluation-protocol-v0.md`. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review. | Đạt | PR #14 và trạng thái `Chờ review` được ghi nhận trong lifecycle commit trên chính PR head trước khi request review. |
| Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge. | Chưa đạt | PR chưa tạo và chưa review. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Đã tạo artifact theo đúng vị trí dự kiến, mở PR #14 và chuyển task sang `Chờ review`.
- Việc chưa hoàn thành hoặc trở ngại: Chưa có review của Đức về khả năng orchestration/lưu artifact và verdict `APPROVED`.
- Bước tiếp theo: Commit/push lifecycle metadata lên PR head, sau đó request Đức review PR #14.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
