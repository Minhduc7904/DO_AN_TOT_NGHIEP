# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                                       |
| ------------------ | -------------------------------------------------------------- |
| Mã task            | `task-03_verify-login-workflow`                                |
| Người phụ trách    | Bách                                                           |
| Trạng thái         | Chờ review                                                     |
| Bắt đầu thực tế    | 16/09/2026                                                     |
| Hoàn thành thực tế |                                                                |
| Tổng thời lượng    |                                                                |
| Pull request       | [#21](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/21) |
| Người review       | Đức (được yêu cầu)                                             |
| Kết quả review     | Chờ review                                                     |

## Báo cáo công việc đã làm

Đã khởi tạo task trên nhánh riêng theo quy trình và thêm suite W1 trong `lms/test/`. `test:w1` giữ Auth repository trong bộ nhớ để kiểm tra lặp lại credential/JWT/role/timeout/telemetry. `test:w1:postgres` xóa bảng Auth, chạy migration/seed canonical, khởi động Auth với `PostgresAuthRepository`, đăng nhập seed user qua Gateway và dùng JWT tại route bảo vệ. Gateway cũng tạo HTTP client span để Auth nhận W3C context từ client span này. CI sẽ chạy cả suite PostgreSQL và quality gate chung.

Đã chạy cục bộ bằng Node `22.13.1`: `test:w1:postgres` pass `1/1`; format, build, lint, architecture tests, các Jest suite và hai telemetry assertions tương đương `ci:verify` đều pass. Container PostgreSQL tạm được dừng và xóa sau kiểm chứng.

## Sản phẩm thực tế

| Sản phẩm                        | Loại | Link hoặc đường dẫn                                                                                                                                                                                                    |
| ------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite W1 trong bộ nhớ           | Code | [`lms/test/w1-login-workflow.e2e-spec.ts`](../../../../../lms/test/w1-login-workflow.e2e-spec.ts)                                                                                                                      |
| Suite W1 PostgreSQL sạch        | Code | [`lms/test/w1-postgres-workflow.e2e-spec.ts`](../../../../../lms/test/w1-postgres-workflow.e2e-spec.ts), [`lms/services/auth/test/reset-w1-postgres.mjs`](../../../../../lms/services/auth/test/reset-w1-postgres.mjs) |
| Cấu hình type-check/Jest W1     | Code | [`lms/tsconfig.w1.json`](../../../../../lms/tsconfig.w1.json), [`lms/jest.w1.config.ts`](../../../../../lms/jest.w1.config.ts)                                                                                         |
| Hướng dẫn và giới hạn telemetry | Docs | [`lms/services/gateway/README.md`](../../../../../lms/services/gateway/README.md)                                                                                                                                      |

## Đối chiếu Definition of Done

| Điều kiện từ input                                                                           | Kết quả              | Bằng chứng                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W1 qua Gateway trả JWT hợp lệ và request bảo vệ chấp nhận token từ seed user                 | Đạt                  | `test:w1:postgres` pass `1/1`: reset DB, migration/seed, Auth `PostgresAuthRepository`, login Gateway và route bảo vệ.                                                                           |
| Credential sai, JWT hết hạn/sai chữ ký, role không đủ và Auth timeout trả contract canonical | Đạt                  | `pnpm run test:w1`: năm assertion lỗi tương ứng pass, gồm `DEPENDENCY_TIMEOUT` cho timeout.                                                                                                      |
| Trace Gateway/Auth liên kết W3C và có signal `auth-postgres` khi hỗ trợ                      | Đạt                  | `pnpm run test:w1`: xác minh quan hệ Gateway server → Gateway client → Auth server span cùng trace ID. Auth chưa tích hợp PostgreSQL instrumentation nên điều kiện `auth-postgres` chưa áp dụng. |
| Test chạy từ dữ liệu sạch, được đưa vào CI; Đức chạy độc lập và ghi bằng chứng               | Chờ xác nhận độc lập | `test:w1:postgres` pass cục bộ với PostgreSQL mới; CI được bổ sung service PostgreSQL và chạy suite này trước `ci:verify`. Còn chờ Đức chạy/review commit mới.                                   |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập                               | Đạt                  | Đã commit/push lên nhánh task và mở PR [#21](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/21).                                                                                           |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước review            | Đạt theo ngoại lệ    | PR [#21](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/21) có head `c7b4a03`; remote PR head chứa trạng thái `Chờ review`. Bách xác nhận mở review trước bằng chứng chạy độc lập của Đức. |
| Pull request có `APPROVED` hợp lệ từ Đức và completion metadata trước merge                  | Chờ review lại       | Commit xử lý feedback sẽ làm approval cũ stale; cần `APPROVED` mới của Đức trước finalization.                                                                                                   |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Bổ sung suite PostgreSQL sạch ngoài suite in-memory để kiểm chứng persistence/seed tự động trong CI.
- Việc chưa hoàn thành hoặc trở ngại: Cần Đức review lại diff; Auth chưa có PostgreSQL instrumentation nên chưa có dependency span để kiểm chứng.
- Bước tiếp theo: Đức review tập trung diff PostgreSQL/seed và gửi `APPROVED` mới trước finalization. Nếu bổ sung PostgreSQL instrumentation ở task phù hợp, mở rộng assertion với identity `auth-postgres`.

> `Hoàn thành thực tế` là thời điểm Bách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ Đức và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, Bách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge.
