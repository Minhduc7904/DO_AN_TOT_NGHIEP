# Task tuần: Kiểm chứng E2E W1–W2 và telemetry qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-login-to-course-workflow` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Đức |
| Collaborator | Bách chạy độc lập, review trace/metric và contract assertions |
| Ưu tiên | Cao |
| Hạn dự kiến | 12/09/2026 |
| Nhánh thực hiện | `test/week-06/task-06-verify-login-to-course-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Ghép stack Auth/Gateway/Course vào Compose và CI phù hợp, tạo E2E cho W1 login rồi W2 browse course qua Gateway. Kiểm chứng JWT/role, timeout/error path, trace xuyên service và RED/dependency telemetry cơ bản.

### Không thực hiện

- Không triển khai workflow W3–W5, fault injection F1 hoặc observability backend đầy đủ.
- Không sửa business contract để né lỗi tích hợp; sai lệch phải được xử lý ở đúng owner/boundary.
- Không coi test riêng lẻ từng service là bằng chứng thay thế cho E2E qua Gateway.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đến task-03 đã merge; nhánh task-05 là base theo chỉ thị Đức trước merge task-04/05; Compose/CI/OTel baseline Week 5. Chỉ merge task-06 sau task-05.
- Người hoặc phần việc cần phối hợp: Bách chạy W1–W2 độc lập và kiểm tra telemetry đủ field cho analysis.
- Rủi ro/giả định: compose startup/readiness và seed ordering phải deterministic; telemetry backend vắng mặt không được làm service crash ngoài behavior đã tài liệu hóa.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E W1–W2 và telemetry assertions | Code | `lms/test/` hoặc test suite integration canonical |
| Compose/CI/Quick Start cập nhật | Code / Docs | `docker-compose/`, `.github/workflows/` và tài liệu chạy liên quan |

## Definition of Done

- [x] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, PostgreSQL và Redis theo hướng dẫn không cần bước ngầm.
- [x] E2E login qua Gateway nhận JWT rồi dùng token browse seeded course qua Gateway; role hợp lệ/không hợp lệ được kiểm tra.
- [x] E2E bao phủ ít nhất một Auth dependency timeout/error và một Course Redis/PostgreSQL failure behavior với error envelope canonical.
- [x] Trace W1/W2 giữ W3C context qua Gateway và downstream; HTTP server/client cùng `auth-postgres`, `course-postgres`, `course-redis` signals có assertions phù hợp.
- [x] CI chạy test cần thiết thành công; Bách chạy độc lập W1–W2 và kết quả/giới hạn được ghi trong PR hoặc output task (ngoại lệ: Bách nghỉ ốm, không thực hiện được; Đức tự xác nhận thay dựa trên CI PR #24 xanh).

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-06_2026-09-06_to_2026-09-12/task-06_verify-login-to-course-workflow/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-06_2026-09-06_to_2026-09-12/task-06_verify-login-to-course-workflow/output/task-output.md).
- Pull request: [#24](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/24) (xếp chồng trên #23).
- Kết quả review: Ngoại lệ — không có GitHub `APPROVED` và không có lượt chạy độc lập của Bách. Bách không thể thực hiện do nghỉ ốm; Đức (người phụ trách) xác nhận bỏ qua bước review độc lập ngày 21/09/2026 theo cơ chế ngoại lệ trong [quy tắc Git và pull request](../../../rules/git-and-pull-request-rules.md#ưu-tiên-chỉ-thị-trực-tiếp-và-ghi-nhận-ngoại-lệ).

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — Đức triển khai nhánh task-06 lấy base từ commit task-05 theo yêu cầu, trước khi task-04/05 merge.
- Cập nhật gần nhất: 21/09/2026 — Bách nghỉ ốm, không thể chạy độc lập hoặc review. Đức (người phụ trách) xác nhận ngoại lệ, tự finalization và chuyển `Hoàn thành` trước khi tự merge task của mình.
- Ghi chú/tồn đọng: Không còn tồn đọng; thiếu duy nhất lượt chạy độc lập và review của Bách do lý do bất khả kháng đã nêu.
