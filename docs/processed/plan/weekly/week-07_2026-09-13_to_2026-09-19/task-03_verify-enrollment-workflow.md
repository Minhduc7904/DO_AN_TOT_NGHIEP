# Task tuần: Kiểm chứng E2E login → enroll qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-enrollment-workflow` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Đức |
| Collaborator | Bách chạy độc lập, review trace/metric của luồng enroll |
| Ưu tiên | Trung bình |
| Hạn dự kiến | 19/09/2026 |
| Nhánh thực hiện | `test/week-07/task-03-verify-enrollment-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Kiểm chứng E2E luồng `login → enroll` qua Gateway với PostgreSQL thực: JWT hợp lệ dùng để tạo enrollment cho seeded course, role hợp lệ/không hợp lệ được kiểm tra, timeout/error path khi Course không sẵn sàng được kiểm tra qua Enrollment. Xác nhận trace xuyên Gateway/Enrollment/Course giữ W3C context trước khi Submission (task-04 trở đi) bắt đầu phụ thuộc vào Enrollment.

### Không thực hiện

- Không kiểm chứng luồng nộp bài (Submission); đây thuộc task-06.
- Không sửa business contract để né lỗi tích hợp; sai lệch phải được xử lý ở đúng owner/boundary.
- Không coi test riêng lẻ Enrollment là bằng chứng thay thế cho E2E qua Gateway.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 và task-02 đã merge vào `main`; Compose/CI baseline Week 5–6.
- Người hoặc phần việc cần phối hợp: Bách chạy độc lập luồng `login → enroll` và kiểm tra telemetry đủ field cho phân tích sau này.
- Rủi ro/giả định: compose startup/readiness và seed ordering (Auth, Course, Enrollment) phải deterministic.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E login → enroll và telemetry assertions | Code | `lms/test/` hoặc test suite integration canonical |
| Compose/CI cập nhật cho Enrollment | Code / Docs | `docker-compose/`, `.github/workflows/` |

## Definition of Done

- [ ] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, Enrollment, PostgreSQL theo hướng dẫn không cần bước ngầm.
- [ ] E2E login qua Gateway nhận JWT rồi dùng token tạo enrollment cho seeded course qua Gateway; role hợp lệ/không hợp lệ được kiểm tra.
- [ ] E2E bao phủ ít nhất một Course dependency unavailable/timeout behavior nhìn từ phía Enrollment, với error envelope canonical.
- [ ] Trace `login → enroll` giữ W3C context qua Gateway và downstream; HTTP server/client cùng `enrollment-postgres` signals có assertions phù hợp.
- [ ] CI chạy test cần thiết thành công; Bách chạy độc lập và kết quả/giới hạn được ghi trong PR hoặc output task.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-07_2026-09-13_to_2026-09-19/task-03_verify-enrollment-workflow/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-07_2026-09-13_to_2026-09-19/task-03_verify-enrollment-workflow/output/task-output.md).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Đức theo yêu cầu chia task tuần 7; thực hiện cuối track Enrollment, trước khi Bách bắt đầu Submission.
- Cập nhật gần nhất: 22/09/2026 — Đức bắt đầu triển khai trên nhánh `test/week-07/task-03-verify-enrollment-workflow`, base trực tiếp lên nhánh task-02 (PR #26, chưa merge) theo chỉ thị Đức về stacked branch; không đợi task-01/02 merge vào `main` trước.
- Ghi chú/tồn đọng: `tools/sync-plan-json-and-timeline.ps1` cần `pwsh`, không sẵn có trong môi trường thực hiện; timeline đang chờ đồng bộ.
