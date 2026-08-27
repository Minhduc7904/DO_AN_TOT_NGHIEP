# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_create-risk-register` |
| Người phụ trách | Bách |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 27/08/2026 — phiên setup workspace |
| Hoàn thành thực tế | Chưa hoàn thành workflow; artifact v1 được tạo ngày 27/08/2026 |
| Tổng thời lượng | Chưa chốt |
| Pull request | Chưa tạo |
| Trạng thái pull request | Chưa tạo |
| Người review | Đức |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Đã đồng bộ `main` với `origin/main`.
- Đã tạo branch riêng cho task: `docs/week-03/task-04-create-risk-register`.
- Đã khởi tạo hồ sơ input/output trong workspace cá nhân của Bách.
- Đã cập nhật card task sang `Đang thực hiện`.
- Đã đối chiếu plan v0.2, backend blueprint, Analysis/AI/RCA blueprint và research questions/metrics v1.
- Đã tạo risk register v1 gồm quy ước ưu tiên/trạng thái, MVP floor, thứ tự cắt scope, 14 rủi ro và các control action tuần 4.
- Đã commit cục bộ theo yêu cầu; chưa push, chưa tạo PR và chưa có review của Đức.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Hồ sơ input task | Khác | [task-input.md](../input/task-input.md) |
| Hồ sơ output task | Khác | [task-output.md](task-output.md) |
| Risk register v1 | Docs | [risk-register-v1.md](../../../../../docs/processed/plan/risk-register-v1.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Register bao phủ tối thiểu scope, testbed, observability, telemetry/data quality, reproducibility, data leakage, evaluation và tiến độ. | Đạt ở artifact v1 | [Risk register](../../../../../docs/processed/plan/risk-register-v1.md#4-risk-register) có 14 risk bao phủ đầy đủ các nhóm bắt buộc. |
| Mỗi rủi ro có tín hiệu sớm, mức độ ưu tiên, owner, mitigation và quy tắc giảm/cắt scope cụ thể. | Đạt ở artifact v1 | [Bảng risk register](../../../../../docs/processed/plan/risk-register-v1.md#4-risk-register) có đủ các cột kiểm chứng cho từng risk. |
| Các rủi ro đã có trong plan/blueprint được giữ nhất quán; không tạo quyết định kiến trúc cạnh tranh. | Đạt ở artifact v1 | [Nguồn canonical](../../../../../docs/processed/plan/risk-register-v1.md#1-thông-tin-và-phạm-vi-áp-dụng), [MVP floor và thứ tự cắt scope](../../../../../docs/processed/plan/risk-register-v1.md#3-baseline-không-được-cắt-và-thứ-tự-giảm-scope). |
| Đức đã review nhóm rủi ro platform/experiment; các hành động tuần 4 được liên kết hoặc ghi rõ là tồn đọng. | Chưa đạt — chưa review | [Hành động tuần 4](../../../../../docs/processed/plan/risk-register-v1.md#5-hành-động-bắt-buộc-trong-tuần-4) đã liên kết và đánh dấu `Tồn đọng`; vẫn cần Đức review `R-02`, `R-03`, `R-05`, `R-06`, `R-07`, `R-13`. |
| Risk register được lưu tại `docs/processed/plan/risk-register-v1.md` và có thể truy cập. | Đạt | [Risk register v1](../../../../../docs/processed/plan/risk-register-v1.md). |
| Pull request từ branch task vào `main` có đủ mục bắt buộc, được Đức review và chỉ được merge sau khi task đạt trạng thái `Hoàn thành`. | Chưa đạt — chưa tạo PR | PR sẽ tạo sau khi hoàn tất deliverable. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: không thay đổi phạm vi; artifact được cụ thể hóa thành 14 risk và một bảng control action tuần 4 để có thể rà soát hằng tuần.
- Việc chưa hoàn thành hoặc trở ngại: chưa có review của Đức; chưa push và chưa tạo PR.
- Bước tiếp theo: yêu cầu Đức review nhóm platform/experiment, xử lý feedback, sau đó push và tạo PR khi Bách yêu cầu.

> Task vẫn ở trạng thái `Đang thực hiện` vì artifact và các điều kiện DoD chưa hoàn tất.
