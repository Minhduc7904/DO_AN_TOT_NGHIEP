# Adapter layer

## Trách nhiệm

Chuyển đổi HTTP, persistence, messaging và external protocol thành lời gọi application hoặc implementation của application port.

## Dependency rule

- Được dùng NestJS/framework cần thiết và phụ thuộc application/domain.
- Cấm để business rule nằm trong controller, repository hoặc client adapter.

README này tiếp tục giữ vai trò quy ước khi adapter mới được thêm.
