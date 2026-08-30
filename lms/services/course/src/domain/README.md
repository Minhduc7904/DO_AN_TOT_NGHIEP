# Domain layer

## Trách nhiệm

Chứa business entity, value object, domain error và invariant của Course khi nghiệp vụ được triển khai.

## Dependency rule

- Chỉ dùng TypeScript và domain primitive của chính Course.
- Cấm phụ thuộc NestJS, HTTP, database, application, adapter hoặc service khác.

## Task thay thế

Task triển khai Course nghiệp vụ sẽ thêm code thật và cập nhật README này. Hiện tại không tạo entity/value object giả.
