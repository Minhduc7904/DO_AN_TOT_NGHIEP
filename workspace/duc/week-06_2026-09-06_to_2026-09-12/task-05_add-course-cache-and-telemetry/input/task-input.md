# Input task: Course cache và telemetry

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-course-cache-and-telemetry` |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-06_2026-09-06_to_2026-09-12` (triển khai bù từ 21/09/2026) |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 21/09/2026 |
| Thời gian dự kiến | 1–2 ngày làm việc chủ động |
| Nhánh thực hiện | `feat/week-06/task-05-add-course-cache-and-telemetry` |
| Pull request dự kiến | Vào `main`, phụ thuộc PR task-04 |

## Mục tiêu và phạm vi

Thêm Redis cache-aside cho read path Course và telemetry HTTP/PostgreSQL/Redis theo schema canonical. Không làm fault injector F1, benchmark hoặc cho service khác đọc Redis.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí |
| --- | --- | --- |
| Redis adapter, cache policy, telemetry và test | Code | `lms/services/course/` |
| Metrics exporter dùng chung | Code | `lms/packages/observability/` |

## Đầu vào và phụ thuộc

- Nhánh task-05 lấy base từ commit task-04 theo chỉ thị của Đức; PR task-04 chưa merge nên PR task-05 là PR xếp chồng.
- Bách review cache semantics, dependency identity và field phục vụ phân tích.
- Redis/PostgreSQL thực và OTLP assertions cần được kiểm chứng trong CI.

## Definition of Done

- [ ] Get/list dùng cache-aside, TTL và invalidation có tài liệu; PostgreSQL là nguồn dữ liệu chuẩn.
- [ ] Test hit, miss, create invalidation, Redis unavailable/timeout và PostgreSQL error.
- [ ] HTTP, `course-postgres`, `course-redis` spans/metrics có identity/status/duration/error phù hợp.
- [ ] Telemetry không chứa secret, JWT, PII, truth label hoặc metric label cardinality cao.
- [ ] Bách kiểm tra telemetry assertions; PR riêng có URL/trạng thái `Chờ review` push vào head trước review.
