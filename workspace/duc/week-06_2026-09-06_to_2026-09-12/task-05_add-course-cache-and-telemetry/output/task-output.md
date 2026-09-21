# Output task: Course cache và telemetry

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-course-cache-and-telemetry` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Cập nhật sau |
| Pull request | [#23](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/23) (draft) |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo và sản phẩm

- Đã thêm Redis cache adapter, cache-aside policy và OpenTelemetry metrics/spans tại `lms/services/course/` và `lms/packages/observability/`.
- Unit test cache hit/miss/invalidation/fallback và telemetry assertion đã chạy local; kiểm chứng Redis thực chưa có do Docker Engine không phản hồi.

## Đối chiếu DoD

| Điều kiện | Kết quả | Bằng chứng |
| --- | --- | --- |
| Cache-aside/TTL/invalidation | Đang kiểm tra | `lms/services/course/README.md`, unit test |
| Hit/miss/failure paths | Đang kiểm tra | Unit test; chờ Redis integration |
| HTTP/PG/Redis telemetry | Đang kiểm tra | Dependency telemetry assertion |
| Không rò dữ liệu nhạy cảm | Đang kiểm tra | Attribute/label assertions |
| Bách review và PR | Chưa đạt | PR #23 draft; chưa review |

## Tồn đọng

- Kiểm chứng Redis thực/CI và xin Bách review sau khi PR head sẵn sàng.
