# Chứng minh AI/RCA đóng góp thực sự: đo đúng chỗ, so đúng đối thủ

> **File này giải thích gì:** trả lời câu hỏi của giảng viên "truy vết thủ công vẫn tìm ra, vậy AI giúp gì?" bằng một bộ bằng chứng E1–E8: mỗi bằng chứng đo gì, vì sao thuyết phục, trình bày thế nào, và nói gì khi engine chỉ hòa.
>
> **Nguồn gốc (canonical):** [ADR-007](../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 3–5; [ADR-006](../../adr/adr-006-trim-project-scope-v1.md) mục 2–3; [evaluation-protocol-v1](../../architecture/evaluation-protocol-v1.md); [plan-v0.4](../../plan/plan-v0.4-24-weeks.md) tuần 16–21. Tài liệu tham khảo: [references.md](references.md).
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch). Chưa có kết quả nào: đây là thiết kế phép đo.

---

## 1. Điều nghiên cứu nói: đừng hứa "AI thắng mọi case"

- **Không phương pháp nào thắng mọi lúc.** Pham và cs. đánh giá 21 phương pháp RCA: "no method stands out in all situations"; nhiều phương pháp suy luận nhân quả cho kết quả gần như chọn ngẫu nhiên; vài phương pháp thống kê đơn giản chạy 0,01 giây mỗi case mà vẫn cạnh tranh (ASE 2024, `[L-Pham2024ASE]`, https://arxiv.org/abs/2408.13729, file [`papers/2024-pham-causal-rca-how-far.pdf`](papers/2024-pham-causal-rca-how-far.pdf)).
- **Luật đơn giản thường ngang SOTA.** SimpleRCA — chỉ đếm số cảnh báo theo service (metric vượt 3-sigma, trace chậm gấp 3, log có từ khóa lỗi) — có Top@1 cao hơn phương pháp SOTA tương ứng trên 7/11 bộ dữ liệu (Fang và cs. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711, file [`papers/2025-fang-rca-benchmark.pdf`](papers/2025-fang-rca-benchmark.pdf)).
- **Áp vào đồ án:** baseline thủ công tự động `base-manual-auto` (ADR-006) đi theo trace lỗi/chậm nhất — về bản chất gần SimpleRCA/TraceRCA. Ở C2, C3, C4, span lỗi của nguyên nhân nằm ngay trong trace, nên nếu chỉ so Top-K khi quan sát đầy đủ, engine **rất có thể chỉ hòa**.

Kết luận: hứa thắng mọi case mà kết quả hòa thì cả báo cáo mất tin cậy. Nói trước chỗ nào sẽ hòa, và đo ở những chỗ người/luật đơn giản thật sự yếu.

## 2. Lập luận trung tâm

> Khi quan sát đầy đủ và tải đơn giản, luật đơn giản hoặc người đã đủ tìm ra nguyên nhân — nhóm báo cáo trung thực điều này. RCA engine tạo giá trị ở bốn chỗ: **phát hiện** sự cố trong nhiễu của tải thật, **giữ độ chính xác khi quan sát bị thiếu**, **giảm công sức và thời gian** chẩn đoán, và chạy **tự động, ổn định** trên mọi incident.

Ví dụ đời thường: bác sĩ giỏi đọc phim X-quang rõ nét thì không cần máy. Máy hữu ích khi phim mờ, khi có hàng trăm phim mỗi ngày, và khi cần phát hiện sớm dấu hiệu nhỏ lẫn trong nhiễu.

## 3. Tám bằng chứng E1–E8

| # | Đo gì | Vì sao thuyết phục | Mức |
| --- | --- | --- | --- |
| **E1** | Detector học máy so với **chuông báo ngưỡng cố định** trên tải bán thực: số báo động giả mỗi giờ trên run khỏe có cao điểm trước hạn quiz; độ trễ phát hiện và tỉ lệ bắt được sự cố trên run có lỗi | Ngưỡng cố định giống chuông báo cháy chỉnh một mức cho cả ngày lẫn đêm: đặt thấp thì giờ cao điểm kêu liên tục, đặt cao thì đêm cháy nhỏ không kêu. Detector học "bình thường" theo từng lúc. **Dữ liệu càng thật, lợi thế này càng rõ** — nối thẳng hai góp ý | MVP |
| **E2** | Bảng chính: engine so với random, xếp hạng hằng, ngưỡng tĩnh, `base-manual-auto`, **SimpleRCA**, **BARO**; Top-1 và MRR là chỉ số chính, kèm Top-3; theo từng case | So với baseline mạnh **đã công bố**, không chỉ đối thủ tự đặt. BARO: Pham và cs., FSE 2024, `[L-BARO]`, https://arxiv.org/abs/2405.09330, file [`papers/2024-pham-baro.pdf`](papers/2024-pham-baro.pdf) | MVP |
| **E3** | Quan sát suy giảm: chỉ giữ 50% rồi 10% trace; log mất `trace_id`; mất một nguồn (metric/trace/log) | Production thường lấy mẫu trace. Truy vết dựa trace sụp khi mất trace; engine dùng nhiều nguồn vẫn còn metric và log | MVP |
| **E4** | Chi phí chẩn đoán: số trace, biểu đồ, truy vấn log `base-manual-auto` phải mở; thời gian tới kết luận | "Hỗ trợ" nghĩa là bớt việc cho người: engine trả sẵn bằng chứng đã chọn | MVP |
| **E5** | Ablation: bỏ từng nguồn dữ liệu, bỏ đồ thị phụ thuộc, bỏ yếu tố thời gian, thay detector học máy bằng z-score | Chứng minh từng phần của engine thật sự đóng góp, không phải "hộp đen may mắn" | MVP |
| **E6** | Chạy engine trên benchmark công khai **RCAEval RE2** (Online Boutique, Train-Ticket), đặt cạnh số đã công bố | Chống nghi ngờ "tự ra đề tự chấm". RCAEval: `[L-RCAEval]`, https://arxiv.org/abs/2412.17015, file [`papers/2025-pham-rcaeval-benchmark.pdf`](papers/2025-pham-rcaeval-benchmark.pdf). Ví dụ số công bố trên RE2-TT (AC@1): BARO 0,67, TraceRCA 0,66, CIRCA 0,32 | Target |
| **E7** | Thử nghiệm người: mỗi người 4 incident, nửa dùng Grafana thủ công, nửa có báo cáo engine; đo thời gian, đúng/sai, số thứ đã mở, độ mệt (NASA-TLX), độ dễ dùng (SUS) | Bằng chứng trực tiếp nhất cho chữ "hỗ trợ". Mẫu tham khảo: LogAssist — 19 người, tổng thời gian giảm 42,49%, nhưng 2 task dễ nhất lại chậm hơn khi có công cụ (IEEE TSE 2022, online 2021, `[L-LogAssist]`, https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf) | Target |
| **E8** | Case study C6: engine chỉ ra `identity` im lặng (cờ `telemetry_silent`) dù lỗi hiện ở gateway, đặt cạnh đường truy vết thủ công | Cho hội đồng thấy cụ thể "engine nhìn được điều gì mà người dễ bỏ sót" | MVP |

Thêm cho bộ case: mỗi case có ít nhất một lần chạy đặt lỗi **đúng lúc cao điểm tải** (nhiều triệu chứng, tải cao hợp lệ lẫn với sự cố) — nơi ngưỡng cố định và truy vết theo trace đầu tiên dễ sai nhất.

## 4. Thống kê dễ hiểu

- **Mẫu nhỏ:** 4 case × 4 lần test = 16 incident. Với mẫu nhỏ, mọi con số phải kèm **khoảng tin cậy**.
- **Bootstrap CI 95%:** lấy ngẫu nhiên có hoàn lại 16 incident hàng nghìn lần, mỗi lần tính lại Top-1, xem kết quả dao động trong khoảng nào. Nếu khoảng của engine và baseline chồng nhau nhiều thì chưa thể nói ai hơn.
- **McNemar (kiểm định ghép cặp):** chỉ nhìn các incident mà **một bên đúng, bên kia sai**. Nếu engine đúng–baseline sai nhiều hơn hẳn chiều ngược lại thì mới có bằng chứng engine hơn. Ghép cặp vì cả hai chạy trên **cùng** incident.
- **MRR:** trung bình của 1/vị trí của đáp án đúng trong danh sách xếp hạng. Đúng ở hạng 1 được 1 điểm, hạng 2 được 0,5, hạng 3 được 0,33. Phân biệt được "gần đúng" với "sai hẳn".
- **Mốc ngẫu nhiên và xếp hạng hằng:** với 4 case có 4 nguyên nhân khác nhau, một danh sách xếp hạng cố định đã đạt Top-3 = 75%. Vì vậy Top-1 và MRR mới là chỉ số chính, và luôn in kèm hai mốc này (ADR-006).

## 5. Đăng ký trước (pre-registration)

Trước khi chạy run test (tuần 19), commit vào repo: giả thuyết của E1–E5, cấu hình engine và baseline (đã chọn trên tập validation), ngưỡng, cách tính CI và kiểm định. Sau đó không đổi. Giống nộp đáp án dự kiến trước khi mở đề: hội đồng không thể nói "nhóm chỉnh phép đo cho đẹp kết quả".

## 6. Nếu engine hòa hoặc thua thì nói gì

| Tình huống | Cách trình bày |
| --- | --- |
| Hòa `base-manual-auto` về Top-1 khi quan sát đầy đủ | Đúng như dự đoán ở mục 1 (dẫn `[L-Pham2024ASE]`, `[L-Fang2025]`); giá trị nằm ở E1, E3, E4 |
| Thua SimpleRCA/BARO ở một case | Báo cáo đầy đủ, phân tích nguyên nhân (error analysis); các bài trên cho thấy SOTA cũng thua kiểu đó |
| Thua trên RCAEval | RCAEval là kiểm tra khả năng tổng quát, không phải bảng xếp hạng; ghi rõ khác biệt dữ liệu (không có cạnh async/xác thực) |
| CI chồng nhau | Nói "chưa đủ bằng chứng để khẳng định khác biệt", không tuyên bố hơn |

## Tóm tắt

- Không hứa thắng mọi case: baseline đơn giản rất mạnh (`[L-Pham2024ASE]`, `[L-Fang2025]`).
- Đo đúng chỗ: phát hiện trong nhiễu (E1), quan sát thiếu (E3), công sức (E4), kèm bảng chính với baseline đã công bố (E2), ablation (E5), case study (E8).
- Target: đối chứng ngoài trên RCAEval (E6) và thử nghiệm người (E7).
- Mẫu nhỏ thì luôn kèm CI; đăng ký trước để không bị nghi chỉnh phép đo.

## Câu hỏi tự kiểm tra

1. Vì sao nhóm không lập luận "người không tìm ra, AI tìm ra"?
   <details><summary>Đáp án</summary>Vì không đúng: trace đã nối xuyên service, ở nhiều case span lỗi của nguyên nhân nằm ngay trong trace. Nghiên cứu cũng cho thấy luật đơn giản thường ngang phương pháp phức tạp. Lập luận đúng là AI giúp ở chỗ phát hiện trong nhiễu, khi quan sát thiếu, và giảm công sức.</details>
2. E1 nối hai góp ý của giảng viên như thế nào?
   <details><summary>Đáp án</summary>Tải bán thực có đông vắng và cao điểm thật, nên chuông báo ngưỡng cố định hoặc báo động giả ở giờ cao điểm hoặc bỏ sót lúc vắng; detector học máy học được "bình thường theo từng lúc". Dữ liệu càng thật thì lợi thế của AI càng đo được rõ.</details>
3. McNemar khác so sánh hai tỉ lệ đúng thông thường ở điểm nào?
   <details><summary>Đáp án</summary>McNemar ghép cặp trên cùng incident và chỉ dùng các incident hai bên bất đồng (một đúng, một sai), nên phù hợp khi engine và baseline chạy trên cùng dữ liệu.</details>
4. Vì sao Top-3 không phải chỉ số chính?
   <details><summary>Đáp án</summary>Với 4 case có 4 nguyên nhân khác nhau, một danh sách xếp hạng cố định đã đạt Top-3 = 75% mà không cần nhìn telemetry; Top-1 và MRR phân biệt tốt hơn.</details>
