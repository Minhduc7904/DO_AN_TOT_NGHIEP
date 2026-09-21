# Output task: Course service

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-course-service` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Cập nhật sau |
| Pull request | [#22](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/22) |
| Người review | Bách |
| Kết quả review | Chưa review |

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
| PR và review | Chờ review | PR #22; chưa có verdict GitHub |

## Tồn đọng

- Chờ Bách review; sau approval mới ghi nhận hoàn thành và merge.
