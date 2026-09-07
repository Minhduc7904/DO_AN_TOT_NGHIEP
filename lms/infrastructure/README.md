# LMS runtime infrastructure

## Trách nhiệm

Chứa cấu hình runtime riêng cho PostgreSQL, Redis, RabbitMQ, storage mock và observability backend. Manifest orchestration root đặt tại `docker-compose/` cùng cấp với `lms/`.

## Quy tắc dependency

- Được tham chiếu image, config và runtime artifact của LMS.
- Không chứa business logic hoặc application instrumentation dùng chung.

## Task triển khai

Task 02 tuần 5 tạo manifest trong `docker-compose/` và chỉ thêm dependency subtree tại đây khi có cấu hình riêng cần được Compose tham chiếu; task 03 chỉ tạo application instrumentation trong `lms/packages/observability/`.
