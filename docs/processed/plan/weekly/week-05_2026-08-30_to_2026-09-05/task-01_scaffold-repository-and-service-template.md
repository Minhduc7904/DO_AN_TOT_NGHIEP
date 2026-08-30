# Task tuần: Khởi tạo cấu trúc repository và service template chạy được

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_scaffold-repository-and-service-template` |
| Tuần | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Đức |
| Collaborator | Bách review extension point cho telemetry và khả năng tái sử dụng template |
| Ưu tiên | Cao |
| Hạn dự kiến | 01/09/2026 |
| Nhánh thực hiện | `feat/week-05/task-01-scaffold-repository-and-service-template` |

## Yêu cầu và phạm vi

### Cần thực hiện

Khởi tạo backend workspace pnpm tại `lms/` theo backend blueprint và một service NestJS canonical ở mức template. Service phải chạy độc lập, có endpoint `/health`, cấu hình qua environment và cấu trúc đủ để các service tuần sau tái sử dụng. Boundary chưa có implementation chỉ được giữ bằng README mô tả trách nhiệm và dependency rule, không chứa code giả.

### Không thực hiện

- Không scaffold toàn bộ Gateway và sáu business service trong tuần này.
- Không triển khai business endpoint, database migration hoặc event `grade.completed` của tuần 6 trở đi.
- Không đặt business model dùng chung trong `lms/packages/`; không tạo interface, entity hoặc implementation giả chỉ để lấp folder minh họa.
- Không tích hợp Compose, OpenTelemetry exporter hoặc CI trong task này; các phần đó thuộc task-02, task-03 và task-04.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: backend blueprint canonical, service catalogue/topology v1 và HTTP/event contracts v1 của tuần 4.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra template có điểm khởi tạo rõ cho `lms/packages/observability/` và không hard-code resource identity sai canonical.
- Rủi ro/giả định: chỉ scaffold module thực sự dùng trong tuần 5; lựa chọn package manager và version runtime phải được khóa để fresh setup tái lập.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Cấu hình monorepo và scripts gốc | Code | `lms/` |
| Service NestJS canonical có `/health` | Code | `lms/services/course/` |

## Definition of Done

- [ ] Cài dependency cho `lms/` từ môi trường sạch thành công bằng đúng một quy trình được tài liệu hóa.
- [ ] Service `course` build và khởi động độc lập; `GET /health` trả kết quả thành công có thể kiểm chứng.
- [ ] Cấu trúc service tuân thủ lightweight hexagonal boundary, không cross-service import; mọi boundary placeholder có README và không chứa abstraction/code giả.
- [ ] Root scripts có lệnh nhất quán để build, lint và test service; version runtime/package manager được khóa hoặc kiểm tra rõ.
- [ ] Bách review điểm gắn OpenTelemetry và xác nhận task-03 có thể tích hợp mà không đổi cấu trúc nền.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-05_2026-08-30_to_2026-09-05/task-01_scaffold-repository-and-service-template/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-05_2026-08-30_to_2026-09-05/task-01_scaffold-repository-and-service-template/output/task-output.md).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 30/08/2026 — Đức bắt đầu triển khai backend workspace `lms/` và service template Course.
- Cập nhật kỹ thuật: frozen install, lint, format check, 6 unit test, 2 E2E test, build, start và health probe đã đạt cục bộ; fresh setup trong bản sao sạch cũng đạt.
- Ghi chú/tồn đọng: Docker daemon chưa chạy nên chưa có runtime evidence cho image/non-root/health; chưa có PR và review của Bách.
