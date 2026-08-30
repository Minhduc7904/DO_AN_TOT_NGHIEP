# Tổng quan tuần 3

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-03_2026-08-16_to_2026-08-22` |
| Nguồn plan canonical | [Plan v0.2 — lộ trình 24 tuần](../../plan-v0.2-24-weeks.md), mục “Tuần 3 — Scope, research questions và backlog” |
| Mục tiêu tuần | Chuyển architecture baseline v1 thành phạm vi MVP, backlog triển khai, research questions/metrics, risk register và literature matrix có thể dùng để vào tuần 4. |
| Trạng thái tuần | Đang thực hiện |

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_define-mvp-scope](task-01_define-mvp-scope.md) | Chốt scope và out-of-scope MVP | Đức | Bách | Cao | Hoàn thành |
| [task-02_create-implementation-backlog](task-02_create-implementation-backlog.md) | Lập backlog triển khai tuần 3–22 | Đức | Bách | Cao | Đã giao |
| [task-03_define-research-questions-and-metrics](task-03_define-research-questions-and-metrics.md) | Chốt research questions và metric đánh giá | Bách | Đức | Cao | Hoàn thành |
| [task-04_create-risk-register](task-04_create-risk-register.md) | Lập risk register và quy tắc giảm scope | Bách | Đức | Trung bình | Đã giao |
| [task-05_create-literature-matrix](task-05_create-literature-matrix.md) | Tổng hợp literature matrix cho baseline/phương pháp | Bách | Đức | Trung bình | Chờ review |

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: mọi task dùng [định hướng tổng thể](../../../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md), [backend blueprint](../../../architecture/backend_microservice_testbed_blueprint.md) và [AI/RCA blueprint](../../../architecture/analysis-anomaly-rca-blueprint.md) làm baseline; không định nghĩa kiến trúc cạnh tranh.
- Rủi ro: thêm feature LMS hoặc model ngoài MVP làm chậm mốc testbed; metric/RQ không ánh xạ được tới telemetry, fault và ground truth thực tế.
- Quyết định cần chốt: scope MVP, danh sách baseline được đánh giá và thứ tự backlog phải được cả hai người review trước khi kết thúc tuần.

## Tiêu chí kết thúc tuần

- [ ] Scope/out-of-scope, backlog, research questions/metrics, risk register và literature matrix đều có file sản phẩm mở được.
- [ ] Backlog tuần 3–22 gắn được với milestone và module canonical; không có hạng mục MVP chưa có owner hoặc tiêu chí nghiệm thu.
- [ ] Mỗi người đã review chéo phần việc của người còn lại và các tồn đọng cho tuần 4 được ghi rõ.
