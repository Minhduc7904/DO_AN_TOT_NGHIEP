# Vì sao hai câu hỏi này quyết định kết quả phản biện

> **File này giải thích gì:** giảng viên đã góp ý gì ở buổi giữa kỳ; vì sao "AI có đóng góp thật không" và "dữ liệu có thật không" là hai điểm hội đồng chắc chắn hỏi; vì sao nghiên cứu gần đây cho thấy hai câu hỏi thực ra là **một**; và nhóm đã chốt hướng trả lời nào (ADR-007).
>
> **Nguồn gốc:**
>
> - [plan-v0.3 mục 0](../../plan/plan-v0.3-24-weeks.md) (ghi lại góp ý giữa kỳ)
> - [ADR-006](../../adr/adr-006-trim-project-scope-v1.md) (vai trò "hỗ trợ", `base-manual-auto`, bốn case MVP)
> - [ADR-007](../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) (quyết định: workload bán thực, bộ bằng chứng E1–E8)
> - [realism-and-ai-contribution-strategy-v1](../../direction/realism-and-ai-contribution-strategy-v1.md) (đề xuất gốc kèm tra cứu)
> - Tài liệu ngoài: xem [references.md](references.md); PDF ở [papers/](papers/README.md)
>
> **Trạng thái:** 17/11/2026 (tuần 16 theo lịch, tuần 13 của plan). Phần lớn nội dung dưới đây là **kế hoạch**, chưa có số đo; chỗ nào đã đo thật được ghi rõ.

Quy ước trong cả bộ: **"Nghiên cứu nói"** là điều đã có trong bài báo (kèm nguồn); **"Đồ án đề xuất"** là cách nhóm áp dụng, chưa được ai kiểm chứng ngoài nhóm.

---

## 1. Giảng viên đã góp ý gì

Sau báo cáo giữa kỳ (sau tuần 10), giảng viên hướng dẫn nêu hai yêu cầu (ghi trong plan-v0.3 mục 0):

1. **"Truy vết thủ công vẫn tìm ra nguyên nhân, vậy AI/ML giúp gì?"** Phải chứng minh áp dụng ML/AI giúp chẩn đoán **hiệu quả hơn hoặc nhanh hơn** truy vết thủ công.
2. **"Traffic giả lập phải gần hành vi người dùng thật"**, không phải k6 bắn request đơn thuần. Gợi ý ba mức:
   - mức 1: giả lập chuỗi request;
   - mức 2: mô phỏng hành vi (User Profile → Goal → Behavior Model → Next Action → System Response → Update User State → Next Action);
   - mức 3: AI agent đóng vai người dùng.

   Kèm một câu quan trọng: **làm hướng khác thì phải chứng minh được**.

Bách nhấn mạnh thêm cho yêu cầu 2: dữ liệu phải **trông thực tế**, không được giả lập hoàn toàn.

## 2. Vì sao đây là hai điểm quyết định

### 2.1. Câu hỏi về AI: nếu không trả lời được thì phần AI thành "thừa"

Tên đề tài có chữ "dựa trên **học máy**". Nếu hội đồng thấy một người (hoặc một luật đơn giản) cũng tìm ra nguyên nhân y như vậy, phần AI không còn lý do tồn tại. Rà soát của nhóm cho thấy rủi ro này **có thật** trên testbed v2:

| Quan sát trên testbed (đã kiểm) | Vì sao đáng lo |
| --- | --- |
| Trace đã nối xuyên RabbitMQ: ở C2, C3, C4 span CLIENT chậm/lỗi của nguyên nhân **nằm ngay trong trace** | Một kỹ sư (hoặc luật `base-manual-auto` "đi theo span lỗi sâu nhất") rất có thể tìm đúng ([ADR-006](../../adr/adr-006-trim-project-scope-v1.md) tự thừa nhận) |
| Bốn case MVP có bốn nguyên nhân khác nhau (`course`, `ai`, `media`, `identity`) | Một bảng xếp hạng **cố định**, không nhìn dữ liệu, đã đạt Top-3 = 3/4 = 75% (Top-1 = 25%). Chỉ số Top-3 "bão hòa", không phân biệt được ai giỏi |
| Candidate set có 10 service | Đoán bừa đã được Top-1 = 1/10, Top-3 = 3/10 |

Ví dụ đời thường: một bài kiểm tra trắc nghiệm mà đáp án luôn là A, B hoặc C thì học sinh tô bừa ba ô đầu cũng được điểm cao. Muốn biết ai giỏi, phải đổi cách chấm (Top-1, MRR) và đổi đề (khó hơn, giống thật hơn).

### 2.2. Câu hỏi về dữ liệu: nếu dữ liệu "tự bịa" thì kết quả không ai tin

Nhóm tự viết hệ thống, tự gây lỗi, tự sinh traffic, tự chấm điểm. Hội đồng dễ nghi "tự ra đề tự chấm": traffic được sinh sao cho AI dễ thắng. Trước ADR-007, traffic của đồ án vẫn **100% do máy sinh**: mức 1 đã cài (PR #76), mức 2 đã thiết kế (PR #78) nhưng xác suất chuyển trạng thái, mức kiên nhẫn, đường cong theo giờ là "giả định của đề tài". OULAD (dữ liệu thật duy nhất đang dùng) chỉ có tổng click **theo ngày**, không dựng lại được phiên làm việc.

Ví dụ đời thường: diễn tập phòng cháy mà người đóng vai nạn nhân đi thành hàng thẳng tắp, đúng giờ, không ai hoảng loạn. Đội cứu hỏa "xuất sắc" trong buổi diễn tập đó chưa nói lên được gì về một đám cháy thật.

## 3. Hai câu hỏi thực ra là một

**Nghiên cứu nói** — Fang và cs. (2025) [L-Fang2025] ([arXiv 2510.04711](https://arxiv.org/abs/2510.04711), PDF [`papers/2025-fang-rca-benchmark.pdf`](papers/2025-fang-rca-benchmark.pdf), bản v2; đã đăng ở FSE 2026):

- Các bộ dữ liệu đánh giá RCA (phân tích nguyên nhân gốc) phổ biến có workload "ở mức đồ chơi" (*toy level*). Bài đưa bốn ví dụ trên hệ Train-Ticket: Nezha-TT 0,14 request/giây (QPS), Eadro-TT 0,25, RE2-TT 4,35, RE3-TT 1,34 (mục 6.1.2). Request của RE2-TT chỉ chạm 27/69 service (39%) (Bảng 1 và mục 6.1.2).
- Một luật rất đơn giản, **SimpleRCA** (đếm cảnh báo của từng service, service nhiều cảnh báo nhất đứng đầu), có Top@1 cao hơn phương pháp hiện đại nhất (SOTA) tương ứng ở **7/11** bộ dữ liệu cũ (Bảng 2; tự đếm từ bảng). Kết luận của tác giả: các bộ hiện có "potentially overstating model effectiveness" (có thể thổi phồng hiệu quả mô hình).
- Khi chuyển sang bộ mới, khó và thực tế hơn (workload theo máy trạng thái 16,47 QPS, phủ 42/50 service = 84%, độ sâu gọi tối đa 7, 1.430 case lỗi đã kiểm có tác động tới người dùng), Top@1 trung bình của 11 phương pháp chỉ còn **0,21**, cao nhất 0,37; Nezha từ 0,87 (trên bộ Nezha-TT) còn **0,04** (Bảng 5).

**Lưu ý khi trích (quan trọng):** bộ mới của Fang thay đổi **nhiều thứ cùng lúc** (cường độ và độ đa dạng workload, độ sâu gọi, loại lỗi, cách lọc case). Không được nói "chỉ vì workload mà Nezha tụt từ 0,87 xuống 0,04". Câu đúng: "khi đánh giá trên dữ liệu khó và giống thật hơn, trong đó workload động là một thành phần, độ chính xác của các phương pháp giảm mạnh".

**Đồ án rút ra:**

```text
Dữ liệu càng giống thật
   → hệ thống càng "ồn" (cao điểm trước hạn quiz, người dùng thử lại, bỏ ngang…)
   → luật đơn giản và ngưỡng cố định càng dễ báo nhầm hoặc chỉ sai chỗ
   → chỗ AI có giá trị mới hiện ra và đo được
   → phép đánh giá mới trung thực
```

Nói cách khác: làm dữ liệu thật hơn **không phải để** trang trí cho đẹp, mà để phép thử AI có ý nghĩa. Câu trả lời cho câu hỏi 2 là điều kiện để câu trả lời cho câu hỏi 1 đáng tin.

Ví dụ đời thường: chuông báo cháy chỉnh **một mức ngưỡng cố định** cho cả ngày lẫn đêm. Ban đêm bếp tắt, ngưỡng đó ổn. Giờ nấu cơm trưa, khói bếp vượt ngưỡng, chuông kêu suốt (báo động giả). Muốn biết một máy báo cháy "thông minh" có hơn chuông thường không, phải thử trong **một ngày có bữa trưa thật**, chứ không phải trong căn bếp lúc nửa đêm.

## 4. Nhóm đã chốt hướng trả lời nào (ADR-007, 17/11/2026)

| Câu hỏi | Câu trả lời ngắn | Bằng chứng sẽ có | Chi tiết |
| --- | --- | --- | --- |
| Dữ liệu có thật không? | Traffic của **học viên** là **phát lại phiên thật** từ log Moodle công khai (Unistudium 2022); traffic của giảng viên/admin/job lịch do mô hình mức 2 sinh vì không có dữ liệu công khai; nội dung do LLM sinh **một lần** (Stretch). Gọi là **bán thực** | So traffic sinh ra với phần log **giữ lại không dùng để xây** (hold-out), và so với hai cách giả lập đơn giản; ngưỡng chốt trước | [02-semi-real-data.md](02-semi-real-data.md) |
| AI đóng góp gì? | Không hứa "AI thắng mọi case". AI có giá trị ở bốn chỗ: **phát hiện** sự cố trong nhiễu của tải thật, **giữ độ chính xác khi quan sát bị thiếu**, **giảm công sức** chẩn đoán, chạy **tự động, ổn định** | E1–E8: so với baseline mạnh đã công bố (SimpleRCA, BARO), đối chứng trên benchmark công khai RCAEval, thử nghiệm người nhỏ; đăng ký trước cách chấm | [03-proving-ai-contribution.md](03-proving-ai-contribution.md) |

### 4.1. Ánh xạ sang ba mức của giảng viên

| Mức giảng viên gợi ý | Đồ án làm gì | Vì sao |
| --- | --- | --- |
| 1 — chuỗi request | Có (đã cài, PR #76). Dùng làm **mốc giả lập đơn giản** khi chứng minh độ thực | Cần một mốc "kiểu benchmark cũ" để so |
| 2 — mô phỏng hành vi | Có, nhưng **chỉ** cho giảng viên, admin, job lịch (W2, W5, W6, W7 và phía giảng viên của W4) | Không có log công khai cho các vai này |
| (thêm) 2+ — phát lại phiên thật | **Nguồn chính** cho học viên (W1, W3, W4 phía học viên) | Đây là phần "không giả lập hoàn toàn" |
| 3 — AI agent đóng vai người | Chỉ dạng **offline**: LLM sinh persona và nội dung một lần, lưu lại, k6 đọc; không chạy agent online làm nguồn tải. Mức Stretch | Agent online chậm (~8 giây mỗi bước), không tất định, hành vi lệch người thật; có số liệu dẫn chứng (mục 10 của file 02) |

"Làm hướng khác thì phải chứng minh được": mức 2+ là hướng khác so với ba mức gợi ý, nên đồ án phải có **phép kiểm chứng định lượng** (hold-out, ba nguồn so sánh, ngưỡng chốt trước). Mức 3 không làm đầy đủ thì phải có **lập luận có trích dẫn**, không chỉ một câu "khó tái lập".

## 5. Hiện trạng tại 17/11/2026

| Phần | Trạng thái |
| --- | --- |
| Fault overlay (toxiproxy cho C2/C4, LLM stub cho C3, `docker pause` cho C6) | Đã cài, PR #75 đang mở |
| k6 mức 1 (W1–W7) | Đã cài, PR #76 đang mở; run 2 phút: 7/7 hành trình, 737 request, 0 lỗi ngoài mong đợi |
| Export telemetry ra Parquet | Đã cài, PR #77 đang mở |
| Data dictionary + phiếu chất lượng | Đã cài, PR #79 đang mở |
| Thiết kế workload mức 1 + 2 | PR #78 đang mở, đang bổ sung mục mức 2+ và mức 3 offline |
| Mức 2+ (phát lại log Moodle), kiểm chứng hold-out | **Chưa làm**, plan tuần 14 |
| RCA engine, baseline, E1–E8 | **Chưa làm**, plan tuần 15–21 |

Vì vậy khi nói với hội đồng, mọi con số về hiệu quả của engine phải chờ campaign; hiện tại chỉ trình bày được **thiết kế** của phép chứng minh và **lý do** chọn thiết kế đó.

---

## Tóm tắt

- Hai góp ý của giảng viên: chứng minh AI giúp chẩn đoán tốt hơn/nhanh hơn thủ công; traffic phải gần người dùng thật (gợi ý ba mức, làm khác thì phải chứng minh).
- Rủi ro thật trên testbed v2: span lỗi nằm ngay trong trace; xếp hạng cố định đã đạt Top-3 = 75% trên bốn case MVP.
- Nghiên cứu (Fang 2025) cho thấy dữ liệu đánh giá đơn giản làm RCA trông giỏi hơn thực tế; luật đơn giản SimpleRCA ngang hoặc hơn SOTA ở 7/11 bộ cũ, nhưng trên bộ khó và thật hơn, cả 11 phương pháp chỉ còn Top@1 trung bình 0,21.
- Vì vậy hai câu hỏi là một: dữ liệu thật hơn là điều kiện để phép thử AI có ý nghĩa.
- ADR-007 chốt: học viên dùng phiên thật từ log Moodle (mức 2+); AI được chứng minh ở bốn chỗ bằng E1–E8, có baseline mạnh và đăng ký trước.

## Câu hỏi tự kiểm tra

1. Vì sao chỉ số Top-3 không đủ để chứng minh engine giỏi trên bốn case MVP?

<details><summary>Đáp án</summary>
Bốn case có bốn nguyên nhân khác nhau, nên một bảng xếp hạng cố định chứa ba trong bốn service đó đã đạt Top-3 = 75% mà không cần nhìn dữ liệu. Phải dùng Top-1 và MRR, và luôn đặt cạnh mốc ngẫu nhiên và mốc xếp hạng cố định.
</details>

2. Fang 2025 cho thấy điều gì về workload của các benchmark RCA cũ? Khi trích cần tránh nói quá ở điểm nào?

<details><summary>Đáp án</summary>
Workload "mức đồ chơi" (ví dụ trên Train-Ticket: 0,14–4,35 QPS) và phủ ít service (RE2-TT 27/69). Không được nói Nezha tụt từ 0,87 xuống 0,04 "chỉ vì workload", vì bộ mới của Fang thay đổi nhiều yếu tố cùng lúc (workload, độ sâu gọi, loại lỗi, cách lọc case).
</details>

3. Giải thích bằng ví dụ chuông báo cháy vì sao dữ liệu thật là điều kiện để đánh giá AI.

<details><summary>Đáp án</summary>
Ngưỡng cố định chỉ lộ điểm yếu khi có "khói bếp" hợp lệ (cao điểm tải thật). Thử trong căn bếp lúc nửa đêm (tải phẳng) thì chuông thường và máy thông minh trông như nhau, nên không đo được giá trị của máy thông minh.
</details>

4. "Mức 2+" khác mức 2 ở đâu, và vì sao mức 2 vẫn được giữ?

<details><summary>Đáp án</summary>
Mức 2+ phát lại phiên thật của học viên lấy từ log Moodle; mức 2 sinh hành vi từ máy trạng thái có xác suất do nhóm đặt. Mức 2 vẫn giữ cho giảng viên, admin và job lịch vì không có log công khai cho các vai này.
</details>

5. Câu "làm hướng khác thì phải chứng minh được" ràng buộc đồ án những gì?

<details><summary>Đáp án</summary>
Với mức 2+: phải có phép kiểm chứng định lượng (so với log hold-out, so với hai cách giả lập đơn giản, ngưỡng chốt trước). Với mức 3 không làm đầy đủ: phải có lập luận kèm số liệu từ nghiên cứu (tốc độ, độ lệch hành vi, tính không tất định), không chỉ một câu khẳng định.
</details>
