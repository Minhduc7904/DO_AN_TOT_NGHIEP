# Đăng nhập và refresh token v1

> **Trạng thái:** Đề xuất — chờ Đức xác nhận.
>
> **Service sở hữu:** `identity` (`identity_db`). Mục lục domain: [README](README.md). Quy tắc và điểm chưa kiểm chứng: [business-rules-v1](business-rules-v1.md).
>
> **Service tham gia:** `gateway`, `identity`. Trace mẫu: luồng `http-login`.

## 1. Đăng nhập ba cửa

Ba cửa đăng nhập cùng một bộ xác thực. Mọi lý do thất bại đều trả **cùng một 401** "Thông tin đăng nhập không hợp lệ", và luôn băm mật khẩu đúng một lần (băm giả khi email không tồn tại), để người ngoài không biết email có tồn tại, bị khóa hay đúng mật khẩu nhưng sai cửa.

```mermaid
flowchart TD
    A["Nhận email + mật khẩu ở cửa vai trò R"] --> B["Tìm tài khoản theo email"]
    B --> C["Băm và so mật khẩu<br/>(băm giả nếu không có tài khoản)"]
    C --> D{"Có tài khoản,<br/>mật khẩu đúng,<br/>ACTIVE, role = R?"}
    D -- Không --> X["401 Thông tin đăng nhập không hợp lệ"]
    D -- Có --> E{"R = student?"}
    E -- Không --> G["Cấp cặp token"]
    E -- Có --> F{"Hồ sơ student<br/>tồn tại và ACTIVE?"}
    F -- Không --> Y["403 Hồ sơ student không hoạt động"]
    F -- Có --> G
    G --> H["access_token EdDSA + refresh_token mới"]
```

Hồ sơ student được đọc cùng truy vấn với tài khoản (cùng `identity_db`), nên đăng nhập student không còn lỗi dependency vì service khác; tài khoản không có hồ sơ hoặc hồ sơ `INACTIVE`/`BLOCKED` nhận 403.

Cặp token:

| Token | Nội dung | TTL mặc định (khoảng cho phép) |
| --- | --- | --- |
| Access token | JWT EdDSA, `typ=user`, `sub`, `role`, `aud=aiops-lms` | 1 giờ (60 giây – 24 giờ), `IDENTITY_JWT_TTL_SECONDS` |
| Refresh token | Chuỗi ngẫu nhiên, chỉ lưu bản băm | 24 giờ (5 phút – 30 ngày), `IDENTITY_REFRESH_TTL_SECONDS` |

## 2. Refresh token

Refresh token **dùng một lần**: câu lệnh xóa và đọc chủ sở hữu là một lệnh SQL, nên hai refresh đồng thời với cùng token chỉ một bên thành công.

```mermaid
flowchart LR
    A["POST refresh"] --> B["Xóa token khỏi bảng<br/>nếu còn hạn"]
    B --> C{"Có chủ sở hữu<br/>và ACTIVE?"}
    C -- Không --> X["401 Refresh token không hợp lệ<br/>hoặc đã hết hạn"]
    C -- Có --> D["Cấp cặp token mới"]
```

Token đã bị xóa thì không dùng lại được, kể cả khi tài khoản `DISABLED` (lần refresh đó vẫn tiêu token).
