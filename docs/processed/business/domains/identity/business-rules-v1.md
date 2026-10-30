# Quy tắc nghiệp vụ domain identity v1

> **Trạng thái:** Đề xuất — chờ Đức xác nhận.
>
> **Service sở hữu:** `identity` (`identity_db`). Mục lục domain: [README](README.md). Quy tắc và điểm chưa kiểm chứng: [business-rules-v1](business-rules-v1.md).
>
> **Phụ thuộc:** [ADR-004](../../../adr/adr-004-service-access-token-and-api-surfaces-v1.md), [http-and-event-contracts-v2](../../../architecture/http-and-event-contracts-v2.md).

## 1. Đối tượng và quyền

Tài khoản có một vai trò duy nhất (`student`, `instructor`, `admin`) và trạng thái `ACTIVE` hoặc `DISABLED`. Email được cắt khoảng trắng và đổi chữ thường trước khi lưu hoặc so khớp.

| Endpoint (qua gateway, `/api/v1/auth`) | Ai gọi | Ghi chú |
| --- | --- | --- |
| `POST register` | ẩn danh | Chỉ tạo `student` |
| `POST student/login`, `instructor/login`, `admin/login` | ẩn danh | Mỗi vai trò một cửa |
| `POST refresh` | ẩn danh | Đổi refresh token lấy cặp token mới |
| `GET me` | đã đăng nhập | Thông tin tài khoản hiện tại |
| `POST accounts`, `GET accounts` | `admin` | Tạo `instructor`/`admin`, liệt kê theo vai trò |

## 2. Quy tắc

| Mã | Quy tắc |
| --- | --- |
| BR-IDN-01 | Student tự đăng ký; `instructor` và `admin` chỉ do `admin` tạo qua `POST accounts`. |
| BR-IDN-02 | Email duy nhất trong `identity_users` (sau khi cắt khoảng trắng và đổi chữ thường), do unique index bảo đảm; trùng trả 409. |
| BR-IDN-09 | Đăng ký student tạo tài khoản và hồ sơ student (cùng `id`, cùng `ACTIVE`) trong một transaction; lỗi giữa chừng thì không còn bản ghi nào. |
| BR-IDN-03 | Đăng nhập sai bất kỳ lý do nào đều trả cùng một 401; không lộ tài khoản tồn tại hay thuộc vai trò nào. |
| BR-IDN-04 | Student chỉ đăng nhập được khi hồ sơ student tồn tại và `ACTIVE`; ngược lại 403. |
| BR-IDN-05 | Chỉ tài khoản `ACTIVE` đăng nhập, refresh hoặc gọi `/me` được; `DISABLED` bị từ chối như sai mật khẩu. |
| BR-IDN-06 | Refresh token dùng một lần; mỗi lần refresh cấp refresh token mới. |
| BR-IDN-07 | Mật khẩu chỉ lưu dạng băm scrypt; refresh token chỉ lưu dạng băm. |
| BR-IDN-08 | Gateway từ chối service token ở route người dùng (`TOKEN_TYPE_MISMATCH`). |

## 3. Điểm chưa kiểm chứng

- Không có use case nào đặt `DISABLED` cho tài khoản; trạng thái này hiện chỉ có từ seed hoặc sửa DB trực tiếp.
- Access token đã cấp vẫn dùng được đến hết hạn kể cả khi tài khoản bị `DISABLED`, vì token verify cục bộ và không tra trạng thái (suy ra từ thiết kế, chưa có test).
- Không có use case đổi trạng thái hồ sơ student (`INACTIVE`, `BLOCKED`); chỉ đổi bằng sửa DB.
- Chưa có giới hạn số lần đăng nhập sai hoặc giới hạn tốc độ cho các endpoint đăng nhập và `service-token`.

## 4. Đối chiếu code

| Quy tắc | Code (`lms/services/identity/src`) |
| --- | --- |
| BR-IDN-01, 02, 09 | `application/use-cases/accounts/register-student.use-case.ts`, `create-account.use-case.ts` |
| BR-IDN-03, 05 | `application/use-cases/sessions/credentials-authenticator.ts` |
| BR-IDN-04 | `application/use-cases/sessions/login-student.use-case.ts` (hồ sơ đọc cùng truy vấn tài khoản ở `adapters/persistence/prisma-account.repository.ts`) |
| BR-IDN-06, 07 | `application/use-cases/sessions/refresh-token.use-case.ts`, `application/token-issuer.ts`, `domain/password.ts`, `domain/token.ts` |
| Seed | `adapters/bootstrap/bootstrap.runner.ts`, `application/use-cases/accounts/bootstrap-accounts.use-case.ts` |
| Trace và test hệ thống | luồng `http-login`, `http-register` trong [catalogue](../../../architecture/complex-case-catalogue-and-rca-result-v0.md); `lms/test/observability/support/flow-matrix.mjs` |
