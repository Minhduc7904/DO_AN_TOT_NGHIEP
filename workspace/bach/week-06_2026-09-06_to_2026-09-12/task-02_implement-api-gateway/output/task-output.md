# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_implement-api-gateway` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành theo ngoại lệ review |
| Bắt đầu thực tế | 16/09/2026 |
| Hoàn thành thực tế | 16/09/2026 23:31 ICT |
| Tổng thời lượng | Không xác định chính xác: hồ sơ chỉ có ngày bắt đầu, không có giờ bắt đầu. |
| Pull request | [#20](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/20) |
| Người review | Đức (ủy quyền review ngoài GitHub theo xác nhận trực tiếp của Bách) |
| Kết quả review | Đạt qua review ngoài GitHub; không có submission `APPROVED` trên GitHub. |

## Báo cáo công việc đã làm

Đã triển khai API Gateway NestJS, cấu hình Compose và test. Gateway chuyển tiếp `POST /api/v1/auth/login`/`refresh` tới Auth, bảo vệ route Course bằng JWT HS256, tự derive principal từ `sub`/`role`, loại bỏ principal header do client gửi và chỉ chuyển header tin cậy xuống downstream. Outbound call dùng timeout cấu hình, không retry, map `503`/`504` về error envelope canonical và giữ W3C trace context.

Review vòng đầu phát hiện CI không đạt do 9 file Gateway chưa theo Prettier; đã sửa bằng commit `dbd90c5`. Ba GitHub checks sau sửa đều pass. Theo chỉ thị trực tiếp ngày 16/09/2026, Bách xác nhận dùng ủy quyền review ngoài GitHub của Đức làm bằng chứng thay thế cho cổng `APPROVED` GitHub.

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
| URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review | Đạt | Commit `7bd29e6` trên PR #20 chứa URL PR và trạng thái `Chờ review`. |
| Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge | Đạt theo ngoại lệ đã xác nhận | PR #20 dùng template; GitHub không có submission `APPROVED`. Bách xác nhận ủy quyền review ngoài GitHub của Đức và chấp nhận bỏ qua cổng này; metadata finalization được commit/push trên PR head. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Chưa có.
- Việc chưa hoàn thành hoặc trở ngại: Không còn blocker kỹ thuật; PR vẫn chưa merge.
- Bước tiếp theo: Bách có thể tự yêu cầu hoặc thực hiện merge PR #20 theo ngoại lệ review đã xác nhận.

> Ngoại lệ workflow: GitHub không ghi nhận `APPROVED`. Bách xác nhận ngày 16/09/2026 rằng Đức đã ủy quyền review ngoài GitHub và yêu cầu finalization để PR sẵn sàng merge. Không diễn giải ngoại lệ này thành GitHub approval.
