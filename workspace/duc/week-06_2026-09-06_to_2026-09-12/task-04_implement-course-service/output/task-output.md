# Output task: Course service

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-course-service` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | 21/09/2026 |
| Tổng thời lượng | Trong ngày 21/09/2026 |
| Pull request | [#22](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/22) |
| Người review | Bách (không thực hiện được — nghỉ ốm) |
| Kết quả review | Ngoại lệ: không có GitHub `APPROVED`. Bách không thể review do nghỉ ốm; Đức (người phụ trách) xác nhận bỏ qua bước review độc lập ngày 21/09/2026 và tự finalization/merge theo cơ chế ngoại lệ trong `docs/processed/rules/git-and-pull-request-rules.md`. |

## Báo cáo và sản phẩm

- Đã thêm API create/get/list, PostgreSQL repository, migration/seed và unit test tại `lms/services/course/`.
- PostgreSQL migration, seed và repository integration đã pass trong [CI PR #22](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/22/checks); quality và security checks đều xanh.

## Đối chiếu DoD

| Điều kiện | Kết quả | Bằng chứng |
| --- | --- | --- |
| Endpoint, validation, quyền | Đạt | Course controller unit test và CI #22 |
| Migration/seed sạch và chạy lại | Đạt | PostgreSQL integration trong CI #22 |
| Data ownership và principal | Đạt | Course repository và controller; architecture test |
| Build, lint, test, health, CI | Đạt | [PR #22 checks](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/22/checks) |
| PR và review | Ngoại lệ | PR #22; không có GitHub `APPROVED` — Đức tự xác nhận bỏ qua review độc lập vì Bách nghỉ ốm |

## Tồn đọng

- Không còn tồn đọng kỹ thuật. Task hoàn thành theo ngoại lệ workflow: thiếu review độc lập của Bách do nghỉ ốm; Đức là người phụ trách tự xác nhận DoD, finalization và merge.
