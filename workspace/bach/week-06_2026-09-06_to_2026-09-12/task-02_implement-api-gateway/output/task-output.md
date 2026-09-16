# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_implement-api-gateway` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 16/09/2026 |
| Hoàn thành thực tế |  |
| Tổng thời lượng |  |
| Pull request | [#20](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/20) |
| Người review | Đức |
| Kết quả review | Chờ Đức review trên GitHub |

## Báo cáo công việc đã làm

Đã triển khai API Gateway NestJS, cấu hình Compose và test. Gateway chuyển tiếp `POST /api/v1/auth/login`/`refresh` tới Auth, bảo vệ route Course bằng JWT HS256, tự derive principal từ `sub`/`role`, loại bỏ principal header do client gửi và chỉ chuyển header tin cậy xuống downstream. Outbound call dùng timeout cấu hình, không retry, map `503`/`504` về error envelope canonical và giữ W3C trace context.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| API Gateway, cấu hình runtime và Compose | Code / Docs | `lms/services/gateway/`, `docker-compose/compose.yaml` |
| Unit/E2E tests Gateway | Test | `lms/services/gateway/test/` |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Auth routes hoạt động qua Gateway và giữ error envelope canonical | Đạt ở mức kiểm thử | `test/e2e/gateway.e2e-spec.ts`: proxy login giữ `401 UNAUTHORIZED` downstream |
| JWT signature/expiry/claims/role được xác minh cục bộ; external principal headers bị strip/overwrite | Đạt | `src/domain/access-token.ts`, `test/unit/access-token.spec.ts`, `test/e2e/gateway.e2e-spec.ts` |
| Outbound timeout cấu hình rõ, retry tắt mặc định và error mapping có test | Đạt | `src/application/gateway-proxy.ts`, `test/unit/gateway-proxy.spec.ts` |
| W3C trace context được propagate; unit/integration tests và build pass | Đạt | `test/unit/gateway-proxy.spec.ts`; `pnpm run build`, `pnpm run lint`, 7 test Gateway đều pass ngày 16/09/2026 |
| Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập | Đạt | Đã push nhánh `feat/week-06/task-02-implement-api-gateway`; [PR #20](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/20) |
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review | Đang thực hiện | PR #20 đã tạo; transition này sẽ được push trong commit metadata hiện tại trước khi bắt đầu review |
| Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge | Chưa đạt | PR #20 dùng template; chờ Đức gửi GitHub `APPROVED` |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có.
- Việc chưa hoàn thành hoặc trở ngại: Chờ Đức review [PR #20](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/20) trên GitHub.
- Bước tiếp theo: Sau `APPROVED` hợp lệ, thực hiện finalization metadata trên chính PR trước khi Bách merge.

> `Hoàn thành thực tế` là thời điểm Bách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ Đức và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, Bách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge.
