# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-login-workflow` |
| Tên task | Kiểm chứng contract và workflow W1 qua Gateway |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Chưa bắt đầu |
| Ngày tạo | 10/09/2026 |
| Thời gian dự kiến | 11/09/2026 |
| Nhánh thực hiện | `test/week-06/task-03-verify-login-workflow` |
| Pull request dự kiến | PR từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo contract/integration test cho W1 qua Gateway, bao phủ happy path, authentication/authorization failures, Auth timeout, trace propagation và PostgreSQL dependency identity.

### Phạm vi không thực hiện

Không triển khai Course/W2, không đổi contract để né lỗi và không thay assertion tự động bằng quan sát log thủ công.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| W1 contract/integration tests | Code | `lms/test/` hoặc test suite Gateway/Auth canonical |
| Hướng dẫn chạy W1 | Docs | `lms/README.md` hoặc tài liệu liên kết từ Quick Start |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 và task-02 đã merge; Compose/CI baseline Week 5.
- Người cần phối hợp: Đức chạy độc lập và review failure/telemetry path.
- Rủi ro hoặc giả định: test dữ liệu cô lập, chạy lặp lại và không dùng secret thật.

## Definition of Done

- [ ] W1 qua Gateway trả JWT hợp lệ và request bảo vệ chấp nhận token từ seed user.
- [ ] Test credential sai, token hết hạn/sai chữ ký, role không đủ và Auth timeout trả contract canonical.
- [ ] Trace Gateway/Auth liên kết bằng W3C context; `auth-postgres` signal được xác minh khi instrumentation hỗ trợ.
- [ ] Test chạy từ dữ liệu sạch, được đưa vào CI; Đức chạy độc lập và ghi bằng chứng.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
