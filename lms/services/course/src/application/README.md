# Application layer

## Trách nhiệm

Điều phối use case và định nghĩa outbound boundary cần thiết cho nghiệp vụ Course.

## Dependency rule

- Chỉ phụ thuộc domain và port của chính Course.
- Cấm phụ thuộc NestJS, HTTP controller, persistence hoặc external client implementation.

## Task thay thế

Task triển khai Course nghiệp vụ sẽ thêm use case thật; không tạo class trung gian khi chưa có hành vi.
