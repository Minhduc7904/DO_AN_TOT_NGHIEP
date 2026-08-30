# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_create-literature-matrix` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | Chưa được người phụ trách ghi nhận |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Chưa ghi nhận |
| Pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Đã setup branch/workspace và bổ sung literature matrix v0. Artifact tổng hợp 11 nguồn truy xuất được, shortlist baseline cho MVP, ánh xạ với RQ/metric v1 và đánh giá khả thi theo fault/telemetry canonical. Chưa có review của Đức hoặc pull request tại thời điểm ghi nhận này.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Workspace metadata | `workspace/bach/week-03_2026-08-16_to_2026-08-22/task-05_create-literature-matrix/input/task-input.md` |
| Hồ sơ output task | Workspace metadata | `workspace/bach/week-03_2026-08-16_to_2026-08-22/task-05_create-literature-matrix/output/task-output.md` |
| Literature matrix v0 | Docs | `docs/processed/plan/literature-matrix-v0.md` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Matrix có tối thiểu 8 nguồn truy xuất được và metadata tối thiểu | Đạt | `literature-matrix-v0.md`, phần 2: L1–L11 có tác giả/năm, DOI hoặc link, bài toán, telemetry/input, phương pháp, metric và giới hạn |
| Matrix có các nhóm baseline cần cho MVP | Đạt | `literature-matrix-v0.md`, phần 3 có threshold/z-score hoặc robust z-score, Isolation Forest, RCA dependency/temporal và evaluation |
| Mỗi baseline được gắn với RQ/metric v1 và nhận xét tính khả thi | Đạt | `literature-matrix-v0.md`, phần 3–5 ánh xạ RQ/metric và fault/telemetry feasibility |
| Đức đã review tính khả thi của data, fault scenario và telemetry | Chưa thực hiện | Chưa bắt đầu vòng review |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head | Chưa thực hiện | Chưa tạo PR |
| PR có approval hợp lệ và completion metadata trước merge | Chưa thực hiện | Chưa tạo PR |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không có thay đổi phạm vi.
- Việc chưa hoàn thành hoặc trở ngại: cần Đức review tính khả thi của data, fault scenario và telemetry; PR chưa tạo.
- Bước tiếp theo: push artifact, tạo PR và chuyển task sang `Chờ review` trên PR head.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
