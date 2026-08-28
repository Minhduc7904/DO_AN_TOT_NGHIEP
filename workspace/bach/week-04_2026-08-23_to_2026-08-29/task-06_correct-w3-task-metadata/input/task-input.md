# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_correct-w3-task-metadata` |
| Tên task | Sửa metadata hậu-merge W3-T1 |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 28/08/2026 |
| Thời gian dự kiến | 28/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-06-correct-w3-task-metadata` |
| Pull request dự kiến | Tạo từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Đồng bộ metadata W3-T1 trên nhánh canonical sau khi phát hiện `task-input.md` chưa phản ánh verdict review/finalization, đồng thời loại bỏ wording stale trong output và card task. Toàn bộ correction được đưa vào `main` bằng task/branch/PR W4-T6 riêng.

### Phạm vi không thực hiện

- Không thay đổi `project-scope-v1.md`, quyết định RQ5, kiến trúc hoặc phạm vi nghiên cứu của W3-T1.
- Không bổ sung metadata merge có thể suy ra từ Git/GitHub vào Markdown.
- Không cập nhật metadata của task khác.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Metadata W3-T1 đã sửa | Docs | `workspace/duc/week-03_2026-08-16_to_2026-08-22/task-01_define-mvp-scope/`, card W3-T1 và weekly overview W3 |
| Hồ sơ correction W4-T6 | Docs | Card W4-T6 và workspace Bách |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: W3-T1 đã merge trên `main`, PR #4 và quy tắc Git/pull request.
- Người cần phối hợp: Bách tự review theo ngoại lệ workflow đã được chấp thuận khi Đức bận.
- Rủi ro hoặc giả định: vì PR #4 đã merge, correction không được push vào branch task cũ hoặc đưa vào một commit bookkeeping hậu-merge.

## Definition of Done

- [ ] Input W3-T1 phản ánh trạng thái, PR và DoD thực tế.
- [ ] Output/card W3-T1 không còn trạng thái hoặc bước tiếp theo stale.
- [ ] Weekly overview W3 nhất quán với hồ sơ W3-T1.
- [ ] Diff chỉ chứa correction metadata W3-T1 và hồ sơ W4-T6; `git diff --check` đạt.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi review theo ngoại lệ.
- [ ] Pull request có verdict `APPROVED` và completion metadata W4-T6 được commit/push vào chính PR trước merge.
