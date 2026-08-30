# Business services

## Trách nhiệm

Chứa Gateway và các LMS business service deploy độc lập. Mỗi service sở hữu source code, runtime configuration, Dockerfile và test của chính nó.

## Quy tắc dependency

- Được dùng shared technical package và published contract dưới `lms/packages/` hoặc `lms/contracts/`.
- Không được import controller, entity, repository hoặc source code của service khác.
- Không đặt business model dùng chung tại workspace root.

## Thay thế README

README này tiếp tục giữ vai trò quy ước chung khi các service mới được tạo từ task tuần tương ứng.
