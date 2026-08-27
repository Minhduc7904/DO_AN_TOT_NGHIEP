# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_define-research-questions-and-metrics` |
| Người phụ trách | Bách |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 26/08/2026 15:30 |
| Hoàn thành thực tế | PR #2 đã merge vào `main` lúc 27/08/2026 17:16; completion record được đồng bộ sau merge |
| Tổng thời lượng | 30 phút phiên hoàn thiện ban đầu; có thêm phiên xử lý review ngày 27/08/2026 |
| Pull request | [PR #2](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/2) |
| Trạng thái pull request | Đã merge vào `main` tại commit `7a8217165cbd27d986751d26aedc79fb0b628f42`; artifact xử lý review ở commit `317d01a` |
| Người review | Đức |
| Kết quả review | APPROVED; Đức đã review và các blocking feedback đã được xử lý trong commit `317d01a` |

## Báo cáo công việc đã làm

- Đã chuyển RQ1–RQ5 thành các câu hỏi, giả thuyết hoặc phép so sánh có thể đánh giá trên testbed MVP.
- Đã xác định telemetry/ground truth, baseline/phương pháp và metric detection, RCA, system, robustness cho từng RQ.
- Đã bổ sung quy ước split theo experiment run, chống leakage, không tune trên final test campaign và bảng ánh xạ RQ → input → phương pháp → metric.
- Đã bổ sung provenance/reproducibility cho từng experiment run, gồm identity, fault, implementation, version/config theo từng stage và artifact lineage.
- Đã xử lý hai blocking comment về provenance và RQ4 strict paired comparison; full/degraded telemetry hiện bắt buộc dùng cùng baseline run/artifact và ground truth.
- Đã commit `317d01a` và push thay đổi artifact lên branch của PR #2; sau đó đã commit/push cập nhật hồ sơ trạng thái, không thay đổi phạm vi RQ1–RQ5.
- Đã lập checklist feasibility, được Đức review `APPROVED` trong PR và đã merge vào `main`; completion record được cập nhật sau merge.

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
| Đức đã review tính khả thi của việc instrument, inject fault, thu ground truth và chạy evaluation cho từng RQ. | Đạt | Đức đã review và chấp thuận sau khi xử lý hai blocking comment; thay đổi nằm ở commit `317d01a` trên [PR #2](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/2). |
| Sản phẩm được lưu tại `docs/processed/direction/research-questions-and-metrics-v1.md` và có thể truy cập. | Đạt | [Tài liệu sản phẩm](../../../../../docs/processed/direction/research-questions-and-metrics-v1.md). |
| Pull request từ branch task vào `main` có đủ mục bắt buộc, được Đức review, merge vào `main` và có merge reference để ghi nhận task hoàn thành. | Đạt | [PR #2](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/2) đã merge vào `main` tại commit `7a8217165cbd27d986751d26aedc79fb0b628f42`; artifact xử lý review nằm ở commit `317d01a`. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: bổ sung các yêu cầu provenance/reproducibility và strict paired comparison theo blocking review; không thay đổi research direction.
- Việc đã xử lý: hai blocking comment đã được cập nhật trong artifact và push lên PR bằng commit `317d01a`.
- Việc còn lại: không có; PR #2 đã merge vào `main` và hồ sơ đã được ghi nhận hoàn thành.

> Review đạt chưa là **Hoàn thành**: PR phải merge vào nhánh canonical, rồi người phụ trách cập nhật completion record trước khi chuyển **Hoàn thành**.
