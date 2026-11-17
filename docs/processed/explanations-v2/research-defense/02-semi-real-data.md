# Dữ liệu bán thực: làm traffic "trông như người thật" và chứng minh điều đó

> **File này giải thích gì:** vì sao traffic hoàn toàn do máy sinh dễ bị hội đồng bác, nhóm thay bằng traffic "bán thực" thế nào (phát lại phiên của người học thật), và làm sao **chứng minh** traffic đó giống thật.
>
> **Nguồn gốc (canonical):** [ADR-007](../../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 1–2; [workload-design-v1](../../architecture/workload-design-v1.md) mục 2.3, 7.7, 10.4, 13, 14 (PR #78); [plan-v0.4](../../plan/plan-v0.4-24-weeks.md) tuần 14. Tài liệu tham khảo: [references.md](references.md), bản chuẩn [literature-matrix-v1](../../plan/literature-matrix-v1.md).
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch). Mức 1 đã cài (PR #76); mức 2+ làm ở tuần 14 của plan.

---

## 1. Vấn đề: "dữ liệu do chính nhóm bịa ra"

Hình dung một bài thi lái xe mà đường thi do chính thí sinh vẽ: thẳng tắp, không có ngã tư. Lái tốt trên đường đó chẳng chứng minh được gì. Traffic giả lập cũng vậy:

- **Tải đều như máy đếm nhịp** (cũ: k6 bắn N request/giây) làm "trạng thái bình thường" quá phẳng. Detector nào cũng phát hiện được sự cố trên nền phẳng.
- Nghiên cứu đã đo điều này: các benchmark RCA cũ có tải rất nhỏ (ví dụ trên Train-Ticket chỉ 0,14–4,35 request/giây) và chỉ gọi tới một phần service. Khi đánh giá trên một bộ khó và thực tế hơn, nhiều phương pháp tụt mạnh (Fang và cs. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711, file [`papers/2025-fang-rca-benchmark.pdf`](papers/2025-fang-rca-benchmark.pdf)). Lưu ý khi trích: bộ mới đổi **nhiều yếu tố cùng lúc**, không chỉ workload.
- Mức 2 mà nhóm thiết kế trước đó (người dùng ảo có profile, mục tiêu, máy trạng thái) tốt hơn tải đều, nhưng **xác suất chuyển thao tác vẫn là số tự đặt**. Hội đồng hỏi "số 0,45 này ở đâu ra?" thì chỉ trả lời được "giả định".

## 2. Giải pháp: dải bốn mức, học viên dùng phiên thật

| Mức | Là gì | Ví dụ đời thường | Dùng cho |
| --- | --- | --- | --- |
| 1 | Mỗi luồng W1–W7 một kịch bản cố định, lặp lại | Diễn viên đọc đúng một kịch bản | Smoke test; **mốc "giả lập đơn giản"** để so sánh |
| 2 | Người dùng ảo có tính cách, mục tiêu, chọn bước tiếp theo theo xác suất, phản ứng khi gặp lỗi | Diễn viên ứng biến theo tính cách nhân vật | Giảng viên, admin, job lịch (không có dữ liệu công khai) |
| **2+** | **Phát lại phiên thật** của người học từ log của một LMS thật | Chiếu lại băng ghi hình người thật dùng hệ thống | **Học viên** — nguồn traffic chính |
| 3 (offline) | LLM viết persona và nội dung **một lần**, lưu thành file, k6 chỉ đọc | Nhờ biên kịch viết sẵn nhân vật | Stretch: chỉ làm nếu còn thời gian |

### 2.1. Log Moodle thật lấy ở đâu

**Unistudium 2022** — log của nền tảng học trực tuyến Moodle của Đại học Perugia (Ý), công khai trên Zenodo, giấy phép CC BY 4.0 (`[L-Unistudium]`, https://zenodo.org/records/13763175; README chép ở [`papers/2022-milani-unistudium-readme.txt`](papers/2022-milani-unistudium-readme.txt)). Nhóm đã tự kiểm trên file:

- 1.234 người học, 4 khóa, 1 học kỳ (91 ngày), 208.109 sự kiện, 45 loại sự kiện chuẩn của Moodle;
- mỗi sự kiện có **thời điểm tới từng giây** → tái dựng được từng phiên: người đó vào lúc nào, xem gì, nghỉ bao lâu, làm quiz ra sao.

Vì sao không dùng bộ khác: OULAD (`[L-OULAD]`) chỉ có **tổng click theo ngày**, không biết trong ngày người học làm gì; EdNet là app luyện đề và chỉ cho dùng phi thương mại; KDD Cup 2015 không rõ giấy phép; MOOCCubeX quá lớn (một tệp 21 GB).

### 2.2. Ánh xạ "việc trên Moodle" sang "API của LMS đề tài"

Ví dụ: `course_viewed` (mở trang khóa học) → `GET /courses/:id`; `attempt_started` (bắt đầu làm quiz) → `POST /student/quizzes/:id/attempts`; `user_enrolment_created` (ghi danh) → `POST /student/courses/:id/enrollments`. Bảng đầy đủ: `workload-design-v1.md` mục 13.2.

Kết quả: **95,2%** số dòng log ánh xạ được (198.095/208.109). Phần bị bỏ chủ yếu là `access_prevented` (8.961 dòng — Moodle chặn truy cập), diễn đàn và nộp bài tập dạng tệp, những thứ LMS đề tài không có.

### 2.3. Phát lại thế nào cho giống thật

- **Cắt phiên:** một phiên là chuỗi thao tác của một người, kết thúc khi người đó nghỉ quá 30 phút. Có 34.248 phiên; một phiên điển hình chỉ 3 thao tác, kéo dài 46 giây (nhiều người vào xem nhanh rồi đi) — điều mà mô hình tự đặt khó nghĩ ra.
- **Nén lịch, không nén nhịp nghỉ:** cả ngày (24 giờ) được nén vào 48 phút chạy, nhưng **khoảng nghỉ giữa hai thao tác giữ nguyên** (trung vị 15 giây). Giống như tua nhanh "giờ đến lớp" của cả trường, nhưng mỗi học viên vẫn đọc bài với tốc độ thật.
- **Đông vắng theo giờ và ngày cao điểm thật:** log cho thấy đỉnh lúc 10 giờ sáng, gần như không ai lúc 23h–6h; ngày trước hạn quiz đông gấp 3,7 lần (số phiên) và gấp 7 lần (số sự kiện) ngày trung bình. Profile `healthy high-load spike` dùng đúng ngày đó.
- **Đủ tải:** một ngày thật chỉ ~0,9 request/giây sau khi nén — quá ít. Nhóm **chồng nhiều ngày** cùng dáng vào một run (đổi tài khoản để không trùng) và **ghi rõ đã khuếch đại bao nhiêu lần**. Mục tiêu khoảng 5–20 request/giây.
- **Vẫn phản ứng như người:** nếu hệ thống lỗi, người dùng ảo vẫn thử lại, đăng nhập lại hoặc bỏ ngang như mức 2 — đúng chuỗi "System Response → Update User State" giảng viên gợi ý.
- **Khi cần thêm phiên:** học ma trận chuyển từ chính log (cách làm của WESSBAS, Vögele và cs. 2018, `[L-WESSBAS]`, https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/). Ví dụ học được: sau khi đọc một bài, người thật quay về trang khóa học với xác suất 0,40, còn bảng tự đặt trước đó chỉ cho 0,05.
- **Lúc bắt đầu phiên** theo phân phối Poisson với tốc độ đổi theo giờ — mô hình kinh điển cho "lúc người dùng bắt đầu phiên" (Paxson & Floyd 1995, `[L-PaxsonFloyd]`, https://www.icir.org/vern/papers/poisson.TON.pdf).

## 3. Chứng minh traffic giống thật

Nói "giống thật" thì phải đo. Cách làm (ADR-007 mục 2):

1. **Giữ lại một phần log làm đề kiểm tra (hold-out):** 60 ngày đầu để xây, 31 ngày cuối không được nhìn tới khi chỉnh tham số.
2. **Chạy ba loại traffic** cùng thời lượng: (a) mức 1 tốc độ hằng, (b) mức 2 thuần (số tự đặt), (c) bán thực.
3. **Đo trên log gateway** của từng run và so với hold-out:

| Đo cái gì | Phép đo | Hiểu nôm na |
| --- | --- | --- |
| Số thao tác mỗi phiên, độ dài phiên, thời gian nghỉ | KS (Kolmogorov–Smirnov), báo **D** | D là khoảng cách lớn nhất giữa hai đường "phần trăm tích lũy"; D = 0 là trùng khít |
| Tỉ lệ các loại thao tác | Jensen–Shannon (JSD) | Hai "giỏ hàng" thao tác giống nhau đến đâu; 0 là giống hệt |
| Đông vắng theo giờ | Tương quan Pearson | Hai đường cong có cùng dáng không |
| Mức độ "dồn cục" | Tỉ số đỉnh/trung bình, index of dispersion, Hurst | Traffic thật hay dồn từng cụm chứ không rải đều (sách Feitelson, `[L-Feitelson]`, https://www.cs.huji.ac.il/~feit/wlmod/) |

4. **Ngưỡng chốt trước khi đo:** JSD < 0,05; KS D < 0,1; trung vị lệch < ±10%. Kết luận "giống thật" chỉ khi (c) đạt ngưỡng **và** gần hold-out hơn (a), (b). Không đạt thì báo đúng số, không đổi ngưỡng.

Đây chính là phần "làm hướng khác thì phải chứng minh được" mà giảng viên dặn.

## 4. Vì sao mức 3 chỉ làm offline

Giảng viên gợi ý mức 3 là "AI agent đóng vai người dùng". Nghiên cứu 2025–2026 cho thấy chạy agent trực tiếp làm nguồn tải không hợp:

- **Chậm:** UXAgent mất khoảng 8 giây cho mỗi bước (bản v2 của bài, `[L-UXAgent]`, https://arxiv.org/abs/2504.09407).
- **Lệch người thật:** agent "đi thẳng tới mục tiêu" — trung bình 6,05 thao tác/phiên so với 15,96 của người thật (AgentA/B, `[L-AgentAB]`, https://arxiv.org/abs/2504.09723).
- **Không tái lập:** đặt temperature 0 vẫn cho kết quả khác nhau giữa các lần chạy (`[L-LLMNondet]`, https://arxiv.org/abs/2408.04667, file [`papers/2024-atil-llm-nondeterminism.pdf`](papers/2024-atil-llm-nondeterminism.pdf)).

Hướng gần nhất có căn cứ dữ liệu thật là SimGym (Shopify) — dựng persona từ clickstream thật (`[L-SimGym]`, https://arxiv.org/abs/2602.01443, file [`papers/2026-castelo-simgym.pdf`](papers/2026-castelo-simgym.pdf)). Vì vậy nhóm chỉ dùng LLM **một lần** để viết persona và nội dung (đề cương, câu hỏi quiz), đóng băng thành file có mã băm — tái lập được, không tốn LLM trong lúc đo.

## 5. Giới hạn cần nói trước với hội đồng

- Log là của một trường Ý, 4 khóa, năm 2022 — không đại diện cho mọi LMS. Nhóm dùng nó vì là log LMS công khai duy nhất vừa tải tự do vừa ghi tới giây.
- Mốc thời gian trong log đã bị dịch và README không ghi múi giờ: chỉ dùng **hình dạng** theo giờ, không dùng giờ tuyệt đối.
- Tải đã được khuếch đại bằng chồng phiên; báo cáo luôn ghi hệ số.
- 4,8% dòng log không có tương ứng trong LMS và bị bỏ.

## Tóm tắt

- Traffic hoàn toàn tự sinh dễ bị bác; workload đơn giản làm RCA trông giỏi hơn thật (`[L-Fang2025]`).
- Học viên dùng **phiên thật** phát lại từ log Moodle Unistudium 2022 (95,2% sự kiện ánh xạ được); giảng viên/admin dùng mô hình hành vi; mức 3 chỉ offline.
- Chứng minh giống thật bằng **hold-out** và so với hai cách giả lập đơn giản, ngưỡng chốt trước.

## Câu hỏi tự kiểm tra

1. Vì sao không phát lại OULAD dù nó lớn hơn nhiều?
   <details><summary>Đáp án</summary>OULAD chỉ có tổng số click mỗi ngày của mỗi người, không có thời điểm trong ngày, nên không tái dựng được phiên (vào lúc nào, làm gì, nghỉ bao lâu). Nó chỉ dùng để kiểm tra vĩ mô như mức tăng hoạt động trước hạn.</details>
2. Khi nén một ngày còn 48 phút, cái gì được giữ nguyên và vì sao?
   <details><summary>Đáp án</summary>Khoảng nghỉ giữa hai thao tác trong một phiên giữ nguyên như log; chỉ lịch bắt đầu phiên bị nén. Nếu nén cả khoảng nghỉ, mỗi người sẽ thao tác nhanh bất thường, hành vi cá nhân bị méo.</details>
3. "Hold-out" để làm gì?
   <details><summary>Đáp án</summary>Là phần log không được dùng để chỉnh tham số, giống đề thi giữ kín. So traffic sinh ra với phần này mới biết traffic giống thật hay chỉ khớp với chính dữ liệu đã dùng để xây.</details>
4. Vì sao không dùng LLM agent chạy trực tiếp làm người dùng ảo?
   <details><summary>Đáp án</summary>Chậm (khoảng 8 giây mỗi bước), hành vi lệch người thật (6 so với 16 thao tác mỗi phiên) và không tái lập được kể cả ở temperature 0. Nhóm chỉ dùng LLM một lần để sinh persona/nội dung rồi đóng băng.</details>
