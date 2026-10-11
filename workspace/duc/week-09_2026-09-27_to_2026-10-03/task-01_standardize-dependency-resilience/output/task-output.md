# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Mã task            | `task-01_standardize-dependency-resilience`                                                                   |
| Người phụ trách    | Đức                                                                                                           |
| Trạng thái         | Hoàn thành                                                                                                    |
| Bắt đầu thực tế    | 11/10/2026 20:00 (UTC+07:00)                                                                                  |
| Hoàn thành thực tế | 11/10/2026 20:27 (UTC+07:00) — finalization theo ngoại lệ Đức đã xác nhận                                     |
| Tổng thời lượng    | Khoảng 27 phút theo mốc hồ sơ từ 20:00 đến 20:27; bao gồm review/sửa blocker và không phải timesheet thủ công |
| Pull request       | [#35](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/35)                                                |
| Người review       | Agent review độc lập theo ngoại lệ của Đức                                                                    |
| Kết quả review     | Focused re-review `APPROVED` nội bộ; không có GitHub `APPROVED`                                               |

## Báo cáo công việc đã làm

- Đã tạo policy canonical cho timeout, retry, error mapping và dependency telemetry HTTP.
- Đã bổ sung năm Gateway dependency identity, client span và metric request/error/duration có label hữu hạn.
- Đã chuẩn hóa upstream `504` thành timeout, các 5xx khác thành unavailable và giữ business `404`.
- Đã siết timeout HTTP của bốn service trong khoảng 100–60.000 ms và thêm test mỗi request chỉ gọi `fetch` một lần.
- Review vòng đầu phát hiện span name Gateway làm hỏng W5 parent-chain; commit `8091d74` đã khôi phục contract `HTTP method + target path` và bổ sung regression assertion.

## Sản phẩm thực tế

| Sản phẩm                     | Loại | Link hoặc đường dẫn                                                 |
| ---------------------------- | ---- | ------------------------------------------------------------------- |
| Nhánh task                   | Code | `refactor/week-09/task-01-standardize-dependency-resilience`        |
| Policy resilience HTTP       | Docs | `docs/processed/architecture/dependency-resilience-policy-v1.md`    |
| Gateway dependency telemetry | Code | `lms/services/gateway/src/application/gateway-proxy.ts`             |
| Gateway telemetry assertion  | Test | `lms/services/gateway/test/telemetry/dependency.telemetry-test.mjs` |
| Timeout/mapping unit test    | Test | Unit test của Gateway, Enrollment, Submission và Grading            |

## Đối chiếu Definition of Done

| Điều kiện từ input                     | Kết quả           | Bằng chứng                                                                                                                                                                                                                |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy và runtime resilience           | Đạt               | Policy v1; env schema mặc định/range và unit test timeout/503/504/business `404` pass                                                                                                                                     |
| Gateway telemetry và label cardinality | Đạt               | `test:telemetry` pass; đủ năm identity, ba metric và assertion không có dynamic ID/credential trong metric labels                                                                                                         |
| Mỗi request chỉ gọi `fetch` một lần    | Đạt               | Gateway/Enrollment/Submission/Grading unit test chứng minh không retry; Storage `PUT` không duplicate write                                                                                                               |
| Kiểm tra bắt buộc                      | Đạt               | Build/lint/full test pass; W5 PostgreSQL/RabbitMQ `3/3` pass sau review fix; GitHub CI run `38142884658` xanh toàn bộ, gồm quality gates, Compose và fresh smoke                                                          |
| PR và review lifecycle                 | Đạt theo ngoại lệ | PR #35 readiness đã push trước review; review vòng đầu `CHANGES_REQUESTED`, commit `8091d74` sửa blocker, focused re-review `APPROVED` nội bộ. Nguồn ngoại lệ: chỉ thị trực tiếp của Đức cho phép bỏ qua GitHub approval. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại:
  - `pnpm run format:check` và do đó `pnpm run ci:verify` cục bộ từ working tree Windows dừng ở bước đầu do 34 file baseline ngoài diff chưa khớp Prettier. Không sửa lan ngoài task; scoped Prettier, build/lint/full test cục bộ pass và GitHub clean-install quality gate xanh.
  - Đồng bộ plan/timeline dừng vì thiếu `workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/input/task-input.md`; không tự tạo hoặc sửa workspace của Bách theo ngoại lệ Đức đã xác nhận.
- Bước tiếp theo: Reviewer kiểm tra focused diff finalization; sau đó Đức merge PR #35 theo ngoại lệ đã xác nhận.
