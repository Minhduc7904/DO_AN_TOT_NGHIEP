# research-defense — nghiên cứu cho hai điểm quyết định phản biện

> **Thư mục này giải thích gì:** phần nghiên cứu (17/11/2026) cho hai yêu cầu quan trọng khi phản biện: (1) chứng minh AI/RCA đóng góp thực sự; (2) dữ liệu trông thực tế, không giả lập hoàn toàn. Viết dễ hiểu, có trích dẫn đầy đủ để dùng khi viết báo cáo.
>
> **Quyết định chính thức:** [ADR-007](../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md); kế hoạch: [plan-v0.4](../../plan/plan-v0.4-24-weeks.md); danh mục tài liệu chuẩn: [literature-matrix-v1](../../plan/literature-matrix-v1.md). Khi ghi chú ở đây khác tài liệu gốc thì tài liệu gốc đúng.

## Đọc theo thứ tự

| # | File | Đọc để biết |
| --- | --- | --- |
| 1 | [01-why-these-two-questions.md](01-why-these-two-questions.md) | Giảng viên góp ý gì, vì sao hai điểm này quyết định, vì sao chúng thực ra là một |
| 2 | [02-semi-real-data.md](02-semi-real-data.md) | Traffic bán thực: phát lại phiên Moodle thật, nén lịch, chồng phiên, chứng minh giống thật bằng hold-out; vì sao mức 3 chỉ offline |
| 3 | [03-proving-ai-contribution.md](03-proving-ai-contribution.md) | Bộ bằng chứng E1–E8, thống kê dễ hiểu, đăng ký trước, nói gì khi engine hòa |
| 4 | [04-defense-qa.md](04-defense-qa.md) | 12 câu hội đồng dễ hỏi và gợi ý trả lời |
| 5 | [references.md](references.md) | Trích dẫn đầy đủ (tác giả, nơi đăng, DOI, URL, giấy phép, file PDF) và các điểm dễ trích sai |
| — | [papers/](papers/README.md) | PDF đã tải: bản có giấy phép mở được commit, bản còn lại ở `papers/local-only/` (không lên Git, tải lại bằng `papers/fetch-papers.sh`) |

## Một trang tóm tắt

- **Hai điểm là một:** workload đơn giản làm RCA trông giỏi hơn thực tế (Fang và cs. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711). Dữ liệu càng thật thì giá trị của AI (lọc nhiễu, phân biệt tải cao hợp lệ với sự cố) càng đo được rõ.
- **Dữ liệu:** học viên dùng **phiên thật** phát lại từ log Moodle Unistudium 2022 (`[L-Unistudium]`, https://zenodo.org/records/13763175); giảng viên/admin dùng mô hình hành vi; mức 3 chỉ offline. Chứng minh giống thật bằng hold-out, ngưỡng chốt trước.
- **AI:** không hứa thắng mọi case (baseline đơn giản rất mạnh: `[L-Pham2024ASE]`, `[L-Fang2025]`). Đo đúng chỗ: E1 phát hiện trong nhiễu, E3 quan sát thiếu, E4 công sức; E2 so với SimpleRCA và BARO đã công bố; Target: RCAEval (E6) và người thật (E7).

## Câu hội đồng có thể hỏi → trả lời ở đâu

| Câu hỏi | Xem |
| --- | --- |
| AI giúp gì khi thủ công vẫn tìm ra? | [03](03-proving-ai-contribution.md) mục 2–3; [04](04-defense-qa.md) câu 1 |
| Baseline có bị làm yếu cố ý không? | [03](03-proving-ai-contribution.md) mục 3 (E2), mục 5; [04](04-defense-qa.md) câu 2 |
| Kết quả có chỉ đúng trên testbed tự dựng? | [04](04-defense-qa.md) câu 3 (E6) |
| Dữ liệu có thật không? | [02](02-semi-real-data.md) mục 2; [04](04-defense-qa.md) câu 8 |
| Sao biết traffic giống thật? | [02](02-semi-real-data.md) mục 3 |
| Sao không làm AI agent đóng vai người dùng? | [02](02-semi-real-data.md) mục 4; [04](04-defense-qa.md) câu 11 |
| Mẫu nhỏ có kết luận được không? | [03](03-proving-ai-contribution.md) mục 4; [04](04-defense-qa.md) câu 4 |
