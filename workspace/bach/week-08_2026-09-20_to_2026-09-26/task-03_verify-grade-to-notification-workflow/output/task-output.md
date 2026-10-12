# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                                          |
| ------------------ | ----------------------------------------------------------------- |
| Mã task            | `task-03_verify-grade-to-notification-workflow`                   |
| Người phụ trách    | Bách                                                              |
| Trạng thái         | Chờ review                                                        |
| Bắt đầu thực tế    | 12/10/2026                                                        |
| Hoàn thành thực tế | Chưa hoàn thành                                                   |
| Tổng thời lượng    | Đang thực hiện, chưa tổng kết                                     |
| Pull request       | [PR #36](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/36) |
| Người review       | Đức (dự kiến)                                                     |
| Kết quả review     | Chưa review                                                       |

## Báo cáo công việc đã làm

- Mở rộng W5 E2E để chạy xuyên Gateway → Grading → Submission → PostgreSQL → RabbitMQ → Notification thay vì chỉ quan sát event publisher.
- Xác nhận Notification chỉ tạo một kết quả mô phỏng `accepted`; hai delivery trùng cùng `event_id` cho kết quả `duplicate` và không tạo notification thứ hai.
- Kiểm chứng cùng một W3C trace đi qua HTTP, Grading publisher, RabbitMQ consumer và Notification processing; đồng thời kiểm tra topology bằng span/metric của cả HTTP và queue.
- Bổ sung scenario fault opt-in `test:w5:postgres:slowdown`: mặc định không chạy, khi bật tạo RabbitMQ backlog quan sát được rồi drain hết bằng polling có timeout, không dùng sleep cố định.
- Bổ sung assertion envelope cho các lỗi chính `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND` và `CONFLICT`.
- Đã commit/push substantive work, tạo [PR #36](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/36) và chuyển hồ sơ sang `Chờ review` trên PR head.

## Sản phẩm thực tế

| Sản phẩm                  | Loại     | Link hoặc đường dẫn                                                                                                 |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Input task                | Tài liệu | `workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/input/task-input.md` |
| Branch task               | Khác     | `test/week-08/task-03-verify-grade-to-notification-workflow`                                                        |
| Pull request              | Khác     | [PR #36](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/36)                                                   |
| W5 integration/E2E test   | Code     | `lms/test/w5-postgres-workflow.e2e-spec.ts`                                                                         |
| Lệnh chạy slowdown opt-in | Code     | `lms/package.json` — `test:w5:postgres:slowdown`                                                                    |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                  | Kết quả    | Bằng chứng                                                                                                                                     |
| ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| W5 chạy từ dữ liệu sạch đến Notification và kiểm tra error envelope | Đạt cục bộ | `pnpm run test:w5:postgres`: 4 test đạt, 1 scenario slowdown opt-in được skip; test kiểm tra một kết quả `accepted` và các envelope chính      |
| HTTP và RabbitMQ topology cùng async correlation được kiểm chứng    | Đạt cục bộ | W5 E2E kiểm tra client/server/producer/consumer/process span cùng `trace_id`, cùng các metric dependency/messaging của Grading và Notification |
| Duplicate event và fault slowdown/backlog được kiểm chứng           | Đạt cục bộ | Duplicate cho chuỗi `accepted`, `duplicate`, `duplicate`; `pnpm run test:w5:postgres:slowdown`: 5/5 test đạt và queue backlog drain về 0       |
| Chuỗi test chạy ổn định và có báo cáo giới hạn                      | Đạt cục bộ | `pnpm run test` exit code 0; Prettier, ESLint và `tsc --noEmit -p tsconfig.w1.json` đạt                                                        |
| Sản phẩm được lưu/đẩy và truy cập được                              | Đạt        | Substantive work đã push lên nhánh task và có trong [PR #36](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/36)                          |
| URL PR và trạng thái `Chờ review` có trên PR head                   | Đạt        | PR #36 và trạng thái `Chờ review` được ghi trong commit metadata trên chính nhánh task                                                         |
| PR có review hợp lệ và completion metadata                          | Chưa đạt   | Chưa đến bước review/finalization                                                                                                              |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không thay đổi phạm vi; test W5 hiện có được mở rộng để chạy Notification thật và giữ scenario slowdown ở chế độ opt-in.
- Việc chưa hoàn thành hoặc trở ngại: Không còn blocker kỹ thuật. Môi trường chạy Node.js `22.22.0` trong khi project khai báo `22.13.1`; pnpm cảnh báo engine nhưng toàn bộ cổng kiểm tra đã đạt. PR chưa có verdict review hoặc completion metadata.
- Bước tiếp theo: Đức review [PR #36](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/36). Nếu có feedback, Bách xử lý trên nhánh task; sau `APPROVED`, Bách finalization metadata trước khi merge.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
