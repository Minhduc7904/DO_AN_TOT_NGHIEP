# Output task: E2E W1–W2 qua Gateway

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-login-to-course-workflow` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Cập nhật sau |
| Pull request | [#24](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/24) (chờ review) |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo và sản phẩm

- Đã thêm E2E W1–W2 với PostgreSQL/Redis thực tại `lms/test/w2-postgres-workflow.e2e-spec.ts` và Auth PostgreSQL dependency signal.
- [CI trên head mới của PR #24](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/35598020547) đã pass E2E PostgreSQL/Redis, telemetry assertions và fresh Compose W1–W2 smoke. Chưa có lượt chạy độc lập của Bách.

## Đối chiếu DoD

| Điều kiện | Kết quả | Bằng chứng |
| --- | --- | --- |
| Fresh Compose | Đạt | [PR #24 CI](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/35598020547): fresh Compose W1–W2 smoke |
| JWT và browse course | Đạt | W2 PostgreSQL/Redis E2E và fresh Compose smoke trên PR #24 |
| Timeout/failure envelope | Đạt | W2 PostgreSQL/Redis E2E trên PR #24 |
| W3C và dependency signals | Đạt | Telemetry assertions và Auth PostgreSQL instrumentation trên PR #24 |
| CI và Bách chạy độc lập | Chưa đạt toàn bộ | CI PR #24 xanh; Bách chưa chạy độc lập |

## Tồn đọng

- Bách chạy độc lập W1–W2, ghi kết quả/giới hạn và review PR #24; sau approval mới finalization và merge theo thứ tự nhánh.
