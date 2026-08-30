# Tổng quan tuần 4

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Nguồn plan canonical | [Plan v0.2 — lộ trình 24 tuần](../../plan-v0.2-24-weeks.md), mục “Tuần 4 — Topology, contracts, telemetry requirement và evaluation protocol v0” |
| Mục tiêu tuần | Chốt topology, contract, dữ liệu/telemetry, fault và evaluation protocol để tuần 5 có thể scaffold repository và Compose mà không phải thay đổi thiết kế nền. |
| Trạng thái tuần | Đang thực hiện |

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_define-service-topology](task-01_define-service-topology.md) | Chốt service catalogue, dependency graph và architecture diagram v1 | Đức | Bách | Cao | Hoàn thành |
| [task-02_define-http-and-event-contracts](task-02_define-http-and-event-contracts.md) | Thiết kế HTTP contract và event `grade.completed` v1 | Đức | Bách | Cao | Hoàn thành |
| [task-03_define-data-ownership-and-fault-matrix](task-03_define-data-ownership-and-fault-matrix.md) | Chốt data ownership, dependency strategy và fault matrix MVP | Bách | Đức | Cao | Hoàn thành |
| [task-04_define-telemetry-and-ground-truth-schema](task-04_define-telemetry-and-ground-truth-schema.md) | Chốt telemetry schema và ground-truth schema v0 | Bách | Đức | Cao | Hoàn thành |
| [task-05_define-evaluation-protocol](task-05_define-evaluation-protocol.md) | Chốt experiment metadata, dataset split và evaluation protocol v0 | Bách | Đức | Cao | Đang thực hiện |

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: scope/backlog/RQ-metrics của tuần 3; backend blueprint và AI/RCA blueprint là source of truth kỹ thuật.
- Rủi ro: contract hoặc telemetry bị thiết kế tách rời; fault matrix không tạo được ground truth/evidence; thêm service/feature ngoài MVP.
- Quyết định cần chốt: 6 business service + Gateway, HTTP/async flow tối thiểu, schema phục vụ analysis và protocol đánh giá phải thống nhất trước tuần 5.

## Tiêu chí kết thúc tuần

- [ ] Có architecture diagram/service catalogue, contract HTTP/event, fault matrix, telemetry/ground-truth schema và evaluation protocol có link mở được.
- [ ] Mỗi artifact dùng đúng scope MVP, có owner/reviewer và không mâu thuẫn blueprint canonical.
- [ ] Đức và Bách đã review chéo HTTP flow, async flow, telemetry export và khả năng evaluation trước khi scaffold code.
