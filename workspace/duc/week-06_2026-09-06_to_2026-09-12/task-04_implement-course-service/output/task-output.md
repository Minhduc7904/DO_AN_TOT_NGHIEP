# Output task: Course service

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-course-service` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Cập nhật sau |
| Pull request | [#22](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/22) (draft) |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo và sản phẩm

- Đã thêm API create/get/list, PostgreSQL repository, migration/seed và unit test tại `lms/services/course/`.
- PostgreSQL migration, seed và repository integration đã pass trong [CI run đầu](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/35596815895); toàn job thất bại do README chưa đúng format, đang sửa.

## Đối chiếu DoD

| Điều kiện | Kết quả | Bằng chứng |
| --- | --- | --- |
| Endpoint, validation, quyền | Đang kiểm tra | Unit test Course controller |
| Migration/seed sạch và chạy lại | Đạt bước integration | [CI run đầu](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/35596815895) |
| Data ownership và principal | Đang kiểm tra | Course repository và controller |
| Build, lint, test, health, CI | Chưa đạt đầy đủ | Build/lint/unit pass; chờ PostgreSQL/CI |
| PR và review | Chưa đạt | PR #22 draft; chưa có review |

## Tồn đọng

- Chờ quality/security checks xanh và nhờ Bách review sau khi PR head sẵn sàng.
