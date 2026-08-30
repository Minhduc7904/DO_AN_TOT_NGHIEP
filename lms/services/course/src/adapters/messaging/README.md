# Messaging adapters

## Trách nhiệm

Chứa producer/consumer implementation khi Course có event contract thực tế.

## Dependency rule

- Được dùng broker client và published event contract.
- Cấm đặt event business không có producer/consumer hoặc failure mode hợp lệ.

## Task thay thế

Task 01 không có messaging behavior; README chỉ mô tả boundary canonical.
