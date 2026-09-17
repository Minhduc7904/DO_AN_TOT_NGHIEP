# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-login-workflow` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 16/09/2026 |
| Hoàn thành thực tế |  |
| Tổng thời lượng |  |
| Pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Đã khởi tạo task trên nhánh riêng theo quy trình và thêm suite tích hợp W1 tại `lms/test/`. Suite chạy Auth application với repository sạch trong bộ nhớ trên HTTP cục bộ, Gateway gọi Auth bằng HTTP thật, sau đó kiểm tra JWT ở route bảo vệ. Gateway cũng tạo HTTP client span để Auth nhận W3C context từ client span này. Script `test:w1` gồm type-check và Jest, đã được đưa vào script `test` để CI chạy.

Đã chạy Compose project tạm `w1-task03-check` với volume PostgreSQL mới. Login seed user qua Gateway trả JWT; request Course với JWT hợp lệ đi qua Gateway và nhận `404` vì Course chưa có route, trong khi JWT sai trả `401 UNAUTHORIZED`. Project tạm cùng container, network và volume đã được xóa sau kiểm chứng.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Suite tích hợp W1 | Code | [`lms/test/w1-login-workflow.e2e-spec.ts`](../../../../../lms/test/w1-login-workflow.e2e-spec.ts) |
| Cấu hình type-check/Jest W1 | Code | [`lms/tsconfig.w1.json`](../../../../../lms/tsconfig.w1.json), [`lms/jest.w1.config.ts`](../../../../../lms/jest.w1.config.ts) |
| Hướng dẫn và giới hạn telemetry | Docs | [`lms/services/gateway/README.md`](../../../../../lms/services/gateway/README.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| W1 qua Gateway trả JWT hợp lệ và request bảo vệ chấp nhận token từ seed user | Đạt | `pnpm run test:w1` pass; Compose fresh-data: login trả JWT, JWT hợp lệ tới `/api/v1/courses` nhận `404` từ Course (đã qua Gateway), JWT sai nhận `401`. |
| Credential sai, JWT hết hạn/sai chữ ký, role không đủ và Auth timeout trả contract canonical | Đạt | `pnpm run test:w1`: năm assertion lỗi tương ứng pass, gồm `DEPENDENCY_TIMEOUT` cho timeout. |
| Trace Gateway/Auth liên kết W3C và có signal `auth-postgres` khi hỗ trợ | Đạt | `pnpm run test:w1`: xác minh quan hệ Gateway server → Gateway client → Auth server span cùng trace ID. Auth chưa tích hợp PostgreSQL instrumentation nên điều kiện `auth-postgres` chưa áp dụng. |
| Test chạy từ dữ liệu sạch, được đưa vào CI; Đức chạy độc lập và ghi bằng chứng | Chưa đạt | Repository in-memory được reset trước từng test, `pnpm run ci:verify` pass và Compose với volume mới đã chạy; còn chờ Đức chạy độc lập. |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập | Chưa đạt | Sản phẩm đã ở nhánh local; chưa commit/push hoặc tạo PR. |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước review | Chưa đạt | Chưa tạo PR vì các DoD telemetry và kiểm chứng độc lập chưa hoàn tất. |
| Pull request có `APPROVED` hợp lệ từ Đức và completion metadata trước merge | Chưa đạt | Chưa đến bước review/finalization. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Dùng repository Auth trong bộ nhớ và HTTP cục bộ trong CI để test lặp lại, thay vì phụ thuộc PostgreSQL/Compose local.
- Việc chưa hoàn thành hoặc trở ngại: Cần Đức chạy độc lập và ghi bằng chứng; Auth chưa có PostgreSQL instrumentation nên chưa có dependency span để kiểm chứng.
- Bước tiếp theo: Nhận kết quả chạy độc lập từ Đức, sau đó commit/push và mở PR. Nếu bổ sung PostgreSQL instrumentation ở task phù hợp, mở rộng assertion với identity `auth-postgres`.

> `Hoàn thành thực tế` là thời điểm Bách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ Đức và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, Bách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge.
