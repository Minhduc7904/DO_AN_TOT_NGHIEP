# LMS runtime infrastructure

## Trách nhiệm

Chứa Docker Compose và cấu hình runtime cho PostgreSQL, Redis, RabbitMQ, storage mock và observability backend.

## Quy tắc dependency

- Được tham chiếu image, config và runtime artifact của LMS.
- Không chứa business logic hoặc application instrumentation dùng chung.

## Task triển khai

Task 02 tuần 5 sẽ tạo Compose và dependency subtree khi có cấu hình chạy được; task 03 chỉ tạo application instrumentation trong `lms/packages/observability/`.
