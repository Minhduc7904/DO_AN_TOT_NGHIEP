# Task tuần: Xây regression suite cho Testbed MVP

## Thông tin chung

| Trường          | Nội dung                                          |
| --------------- | ------------------------------------------------- |
| Mã task         | `task-04_build-mvp-regression-suite`              |
| Tuần            | `week-09_2026-09-27_to_2026-10-03`                |
| Trạng thái      | Hoàn thành                                        |
| Người phụ trách | Bách                                              |
| Collaborator    | Đức hỗ trợ môi trường testbed                     |
| Ưu tiên         | Cao                                               |
| Hạn dự kiến     | 16/10/2026 — mốc bù tiến độ                       |
| Nhánh thực hiện | `test/week-09/task-04-build-mvp-regression-suite` |

## Yêu cầu và phạm vi

### Cần thực hiện

Xây một regression entrypoint cho Testbed MVP chạy từ dữ liệu sạch, bao phủ tối thiểu workflow `login → course → enroll → submit` và `submit → grade → grade.completed → notification`. Suite phải kiểm tra happy path, error/latency propagation quan trọng, topology HTTP + RabbitMQ và telemetry assertions; thất bại phải chỉ ra bước/service gây lỗi.

### Không thực hiện

- Không thay thế unit/integration test riêng của từng service.
- Không mở rộng business feature, thêm Assignment/UI hoặc dựng observability backend W10.
- Không dùng sleep cố định làm cơ chế đồng bộ async nếu có thể poll với timeout hữu hạn.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: W8 task-03; W9 task-01, task-02 và task-03 đã merge.
- Người hoặc phần việc cần phối hợp: Đức hỗ trợ cấu hình Gateway, Grading, RabbitMQ và reset/seed; kết quả cần đủ rõ để chạy độc lập ở task-05.
- Rủi ro/giả định: W9 task-02 và task-03 đã merge; regression đã dùng reset/seed canonical và messaging stability thật. Async assertions dễ flaky, mọi poll/retry của test phải có timeout, interval và failure diagnostics rõ.

## Sản phẩm kỳ vọng

| Sản phẩm                                    | Loại | Vị trí hoặc link dự kiến        |
| ------------------------------------------- | ---- | ------------------------------- |
| Regression E2E entrypoint và test suite     | Code | `lms/test/`, `lms/package.json` |
| Báo cáo coverage workflow/failure/telemetry | Docs | PR và output task               |

## Definition of Done

- [x] Một command chạy reset/seed rồi kiểm chứng hai workflow xuyên service qua Gateway và RabbitMQ từ trạng thái sạch.
- [x] Suite bao phủ tối thiểu một timeout HTTP, một dependency unavailable và một failure/recovery messaging; error propagation đúng contract.
- [x] Assertions xác minh topology có sáu business service + Gateway, PostgreSQL/Redis/RabbitMQ liên quan và trace correlation xuyên sync/async.
- [x] Async test dùng polling có timeout hữu hạn, chạy ổn định ít nhất ba lần liên tiếp và in diagnostics đủ xác định bước lỗi.
- [x] Regression entrypoint chạy trong CI hoặc có lý do/tách job rõ; `pnpm run ci:verify` và Compose smoke pass.
- [x] URL/số PR và trạng thái `Chờ review` được commit/push vào PR head trước review; finalization tuân thủ vòng đời task canonical.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-09_2026-09-27_to_2026-10-03/task-04_build-mvp-regression-suite/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-09_2026-09-27_to_2026-10-03/task-04_build-mvp-regression-suite/output/task-output.md).
- Pull request: [#39](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/39).
- Kết quả review: Reviewer agent `APPROVED` ngoài GitHub trên head `a2fd0c3`, không có blocking issue; không phải GitHub `APPROVED` hợp lệ. Bách xác nhận Đức cho phép review theo ngoại lệ của repository.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 14/10/2026 — finalization trước merge theo ngoại lệ review ngoài GitHub do Bách xác nhận; CI run `38504554203` trên head `a2fd0c3` xanh toàn bộ sáu checks.
- Ghi chú/tồn đọng: Góp ý không blocking: regression chạy song song container ứng dụng Compose dùng chung `grading_db`/broker; test topology phụ thuộc thứ tự hai test workflow. Task-05 tái sử dụng `pnpm run test:regression`.
