# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                    |
| ------------------ | ------------------------------------------- |
| Mã task            | `task-01_standardize-dependency-resilience` |
| Người phụ trách    | Đức                                         |
| Trạng thái         | Đang thực hiện                              |
| Bắt đầu thực tế    | 11/10/2026 20:00 (UTC+07:00)                |
| Hoàn thành thực tế | Chưa hoàn thành                             |
| Tổng thời lượng    | Chưa tổng kết                               |
| Pull request       | Chưa tạo                                    |
| Người review       | Chưa review                                 |
| Kết quả review     | Chưa review                                 |

## Báo cáo công việc đã làm

- Đã tạo policy canonical cho timeout, retry, error mapping và dependency telemetry HTTP.
- Đã bổ sung năm Gateway dependency identity, client span và metric request/error/duration có label hữu hạn.
- Đã chuẩn hóa upstream `504` thành timeout, các 5xx khác thành unavailable và giữ business `404`.
- Đã siết timeout HTTP của bốn service trong khoảng 100–60.000 ms và thêm test mỗi request chỉ gọi `fetch` một lần.

## Sản phẩm thực tế

| Sản phẩm                     | Loại | Link hoặc đường dẫn                                                 |
| ---------------------------- | ---- | ------------------------------------------------------------------- |
| Nhánh task                   | Code | `refactor/week-09/task-01-standardize-dependency-resilience`        |
| Policy resilience HTTP       | Docs | `docs/processed/architecture/dependency-resilience-policy-v1.md`    |
| Gateway dependency telemetry | Code | `lms/services/gateway/src/application/gateway-proxy.ts`             |
| Gateway telemetry assertion  | Test | `lms/services/gateway/test/telemetry/dependency.telemetry-test.mjs` |
| Timeout/mapping unit test    | Test | Unit test của Gateway, Enrollment, Submission và Grading            |

## Đối chiếu Definition of Done

| Điều kiện từ input                     | Kết quả                | Bằng chứng                                                                                                                                                              |
| -------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy và runtime resilience           | Đạt                    | Policy v1; env schema mặc định/range và unit test timeout/503/504/business `404` pass                                                                                   |
| Gateway telemetry và label cardinality | Đạt                    | `test:telemetry` pass; đủ năm identity, ba metric và assertion không có dynamic ID/credential trong metric labels                                                       |
| Mỗi request chỉ gọi `fetch` một lần    | Đạt                    | Gateway/Enrollment/Submission/Grading unit test chứng minh không retry; Storage `PUT` không duplicate write                                                             |
| Kiểm tra bắt buộc                      | Đạt trong phạm vi diff | Build và lint full pass; full test pass 206 Jest test + 4 architecture test + telemetry/integration scripts; scoped Prettier, `git diff --check` và Compose config pass |
| PR và review lifecycle                 | Chưa đạt               | Chưa tạo PR                                                                                                                                                             |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có.
- Việc chưa hoàn thành hoặc trở ngại:
  - `pnpm run format:check` và do đó `pnpm run ci:verify` cục bộ dừng ở bước đầu do 34 file baseline ngoài diff trên `main` chưa khớp Prettier. Không sửa lan ngoài task; scoped Prettier của toàn bộ file thay đổi pass, còn build/lint/full test được chạy riêng và pass.
  - Đồng bộ plan/timeline dừng vì thiếu `workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/input/task-input.md`; không tự tạo hoặc sửa workspace của Bách theo ngoại lệ Đức đã xác nhận.
- Bước tiếp theo: Commit/push substantive work, tạo PR và commit/push URL PR cùng trạng thái `Chờ review`.
