# HTTP adapters

## Trách nhiệm

Parse/validate transport input, gọi use case và map output/error thành HTTP response. `/health` là liveness adapter kỹ thuật của task 01.

## Dependency rule

- Được phụ thuộc NestJS HTTP và application use case.
- Cấm chứa persistence query hoặc business decision.

Folder này đã có health implementation; business controller chỉ được thêm cùng published behavior thực tế.
