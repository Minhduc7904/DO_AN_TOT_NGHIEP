# Use cases

## Trách nhiệm

Mỗi use case đại diện một hành vi nghiệp vụ kiểm chứng được và điều phối domain qua port cần thiết.

## Dependency rule

- Được dùng domain và application port.
- Cấm gọi trực tiếp NestJS controller, ORM, HTTP client hoặc message broker.

## Task thay thế

Task Course nghiệp vụ sẽ tạo folder theo hành vi thực tế; không tạo `command/handler/result` máy móc.
