# Task tuần: Kiểm chứng E2E login → enroll → nộp bài qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-enroll-to-submit-workflow` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Đức chạy độc lập, review trace/metric và contract assertions |
| Ưu tiên | Trung bình |
| Hạn dự kiến | 19/09/2026 |
| Nhánh thực hiện | `test/week-07/task-06-verify-enroll-to-submit-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Ghép Auth/Gateway/Course/Enrollment/Submission/storage mock vào Compose và CI phù hợp, tạo E2E cho luồng đầy đủ `login → enroll → nộp bài` qua Gateway. Kiểm chứng JWT/role, timeout/error path (ít nhất một Enrollment→Course và một Submission→storage failure), trace xuyên toàn bộ service và RED/dependency telemetry cơ bản.

### Không thực hiện

- Không triển khai Grading, Notification hoặc fault injection F1 đầy đủ; các phần này thuộc Week 8.
- Không sửa business contract để né lỗi tích hợp; sai lệch phải được xử lý ở đúng owner/boundary.
- Không coi test riêng lẻ từng service (task-01 đến task-05) là bằng chứng thay thế cho E2E qua Gateway.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đến task-05 đã merge vào `main`; Compose/CI/OTel baseline Week 5–6.
- Người hoặc phần việc cần phối hợp: Đức chạy độc lập luồng đầy đủ và kiểm tra telemetry đủ field cho phân tích sau này.
- Rủi ro/giả định: compose startup/readiness và seed ordering (Auth, Course, Enrollment, Submission, storage mock) phải deterministic; storage mock vắng mặt hoặc lỗi không được làm service crash ngoài behavior đã tài liệu hóa.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E login → enroll → nộp bài và telemetry assertions | Code | `lms/test/` hoặc test suite integration canonical |
| Compose/CI/Quick Start cập nhật | Code / Docs | `docker-compose/`, `.github/workflows/` và tài liệu chạy liên quan |

## Definition of Done

- [x] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, Enrollment, Submission, storage mock và PostgreSQL theo hướng dẫn không cần bước ngầm.
- [x] E2E login qua Gateway nhận JWT, dùng token enroll vào seeded course rồi nộp bài qua Gateway; role hợp lệ/không hợp lệ được kiểm tra.
- [x] E2E bao phủ ít nhất một Enrollment→Course failure và một Submission→storage failure behavior với error envelope canonical.
- [x] Trace giữ W3C context qua Gateway và toàn bộ downstream; HTTP server/client cùng `enrollment-postgres`, `enrollment→course`, `submission→enrollment`, `submission→storage` signals có assertions phù hợp.
- [x] CI chạy test cần thiết thành công; Đức đang bận, ủy quyền Bách giao review kỹ thuật ngoài GitHub và Bách xác nhận dùng đây là bằng chứng thay thế.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-06_verify-enroll-to-submit-workflow/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-06_verify-enroll-to-submit-workflow/output/task-output.md).
- Pull request: [#30](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/30).
- Kết quả review: APPROVED về kỹ thuật ngoài GitHub do Codex thực hiện theo yêu cầu của Bách; Đức ủy quyền Bách giao review. GitHub không có verdict `APPROVED`.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Bách theo yêu cầu chia task tuần 7; thực hiện cuối chuỗi tuần 7, sau khi cả Enrollment và Submission đã merge.
- Cập nhật gần nhất: 26/09/2026 — Bách yêu cầu bắt đầu lại task-06 sau khi trì hoãn Week 8; đã tạo nhánh riêng và hồ sơ input. Chưa thực hiện thay đổi substantive, test E2E hoặc tạo PR.
- Cập nhật gần nhất: 26/09/2026 — đã bổ sung Gateway route cho Submission, Compose/CI và E2E PostgreSQL; `pnpm run ci:verify`, `pnpm run test:w3:postgres` cùng Compose smoke đạt. PR [#30](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/30) đã được tạo và task chuyển `Chờ review`.
- Cập nhật gần nhất: 26/09/2026 — Bách chỉ thị finalization theo ngoại lệ sau review kỹ thuật ngoài GitHub; task chuyển `Hoàn thành` trên PR head trước merge. GitHub không có verdict `APPROVED`.
- Ghi chú/tồn đọng: Review kỹ thuật ngoài GitHub được Đức ủy quyền Bách giao và Bách xác nhận làm bằng chứng thay thế. Branch protection vẫn có thể yêu cầu GitHub approval trước merge.
