# Application ports

## Trách nhiệm

Định nghĩa outbound boundary chỉ khi use case cần persistence, external client hoặc messaging có thể thay implementation/test double.

## Dependency rule

- Được dùng type thuộc domain/application của Course.
- Cấm import implementation từ adapters.

## Task thay thế

Chỉ tạo port cùng use case tiêu thụ nó; không tạo repository interface tổng quát trước nghiệp vụ.
