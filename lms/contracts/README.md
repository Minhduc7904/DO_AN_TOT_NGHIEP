# Published contracts

## Trách nhiệm

Chứa HTTP và event contract đã publish để service hoặc client tích hợp mà không import source nội bộ của nhau.

## Quy tắc dependency

- Contract chỉ mô tả wire format, version và compatibility rule.
- Không chứa controller, persistence model hoặc business implementation.

## Task triển khai

Subtree `http/` và `events/` chỉ được tạo khi contract tuần 4 bắt đầu được đưa vào code ở task triển khai tương ứng.
