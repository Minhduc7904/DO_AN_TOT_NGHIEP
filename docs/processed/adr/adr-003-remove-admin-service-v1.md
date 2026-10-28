# ADR-003 — Bỏ service `admin`

| Trường            | Nội dung                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| Trạng thái        | Đề xuất (Đức tự thực hiện, không cần Bách review)                                |
| Ngày              | 27/10/2026                                                                       |
| Người đề xuất     | Đức                                                                              |
| Thay thế một phần | Quyết định 1 của [ADR-001](adr-001-restructure-lms-testbed-v1.md) (bộ 9 service) |

## Bối cảnh

ADR-001 giữ service `admin` để khớp repo mẫu. Khi triển khai R-04 thấy service này không có dữ liệu và không có nghiệp vụ: không có database, chỉ đọc `ADMIN_IDS`/`ADMIN_DISPLAY_NAME` từ môi trường để trả `GET /internal/v1/admins/{id}`, và chỉ `media` gọi để "kiểm tra actor admin". Role `admin` đã nằm trong JWT do `auth` phát và Gateway đã xác thực; tài khoản admin có ở `auth_users`. Các service khác (ví dụ `course` với `instructor_id`) cũng tin JWT, không kiểm tra tồn tại của actor.

## Quyết định

1. Bỏ service `admin`: còn **8 service + 3 worker**. Admin là tài khoản role `admin` trong `auth`, tạo bằng bootstrap hoặc `POST /api/v1/auth/accounts`.
2. Bỏ route `/api/v1/admins` và `/internal/v1/admins/{id}`. `media` không gọi `admin`; quyền admin dựa vào `x-principal-role` do Gateway đặt (header này chỉ được tin khi request mang service token của Gateway, xem [ADR-004](adr-004-service-access-token-and-api-surfaces-v1.md)).
3. Giữ `student` là service riêng vì có dữ liệu và là dependency của `notification-worker`, `media` và `auth` (xem lập luận trong phiên thiết kế R-04).
4. Bỏ hai edge `gateway → admin` và `media → admin`; đánh lại số edge thành `e01–e24`.

## Hệ quả

- `service-catalogue-v2`, `http-and-event-contracts-v2`, `data-ownership-v2` và bảng task refactor được cập nhật cùng PR này; không còn `service.name` `admin` trong candidate set RCA.
- Chưa có code của `admin` nên không phải xóa code. Số dependency identity không đổi (15), số workflow không đổi.
- Mất một service cho nhiều bước nhảy trong trace; được bù bằng các chuỗi đã có (W5 chạm 5 service/worker).

## Phương án đã loại

- Giữ `admin` như repo mẫu: tốn một service, một Dockerfile, một healthcheck, một identity để vận hành mà không tạo thêm tín hiệu cho RCA.
- Chuyển `admin` thành module của `auth` với route riêng: không cần, vì `auth` đã có `GET /api/v1/auth/accounts` cho admin.
