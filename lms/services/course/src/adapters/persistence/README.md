# Persistence adapters

## Trách nhiệm

Triển khai application persistence port cho PostgreSQL/Redis khi Course bắt đầu sở hữu dữ liệu/cache.

## Dependency rule

- Được dùng database/cache client và map dữ liệu sang domain.
- Cấm làm lộ ORM model ra domain/application hoặc truy cập database của service khác.

## Task thay thế

Task Course nghiệp vụ/database sẽ thêm implementation; task 01 không tạo repository giả.
