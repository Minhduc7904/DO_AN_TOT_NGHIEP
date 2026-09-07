# Task tuần: Khởi tạo cấu trúc repository và service template chạy được

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_scaffold-repository-and-service-template` |
| Tuần | `week-05_2026-08-30_to_2026-09-05` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách review extension point cho telemetry và khả năng tái sử dụng template |
| Ưu tiên | Cao |
| Hạn dự kiến | 01/09/2026 |
| Nhánh thực hiện | `feat/week-05/task-01-scaffold-repository-and-service-template` |

## Yêu cầu và phạm vi

### Cần thực hiện

Khởi tạo phần source code cần thiết của monorepo theo backend blueprint, gồm cấu hình workspace ở repository root và một service NestJS canonical ở mức template. Service phải chạy độc lập, có endpoint `/health`, cấu hình qua environment và cấu trúc đủ để các service tuần sau tái sử dụng mà không tạo abstraction rỗng.

### Không thực hiện

- Không scaffold toàn bộ Gateway và sáu business service trong tuần này.
- Không triển khai business endpoint, database migration hoặc event `grade.completed` của tuần 6 trở đi.
- Không đặt business model dùng chung trong `packages/` và không tạo folder rỗng chỉ để khớp cây blueprint.
- Không tích hợp Compose, OpenTelemetry exporter hoặc CI trong task này; các phần đó thuộc task-02, task-03 và task-04.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: backend blueprint canonical, service catalogue/topology v1 và HTTP/event contracts v1 của tuần 4.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra template có điểm khởi tạo rõ cho `packages/observability/` và không hard-code resource identity sai canonical.
- Rủi ro/giả định: chỉ scaffold module thực sự dùng trong tuần 5; lựa chọn package manager và version runtime phải được khóa để fresh setup tái lập.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Cấu hình monorepo và scripts gốc | Code | Repository root |
| Service NestJS canonical có `/health` | Code | `services/course/` |

## Definition of Done

- [ ] Cài dependency từ repository root trên môi trường sạch thành công bằng đúng một quy trình được tài liệu hóa.
- [ ] Service `course` build và khởi động độc lập; `GET /health` trả kết quả thành công có thể kiểm chứng.
- [ ] Cấu trúc service tuân thủ lightweight hexagonal boundary, không cross-service import và không chứa abstraction/folder rỗng không có nhu cầu thực tế.
- [ ] Root scripts có lệnh nhất quán để build, lint và test service; version runtime/package manager được khóa hoặc kiểm tra rõ.
- [ ] Bách review điểm gắn OpenTelemetry và xác nhận task-03 có thể tích hợp mà không đổi cấu trúc nền.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo.
- Output workspace: Chưa tạo.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 30/08/2026 — task được phân rã và giao theo plan tuần 5.
- Ghi chú/tồn đọng: task-02 và task-03 bắt đầu sau khi cấu trúc nền cùng `/health` có thể chạy cục bộ.
