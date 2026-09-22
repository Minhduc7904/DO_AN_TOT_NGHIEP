# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-enrollment-workflow` |
| Tên task | Kiểm chứng E2E login → enroll qua Gateway |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 22/09/2026 |
| Thời gian dự kiến | 1 phiên làm việc |
| Nhánh thực hiện | `test/week-07/task-03-verify-enrollment-workflow` |
| Pull request dự kiến | Sẽ tạo sau khi hoàn tất code + test |

## Mục tiêu và phạm vi

### Task cần làm gì?

Kiểm chứng E2E luồng `login → enroll` qua Gateway với PostgreSQL thực: JWT hợp lệ dùng để tạo enrollment cho seeded course, role hợp lệ/không hợp lệ được kiểm tra, timeout/error path khi Course không sẵn sàng được kiểm tra qua Enrollment. Xác nhận trace xuyên Gateway/Enrollment/Course giữ W3C context. Theo tiền lệ Week 6 (task-06), đây là task thêm Gateway routing cho Enrollment, cập nhật Compose và CI.

### Phạm vi không thực hiện

- Không kiểm chứng luồng nộp bài (Submission); đây thuộc task-06 của Bách.
- Không sửa business contract để né lỗi tích hợp.
- Không coi test riêng lẻ Enrollment (task-01/02) là bằng chứng thay thế cho E2E qua Gateway.
- Không expose `GET /api/v1/enrollments/check` qua Gateway (theo contract v1 §7.3, đây là internal service contract cho Submission).

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E login → enroll và telemetry assertions | Code | `lms/test/w3-postgres-workflow.e2e-spec.ts` |
| Compose/CI cập nhật cho Enrollment | Code / Docs | `docker-compose/`, `.github/workflows/ci.yml` |
| Gateway routing cho Enrollment | Code | `lms/services/gateway/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: nhánh `feat/week-07/task-02-add-enrollment-resilience-and-propagation` (PR #26, chưa merge — task-03 base trực tiếp lên nhánh này); Compose/CI baseline Week 5–6.
- Người cần phối hợp: Bách chạy độc lập luồng `login → enroll` và kiểm tra telemetry (khi Bách rảnh trở lại).
- Rủi ro hoặc giả định: compose startup/readiness và seed ordering (Auth, Course, Enrollment) phải deterministic; môi trường sandbox có container Redis khác của dự án khác đang chiếm cổng 6379/5432 mặc định nên khi verify thủ công phải override port qua biến môi trường, không phải lỗi của compose.yaml.

## Definition of Done

- [ ] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, Enrollment, PostgreSQL theo hướng dẫn không cần bước ngầm.
- [ ] E2E login qua Gateway nhận JWT rồi dùng token tạo enrollment cho seeded course qua Gateway; role hợp lệ/không hợp lệ được kiểm tra.
- [ ] E2E bao phủ ít nhất một Course dependency unavailable/timeout behavior nhìn từ phía Enrollment, với error envelope canonical.
- [ ] Trace `login → enroll` giữ W3C context qua Gateway và downstream; HTTP server/client cùng `enrollment-postgres` signals có assertions phù hợp.
- [ ] CI chạy test cần thiết thành công; kết quả/giới hạn được ghi trong PR hoặc output task.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc; verdict `APPROVED` hợp lệ từ Bách và completion metadata được xử lý ở bước finalization riêng, không thuộc phạm vi input này.
