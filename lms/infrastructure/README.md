# LMS runtime infrastructure

## Trách nhiệm

Dành cho cấu hình runtime riêng của hạ tầng LMS (PostgreSQL, RabbitMQ, MinIO, Mailpit) khi Compose cần tham chiếu; hiện chưa có cấu hình nào, vì khởi tạo PostgreSQL nằm ở `docker-compose/postgres-init/`. Observability backend đã chuyển sang [`../../aiops-platform/observability/`](../../aiops-platform/observability/). Manifest orchestration root đặt tại `docker-compose/` cùng cấp với `lms/`.

## Quy tắc dependency

- Được tham chiếu image, config và runtime artifact của LMS.
- Không chứa business logic hoặc application instrumentation dùng chung.

## Task triển khai

Task 02 tuần 5 tạo manifest trong `docker-compose/` và chỉ thêm dependency subtree tại đây khi có cấu hình riêng cần được Compose tham chiếu; task 03 chỉ tạo application instrumentation trong `lms/packages/observability/`.
