# Task tuần: Bổ sung contract/integration test cho Submission và storage dependency

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_add-submission-contract-and-storage-tests` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Đức review dependency identity và topology sinh từ trace |
| Ưu tiên | Cao |
| Hạn dự kiến | 19/09/2026 |
| Nhánh thực hiện | `test/week-07/task-05-add-submission-contract-and-storage-tests` |

## Yêu cầu và phạm vi

### Cần thực hiện

Bổ sung ít nhất một HTTP contract test cho Submission↔Course và Submission↔Enrollment. Bổ sung integration test cho storage mock dependency: latency injection, error injection và hành vi Submission khi storage lỗi/timeout (error envelope canonical, không mất dữ liệu enrollment/course đã xác nhận). Kiểm tra topology sinh ra từ trace (span Submission→Course, Submission→Enrollment, Submission→storage) khớp dependency thiết kế.

### Không thực hiện

- Không triển khai thêm business logic Submission ngoài phạm vi cần để test pass; thay đổi hành vi thuộc task-04.
- Không thêm fault injector F1 đầy đủ hoặc benchmark/experiment campaign.
- Không đưa student/course/submission ID, trace ID hoặc error message tùy ý thành Prometheus label cardinality cao.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-04 (Submission MVP và storage mock) đã có code trên nhánh; fault matrix F1 và telemetry schema.
- Người hoặc phần việc cần phối hợp: Đức kiểm tra dependency identity, RED metrics và topology sinh từ trace đủ cho phân tích sau này.
- Rủi ro/giả định: storage failure behavior cần nhất quán với error/timeout policy chung (Week 6) và không che lỗi thật của Course/Enrollment.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Contract/integration test Submission↔Course/Enrollment/storage | Code | `lms/services/submission/` hoặc `lms/test/` |
| Kiểm tra topology từ trace | Code | `lms/services/submission/` hoặc `lms/test/` |

## Definition of Done

- [x] Ít nhất một HTTP contract test cho Submission↔Course và một cho Submission↔Enrollment pass.
- [x] Test bao phủ storage mock latency injection, error injection và invalidation/fallback behavior theo policy đã chốt.
- [x] Span/metric cho Submission HTTP, `submission→course`, `submission→enrollment` và `submission→storage` có dependency identity canonical cùng status/duration/error cần thiết.
- [x] Topology sinh ra từ trace (dependency graph Submission→Course/Enrollment/storage) khớp thiết kế, có assertion kiểm tra.
- [x] Telemetry không chứa secret, JWT, PII, ground-truth label hoặc label cardinality cao bị cấm.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-05_add-submission-contract-and-storage-tests/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-05_add-submission-contract-and-storage-tests/output/task-output.md).
- Pull request: [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29).
- Kết quả review: Không có GitHub `APPROVED`. Theo xác nhận trực tiếp của Bách ngày 25/09/2026 về việc Đức cho phép ủy quyền, đã tự review kỹ thuật; Bách chỉ thị finalization theo ngoại lệ. Không ghi nhận thành verdict GitHub.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Bách theo yêu cầu chia task tuần 7; thực hiện sau task-04.
- Cập nhật gần nhất: 25/09/2026 — Bách khởi tạo hồ sơ workspace và nhánh `test/week-07/task-05-add-submission-contract-and-storage-tests` từ `main` sau khi PR #28 của task-04 đã merge.
- Cập nhật gần nhất: 25/09/2026 — contract/integration test cho Course, Enrollment và Storage Mock, cùng assertion topology/metric đã pass trong `pnpm run ci:verify`; bằng chứng nằm ở output workspace.
- Cập nhật gần nhất: 25/09/2026 — mở PR [#29](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/29), ghi URL vào hồ sơ và chuyển `Chờ review` trên nhánh Task 5; transition này phải có trên remote PR head trước khi Đức bắt đầu review.
- Cập nhật gần nhất: 25/09/2026 — sau khi feedback được sửa ở commit `32ec62b` và toàn bộ checks GitHub pass, Bách chỉ thị finalization theo ngoại lệ; không có GitHub `APPROVED`. JSON/timeline chưa đồng bộ vì thiếu PowerShell.
- Ghi chú/tồn đọng: Hạn canonical 19/09/2026 đã qua. PR #29 đã finalization trên task branch theo ngoại lệ của Bách; chưa có GitHub `APPROVED`, PR chưa merge và còn chờ Bách yêu cầu/thực hiện merge trong giới hạn branch protection. Timeline đang chờ đồng bộ do máy thiếu PowerShell; không sửa tay đầu ra sinh tự động.
