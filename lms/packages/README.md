# Shared technical packages

## Trách nhiệm

Chứa technical primitive thực sự được nhiều service dùng, ví dụ OpenTelemetry bootstrap hoặc test utility.

## Quy tắc dependency

- Được phụ thuộc thư viện kỹ thuật cần thiết.
- Không được chứa business entity, business repository base class hoặc source code của service.

## Task triển khai

Task 03 tuần 5 sẽ tạo `observability/` khi có implementation thật. Không tạo package rỗng trước thời điểm đó.
