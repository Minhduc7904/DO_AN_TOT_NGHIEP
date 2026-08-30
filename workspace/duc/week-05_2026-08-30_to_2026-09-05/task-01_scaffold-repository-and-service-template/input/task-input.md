# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_scaffold-repository-and-service-template` |
| Tên task | Khởi tạo cấu trúc repository và service template chạy được |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 30/08/2026 |
| Thời gian dự kiến | 01 ngày làm việc |
| Nhánh thực hiện | `feat/week-05/task-01-scaffold-repository-and-service-template` |
| Pull request dự kiến | Chưa tạo |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo backend workspace pnpm tại `lms/`, scaffold service NestJS Course theo lightweight Clean Architecture, cung cấp `GET /health`, cấu hình environment có validation, Dockerfile và bộ kiểm tra build/lint/unit/E2E. Các boundary chưa có code được mô tả bằng README để nhóm quan sát cấu trúc mà không tạo implementation giả.

### Phạm vi không thực hiện

- Không tạo code cho Gateway hoặc service khác.
- Không triển khai business endpoint, database, Redis, RabbitMQ, Compose, CI hoặc OpenTelemetry.
- Không tạo shared business model, abstraction rỗng, cross-service import hoặc code placeholder.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Backend pnpm workspace | Code | [`lms/`](../../../../../lms/) |
| Course service template và `/health` | Code | [`lms/services/course/`](../../../../../lms/services/course/) |
| Hướng dẫn cấu trúc, chạy và kiểm tra | Docs | `lms/README.md` và `lms/services/course/README.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: backend blueprint, service catalogue/topology v1 và HTTP/event contracts v1.
- Người cần phối hợp: Bách review dependency direction và điểm tích hợp cho `lms/packages/observability/`.
- Rủi ro hoặc giả định: dùng Node `22.13.1`, pnpm `11.19.0`, NestJS `12.0.x`; Docker daemon có thể không khả dụng trên mọi máy.

## Definition of Done

- [ ] `pnpm --dir lms install --frozen-lockfile`, lint, format check, unit test, E2E và build đều thành công.
- [ ] `GET /health` trả `200`, `status=ok`, timestamp UTC ISO-8601; route không tồn tại trả `404`.
- [ ] Docker image build từ context `lms/`, chạy non-root và health endpoint hoạt động trên port cấu hình.
- [ ] Dependency direction được ESLint kiểm tra; mọi boundary placeholder có README và không chứa code giả.
- [ ] Cài đặt và kiểm tra lại được từ checkout sạch bằng quy trình trong README.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
