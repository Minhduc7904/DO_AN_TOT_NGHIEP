# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-research-questions-and-metrics` |
| Người phụ trách | Bách |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 26/08/2026 15:30 |
| Hoàn thành thực tế | Chưa hoàn thành toàn bộ task; kết thúc phiên làm việc lúc 26/08/2026 16:00 |
| Tổng thời lượng | 30 phút |
| Pull request | [PR #2](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/2) |
| Trạng thái pull request | Đang mở |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã chuyển RQ1–RQ5 thành các câu hỏi, giả thuyết hoặc phép so sánh có thể đánh giá trên testbed MVP.
- Đã xác định telemetry/ground truth, baseline/phương pháp và metric detection, RCA, system, robustness cho từng RQ.
- Đã bổ sung quy ước split theo experiment run, chống leakage, không tune trên final test campaign và bảng ánh xạ RQ → input → phương pháp → metric.
- Đã lập checklist feasibility để Đức review trong PR; hiện chưa có kết quả review.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Research questions và metrics v1 | Docs | [research-questions-and-metrics-v1.md](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| RQ1–RQ5 được ghi rõ, có phạm vi MVP và loại phép so sánh/ablation dự kiến; RQ6 chỉ xuất hiện nếu có quyết định bổ sung có chủ đích. | Đạt | [Các RQ và quyết định scope v1](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md#12-quyết-định-scope-v1) giữ RQ1–RQ5 và không đưa RQ6 vào v1. |
| Có bảng ánh xạ RQ → telemetry/ground truth → baseline hoặc phương pháp → metric detection/RCA/system/robustness. | Đạt | [Bảng ánh xạ RQ](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md#8-bảng-ánh-xạ-rq--input--phương-pháp--metric). |
| Metric detection, RCA và system phù hợp blueprint, bao gồm quy tắc không tune trên test campaign. | Đạt | [Metric definitions v1](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md#9-metric-definitions-v1) và [các biến phải kiểm soát](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md#10-các-biến-phải-được-kiểm-soát-khi-so-sánh). |
| Đức đã review tính khả thi của việc instrument, inject fault, thu ground truth và chạy evaluation cho từng RQ. | Chưa đạt | Bách xác nhận ngày 26/08/2026: chưa được Đức review. Checklist cần review nằm tại [mục 11](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md#11-feasibility-review-cần-đức-xác-nhận). |
| Sản phẩm được lưu tại `docs/processed/direction/research-questions-and-metrics-v1.md` và có thể truy cập. | Đạt | [Tài liệu sản phẩm](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md). |
| Pull request từ branch task vào `main` có đủ mục bắt buộc, được Đức review và chỉ được merge sau khi task đạt trạng thái `Hoàn thành`. | Chưa đạt | [PR #2](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/2) đang mở đúng branch vào `main`; chưa có review của Đức và chưa được phép merge. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không có.
- Việc chưa hoàn thành hoặc trở ngại: chưa có feasibility review của Đức; PR đang chờ review. Task chưa hoàn thành toàn bộ DoD.
- Bước tiếp theo: Đức review checklist feasibility và các thay đổi trong [PR #2](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/2); xử lý điểm cần chỉnh sửa nếu có; chỉ merge sau khi task đạt trạng thái `Hoàn thành`.

> Khi phần việc và DoD đã xong nhưng chưa review, dùng **Chờ review**. Chỉ chọn **Hoàn thành** khi mọi DoD đạt, sản phẩm có link/đường dẫn truy cập được và code review đã đạt. Pull request chỉ được merge sau khi task đã ở **Hoàn thành**.
