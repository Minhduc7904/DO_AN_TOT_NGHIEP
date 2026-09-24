# Task tuần: Triển khai Submission service MVP và storage mock điều khiển được

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-submission-service` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Đức review HTTP contract Submission↔Enrollment/Course và storage mock boundary |
| Ưu tiên | Cao |
| Hạn dự kiến | 18/09/2026 |
| Nhánh thực hiện | `feat/week-07/task-04-implement-submission-service` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai Submission service ở mức MVP: nộp bài cho một enrollment và truy vấn Submission theo ID. Submission gọi Course và Enrollment qua HTTP để xác nhận course/enrollment hợp lệ trước khi chấp nhận bài nộp, và gọi một external storage mock qua HTTP/network (không phải import trong-process) để lưu file bài nộp. Storage mock phải có dependency identity ổn định và cho phép điều khiển latency/error từ test.

### Không thực hiện

- Không triển khai Grading hoặc Notification; các phần này thuộc Week 8.
- Không đọc `course_db`, `enrollment_db`, `auth_db` hay source/entity/repository của service khác.
- Không dùng storage in-process/mock giả lập không qua network; storage mock phải tạo outbound/dependency span thật.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: Enrollment (task-01/02 Week 7) đã merge vào `main`; Course (Week 6) đã merge; HTTP contract v1 và data ownership matrix.
- Người hoặc phần việc cần phối hợp: Đức review contract Submission↔Enrollment/Course và ranh giới storage mock.
- Rủi ro/giả định: schema Submission chỉ chứa field tối thiểu (enrollment id, nội dung/tham chiếu file, trạng thái, thời điểm nộp); storage mock chạy như một service/process riêng trong Compose, không phải thư viện nội bộ.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Submission API, call tới Course/Enrollment, storage mock client và test | Code | `lms/services/submission/` |
| Storage mock service điều khiển được latency/error | Code | `lms/services/submission-storage-mock/` hoặc vị trí tương đương theo convention đã chốt |

## Definition of Done

- [x] Endpoint nộp bài và `GET /api/v1/submissions/{submission_id}` đúng response/error contract canonical, validation và quyền được kiểm tra.
- [x] Submission gọi Course và Enrollment qua HTTP để xác nhận hợp lệ trước khi chấp nhận bài nộp; course/enrollment không hợp lệ trả lỗi rõ ràng theo error envelope canonical.
- [x] Storage mock chạy như dependency qua network, có dependency identity ổn định, điều khiển được latency/error từ test, và tạo outbound/dependency span khi Submission gọi tới.
- [x] Submission là owner duy nhất của schema/data (nếu có persistence riêng); không cross-service database hoặc source import.
- [x] Unit và integration tests pass; build, lint, health và CI pass.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-04_implement-submission-service/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-04_implement-submission-service/output/task-output.md).
- Pull request: [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28).
- Kết quả review: Ngoại lệ workflow — không có GitHub `APPROVED`; Bách xác nhận trực tiếp ngày 24/09/2026 cho finalization sau vòng re-review kỹ thuật theo ủy quyền Đức.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Bách theo yêu cầu chia task tuần 7 (Đức làm trước với Enrollment, Bách làm sau với Submission).
- Cập nhật gần nhất: 24/09/2026 — Bách đã tạo nhánh và hồ sơ input sau khi PR #25, #26 và #27 merge vào `main`.
- Cập nhật gần nhất: 24/09/2026 — Bách xác nhận giữ HTTP contract v1; Task 4 chỉ triển khai `GET /api/v1/submissions/{submission_id}`, không thêm endpoint danh sách, và chuyển sang thực hiện.
- Cập nhật gần nhất: 24/09/2026 — Submission, `submission_db`, Storage Mock, unit/contract/PostgreSQL/telemetry tests và production Docker images đều đạt; substantive commit `587198a` đã push, mở PR [#28](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/28) và chuyển `Chờ review`.
- Cập nhật gần nhất: 24/09/2026 — Bách xác nhận ngoại lệ finalization khi chưa có GitHub `APPROVED`; vòng re-review kỹ thuật sau commit `1c699f7` không còn feedback blocking.
