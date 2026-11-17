# Câu hỏi phản biện có thể gặp và gợi ý trả lời

> **File này giải thích gì:** các câu hội đồng dễ hỏi về hai điểm quyết định (đóng góp của AI, độ thực của dữ liệu), kèm gợi ý trả lời có dẫn chứng. Câu trả lời cuối cùng phải dựa trên **kết quả thật** khi có; chỗ ghi "[số liệu]" điền sau tuần 20–21.
>
> **Nguồn gốc:** [ADR-007](../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md), [02-semi-real-data.md](02-semi-real-data.md), [03-proving-ai-contribution.md](03-proving-ai-contribution.md), [references.md](references.md).
>
> **Trạng thái tại:** 17/11/2026.

---

## A. Về đóng góp của AI/RCA

**1. "Truy vết thủ công vẫn tìm ra nguyên nhân, vậy AI để làm gì?"**
Đúng là khi quan sát đầy đủ, luật đơn giản thường đủ — nghiên cứu cũng xác nhận (Pham và cs. 2024, `[L-Pham2024ASE]`; Fang và cs. 2025, `[L-Fang2025]`), và nhóm báo cáo trung thực các case hòa. Engine đóng góp ở bốn chỗ đo được: phát hiện sự cố trong tải dao động thật mà chuông ngưỡng cố định báo sai (E1), giữ độ chính xác khi trace bị lấy mẫu hoặc mất (E3), giảm số thứ phải mở để chẩn đoán (E4), và chạy tự động, ổn định trên mọi incident. [số liệu E1/E3/E4]

**2. "Baseline thủ công là do nhóm tự viết, sao biết không cố tình làm yếu?"**
Định nghĩa `base-manual-auto` mô phỏng SRE thật (đi theo trace lỗi/chậm nhất, được đi qua cạnh async và xác thực — ADR-006), được chọn trên tập validation và đăng ký trước khi chạy test. Ngoài ra bảng chính có thêm hai baseline **đã công bố bởi người khác**: SimpleRCA và BARO (`[L-BARO]`).

**3. "Kết quả có phải chỉ đúng trên testbed do nhóm tự dựng và tự gây lỗi?"**
Đây là rủi ro thật. Nhóm giảm bằng: đăng ký trước giả thuyết và cấu hình; dùng traffic bán thực từ log thật; và (Target) chạy engine trên benchmark công khai RCAEval (`[L-RCAEval]`) để đặt cạnh số đã công bố. [kết quả E6 nếu có]

**4. "16 incident có đủ để kết luận không?"**
Không đủ để tuyên bố mạnh. Mọi con số kèm khoảng tin cậy bootstrap 95% và kiểm định ghép cặp McNemar; khi khoảng tin cậy chồng nhau, nhóm nói "chưa đủ bằng chứng". Nghiên cứu user study nổi tiếng cũng chỉ có ý nghĩa thống kê ở 2/6 task vì mẫu nhỏ (LogAssist, `[L-LogAssist]`).

**5. "Vì sao không dùng LLM/agent để chẩn đoán cho hiện đại?"**
MCP/agent nằm ngoài phạm vi (ADR-006). Các benchmark cho LLM còn điểm thấp: tốt nhất 11,34% trên OpenRCA (`[L-OpenRCA]`), 13,81% pass@1 trên ITBench (`[L-ITBench]`); và cần tài nguyên vượt máy của đề tài.

**6. "Top-3 đạt 75% có phải tốt không?"**
Chưa chắc: với 4 case có 4 nguyên nhân khác nhau, một danh sách xếp hạng cố định đã đạt Top-3 = 75%. Vì vậy chỉ số chính là Top-1 và MRR, luôn in kèm mốc ngẫu nhiên và xếp hạng hằng.

**7. "Có người thật dùng thử không?"**
(Target E7) [nếu làm: số người, thời gian trung bình có/không có engine, tỉ lệ đúng]. Nếu không làm: nói rõ là giới hạn, và bằng chứng gián tiếp là E4 (số thứ phải mở).

## B. Về dữ liệu

**8. "Dữ liệu này có thật không hay nhóm tự bịa?"**
Bán thực: phiên của học viên là **phiên thật** phát lại từ log Moodle công khai Unistudium 2022 (1.234 người, 208.109 sự kiện, CC BY 4.0, `[L-Unistudium]`), 95,2% sự kiện ánh xạ được sang API của LMS. Giảng viên/admin không có dữ liệu công khai nên dùng mô hình hành vi. Hệ thống LMS và sự cố là testbed có kiểm soát — cần thiết để có đáp án đúng (ground truth).

**9. "Sao biết traffic sinh ra giống thật?"**
So với phần log giữ lại không dùng để xây (hold-out) bằng KS, Jensen–Shannon, dáng theo giờ, độ dồn cục; ngưỡng chốt trước; và so cùng bộ đo cho hai cách giả lập đơn giản. [số liệu kiểm chứng tuần 14]

**10. "Log của trường Ý năm 2022 thì liên quan gì LMS của em?"**
Hành vi học trực tuyến (vào xem nhanh, đọc bài, làm quiz dồn trước hạn, đông buổi sáng) mang tính phổ quát; log này là log LMS công khai duy nhất vừa tải tự do vừa ghi tới giây. Giới hạn được nêu rõ: một trường, 4 khóa, đã khuếch đại tải.

**11. "Giảng viên gợi ý AI agent đóng vai người dùng, sao không làm?"**
Có làm ở dạng offline (Stretch): LLM sinh persona và nội dung một lần, đóng băng. Không chạy agent trực tiếp vì chậm (~8 s mỗi bước, bản v2 của UXAgent, `[L-UXAgent]`), lệch người thật (6,05 so với 15,96 thao tác/phiên, `[L-AgentAB]`) và không tái lập được (`[L-LLMNondet]`).

**12. "Tải mấy request mỗi giây có thực tế không?"**
Mục tiêu 5–20 request/giây sau khi chồng phiên, ghi rõ hệ số khuếch đại. Để so: một benchmark "thực tế" gần đây dùng 16,47 QPS, trong khi các benchmark cũ trên Train-Ticket chỉ 0,14–4,35 QPS (`[L-Fang2025]`).

## Tóm tắt

- Không hứa AI thắng mọi case; chỉ ra chỗ AI đo được là có ích (E1, E3, E4) và so với baseline đã công bố.
- Dữ liệu học viên là phiên thật từ log LMS công khai; độ thực được kiểm chứng bằng hold-out.
- Mọi kết luận có khoảng tin cậy và được đăng ký trước.
