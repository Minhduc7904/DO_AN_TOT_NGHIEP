# Nghiệp vụ domain identity

> **Service sở hữu:** `identity` (gộp `auth` và `student`, [ADR-005](../../../adr/adr-005-merge-auth-student-into-identity-v1.md))

| Tài liệu | Nội dung | Trạng thái |
| --- | --- | --- |
| [student-registration-v1](student-registration-v1.md) | Đăng ký student bằng một transaction cục bộ tạo tài khoản và hồ sơ, email trùng | Đề xuất — chờ Đức xác nhận |
| [login-v1](login-v1.md) | Đăng nhập ba cửa, cặp token, refresh token dùng một lần | Đề xuất — chờ Đức xác nhận |
| [bootstrap-v1](bootstrap-v1.md) | Khởi động và seed client dịch vụ, tài khoản (trước khi listen) | Đề xuất — chờ Đức xác nhận |
| [service-token-expiry-v1](../../workflows/service-token-expiry-v1.md) | Service token, JWKS, khoảng yên lặng khi `identity` lỗi (luồng xuyên service) | Đề xuất — chờ Đức xác nhận |
| [business-rules-v1](business-rules-v1.md) | Quyền theo endpoint, quy tắc `BR-IDN-*`, điểm chưa kiểm chứng, đối chiếu code | Đề xuất — chờ Đức xác nhận |
