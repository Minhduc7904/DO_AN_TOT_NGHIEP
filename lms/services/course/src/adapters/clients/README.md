# External client adapters

## Trách nhiệm

Triển khai outbound HTTP/dependency client khi Course có dependency thực tế.

## Dependency rule

- Được dùng HTTP client và published contract.
- Bắt buộc timeout rõ; cấm import source nội bộ của service khác.

## Task thay thế

Course hiện chưa có outbound service dependency trong task 01 nên không tạo client code.
