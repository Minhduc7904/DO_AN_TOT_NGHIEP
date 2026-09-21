# Output task: E2E W1–W2 qua Gateway

## Thông tin

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-login-to-course-workflow` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 21/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành |
| Tổng thời lượng | Cập nhật sau |
| Pull request | [#24](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/24) (draft) |
| Người review | Bách |
| Kết quả review | Chưa review |

## Báo cáo và sản phẩm

- Đã thêm E2E W1–W2 với PostgreSQL/Redis thực tại `lms/test/w2-postgres-workflow.e2e-spec.ts` và Auth PostgreSQL dependency signal.
- CI đầu trên [PR #24](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/24) đã pass E2E PostgreSQL/Redis và fresh Compose smoke; cần xác nhận lại sau khi đồng bộ nhánh. Chưa có lượt chạy độc lập của Bách.

## Đối chiếu DoD

| Điều kiện | Kết quả | Bằng chứng |
| --- | --- | --- |
| Fresh Compose | Đạt CI đầu | [PR #24 checks](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/24/checks); chờ head mới |
| JWT và browse course | Đạt CI đầu | W2 PostgreSQL/Redis E2E; chờ head mới |
| Timeout/failure envelope | Đạt CI đầu | W2 PostgreSQL/Redis E2E; chờ head mới |
| W3C và dependency signals | Đang kiểm tra | E2E assertions và Auth PostgreSQL instrumentation |
| CI và Bách chạy độc lập | Chưa đạt | Chưa có CI/PR/review |

## Tồn đọng

- Xác nhận CI trên PR head mới, nhờ Bách chạy độc lập và review sau khi PR sẵn sàng.
