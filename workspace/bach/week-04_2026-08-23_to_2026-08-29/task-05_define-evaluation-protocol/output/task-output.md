# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_define-evaluation-protocol` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 30/08/2026 — setup workspace và nhánh task |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa tổng hợp; chờ review và finalization để chốt. |
| Pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã tạo workspace input/output và nhánh riêng cho task.
- Đã hoàn thiện evaluation protocol v0: manifest/identity, split theo `run_id`, ranh giới train/validation/test, freeze final test, metric detection/RCA/system, baseline/ablation/robustness, artifact lineage và reproducibility.
- Đã giữ nguyên authority boundary với topology, contract, fault matrix, telemetry/ground truth schema và RQ/metric canonical.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Workspace input | Docs | `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol/input/task-input.md` |
| Workspace output | Docs | `workspace/bach/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol/output/task-output.md` |
| Evaluation protocol v0 | Docs | `docs/processed/architecture/evaluation-protocol-v0.md` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Protocol định nghĩa experiment manifest/metadata, run artifact, cách split theo run và quy tắc freeze test campaign. | Đạt | `evaluation-protocol-v0.md`, mục 3, 5, 6, 19–22. |
| Có metric detection, RCA service-level và system phù hợp RQ/AI-RCA blueprint, cùng cách xử lý baseline/ablation/robustness MVP. | Đạt | `evaluation-protocol-v0.md`, mục 10–18 và 20. |
| Protocol nêu rõ đầu vào ground truth, thiếu dữ liệu/missing modality và điều kiện tái lập. | Đạt | `evaluation-protocol-v0.md`, mục 3, 8, 9, 13 và 19–21. |
| Đức review khả năng orchestration/lưu artifact; các requirement không khả thi được ghi rõ trước tuần 5. | Chưa đạt | Chờ Đức review mục 23 của artifact trên pull request. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có.
- Việc chưa hoàn thành hoặc trở ngại: Chưa có review của Đức về tính khả thi orchestration/lưu artifact.
- Bước tiếp theo: Push artifact, mở pull request và ghi trạng thái `Chờ review` cùng URL PR vào chính PR head.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
