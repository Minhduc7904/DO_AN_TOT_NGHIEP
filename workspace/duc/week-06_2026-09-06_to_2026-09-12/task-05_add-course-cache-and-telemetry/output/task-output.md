# Output task: Course cache và telemetry

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-course-cache-and-telemetry` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Cập nhật sau |
| Pull request | [#23](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/23) |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo và sản phẩm

- Đã thêm Redis cache adapter, cache-aside policy và OpenTelemetry metrics/spans tại `lms/services/course/` và `lms/packages/observability/`.
- Unit test cache hit/miss/invalidation/fallback và telemetry assertion đã chạy local. CI [PR #24](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/24/checks) đã chạy Redis/PostgreSQL thực và fresh Compose trên nhánh kế tiếp chứa code task-05.

## Đối chiếu DoD

| Điều kiện | Kết quả | Bằng chứng |
| --- | --- | --- |
| Cache-aside/TTL/invalidation | Đạt | `lms/services/course/README.md`, unit test |
| Hit/miss/failure paths | Đạt | Unit test và W2 E2E trong CI PR #24 |
| HTTP/PG/Redis telemetry | Đạt | Dependency telemetry assertion và CI PR #24 |
| Không rò dữ liệu nhạy cảm | Đạt | Attribute/label assertions và GitGuardian xanh |
| Bách review và PR | Chờ review | PR #23; chưa có verdict GitHub |

## Tồn đọng

- Chờ Bách review; sau approval mới ghi nhận hoàn thành và merge.
