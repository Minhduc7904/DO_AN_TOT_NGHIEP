# Chiến lược bằng chứng cho phản biện: dữ liệu bán thực và đóng góp của AI/RCA (v1)

> **Trạng thái:** Đã chốt — v1, 17/11/2026. Bách chốt bốn quyết định ở mục 6: (1) dùng log Moodle Unistudium cho học viên; (2) mức 3 offline để Stretch; (3) E6 (RCAEval) và E7 (thử nghiệm người) để Target; (4) người tham gia E7 chưa chắc, chốt trước tuần 15 của plan. Quyết định chính thức: [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md); kế hoạch: [plan-v0.4](../plan/plan-v0.4-24-weeks.md); danh mục tài liệu tham khảo: [literature-matrix-v1](../plan/literature-matrix-v1.md); giải thích dễ hiểu: [explanations-v2/research-defense](../explanations-v2/research-defense/README.md). Tài liệu này giữ làm bản phân tích gốc; khi khác ADR-007 thì ADR-007 đúng.
>
> **Vì sao có tài liệu này:** góp ý giữa kỳ của giảng viên có hai điểm quyết định kết quả phản biện ([plan v0.3 mục 0](../plan/plan-v0.3-24-weeks.md)):
>
> 1. "Truy vết thủ công vẫn tìm ra nguyên nhân, vậy AI/ML giúp gì?" — phải chứng minh AI/RCA **đóng góp thực sự**.
> 2. "Traffic giả lập phải giống người dùng thật" (mức 1 chuỗi request, mức 2 mô phỏng hành vi, mức 3 AI agent đóng vai người dùng; "làm hướng khác thì phải chứng minh được"). Bách nhấn mạnh thêm: dữ liệu phải **trông thực tế**, không giả lập hoàn toàn.
>
> **Cách làm:** rà soát repo hiện tại, tra cứu nghiên cứu 2019–2026 (mọi nguồn dưới đây đã được mở và đọc; số liệu chép từ nguồn, số do nhóm tự tính ghi rõ), rồi đề xuất phương án vừa sức một người trong thời gian còn lại.

---

## 0. Đọc nhanh

- **Hai điểm là một.** Nghiên cứu gần đây cho thấy workload "đồ chơi" (tốc độ cố định, ít service được gọi) làm RCA trông giỏi hơn thực tế: khi đổi sang workload theo máy trạng thái phủ 84% service, độ chính xác Top-1 trung bình của 11 phương pháp SOTA chỉ còn 0,21; Nezha rơi từ 0,87 xuống 0,04 khi đánh giá trên bộ khó và thực tế hơn (bộ mới đổi nhiều yếu tố cùng lúc, không chỉ workload) ([arXiv 2510.04711](https://arxiv.org/html/2510.04711v2)). Vậy dữ liệu càng thật thì phép đánh giá càng trung thực, và giá trị của AI (lọc nhiễu, phân biệt tải cao hợp lệ với sự cố) mới đo được.
- **Dữ liệu:** thay "giả lập hoàn toàn" bằng **bán thực**: phát lại phiên của người học thật từ một log Moodle công khai (log của chính một LMS, tới từng giây), đường cong tải lấy từ cùng log, mô hình hành vi mức 2 được **học từ log thật** thay vì tự đặt xác suất, và mức 3 làm dạng **LLM offline** (sinh một lần, đóng băng, phát lại). Kiểm chứng bằng cách so với phần log giữ lại (hold-out) và so với hai cách giả lập đơn giản.
- **AI:** không hứa "AI thắng mọi case" (nghiên cứu cho thấy baseline đơn giản thường ngang hoặc thắng SOTA). Chứng minh ở bốn chỗ thủ công yếu: (1) phát hiện dưới tải dao động thật, (2) quan sát bị thiếu (trace bị lấy mẫu, log mất `trace_id`), (3) chi phí và thời gian chẩn đoán, (4) chạy tự động, ổn định. Kèm baseline mạnh đã công bố (SimpleRCA, BARO), đối chứng ngoài trên benchmark công khai RCAEval và một thử nghiệm người nhỏ.

---

## 1. Hiện trạng repo so với góp ý

| Góp ý | Đã có | Lỗ hổng khi phản biện |
| --- | --- | --- |
| AI đóng góp thực sự | [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) mục 15: `base-manual-auto` (luật chưa viết), thử nghiệm người (Target, chưa chốt), RQ1–RQ6, Top-K/MRR/thời gian | (a) C2, C3, C4 có span CLIENT chậm/lỗi ngay trong trace: baseline kiểu "tìm trace lỗi" rất có thể cũng đúng. (b) Xếp hạng hằng đã đạt Top-3 = 75% trên 4 case. (c) Chỉ so trên testbed và baseline do nhóm tự đặt. (d) Thử nghiệm người có thể không làm. |
| Traffic giống thật | Mức 1 đã code ([PR #76](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/76)); mức 2 đã thiết kế ([workload-design-v1](../architecture/workload-design-v1.md), PR #78) với tỉ lệ profile rút từ OULAD | Traffic vẫn do máy sinh 100%. Bảng xác suất chuyển, kiên nhẫn, đường cong theo giờ là "giả định của đề tài". OULAD chỉ có số click **theo ngày** (đã kiểm `studentVle.csv`: không có giờ trong ngày), nên không tái dựng được phiên. Mức 3 bị loại chỉ bằng một câu. |

---

## 2. Điều nghiên cứu nói (đã xác minh)

### 2.1. Về đánh giá RCA

| Phát hiện | Nguồn |
| --- | --- |
| Đánh giá 21 phương pháp RCA và 9 phương pháp causal discovery: "no method stands out in all situations"; nhiều phương pháp causal cho kết quả gần như Dummy (chọn ngẫu nhiên); NSigma, BARO chạy ~0,01 s/case mà vẫn cạnh tranh | Pham et al., ASE 2024 — [arXiv 2408.13729](https://arxiv.org/html/2408.13729v2) |
| SimpleRCA (3-sigma/P95 trên metric, P95 ≥ 3× trên trace, đếm từ khóa lỗi trong log, service nhiều cảnh báo nhất xếp đầu) thắng SOTA trên 7/11 bộ dữ liệu (Top@1); benchmark hiện tại "may overstate progress" | Fang et al., 2025 — [arXiv 2510.04711](https://arxiv.org/html/2510.04711v2) |
| Workload benchmark cũ là "toy level": QPS 0,14–4,35 (ví dụ trên Train-Ticket), RE2-TT chỉ phủ 27/69 service; workload theo máy trạng thái (16,47 QPS, phủ 84%) làm Top-1 trung bình còn 0,21 | như trên |
| Benchmark công khai **RCAEval**: 735 case trên Online Boutique, Sock Shop, Train Ticket; RE2 có đủ metric + log + trace (Prometheus, Loki, Jaeger — gần stack của đề tài); license MIT; cấu hình khuyến nghị 8 core, 16 GB RAM | Pham et al., WWW 2025 Companion — [arXiv 2412.17015](https://arxiv.org/html/2412.17015v5), [GitHub](https://github.com/phamquiluan/RCAEval) |
| Số đã công bố trên RE2-TT (AC@1 / AC@3 / Avg@5): BARO đa nguồn 0,69 / 0,82 / 0,81; TraceRCA 0,66 / 0,79 / 0,77; PDiagnose 0,48 / 0,70 / 0,67; CIRCA 0,32 / 0,47 / 0,46; MicroRank 0,16 / 0,37 / 0,31 | bảng kết quả trong RCAEval (đã đối chiếu bản text) |
| Thử nghiệm người kiểu within-subject: 19 người, mỗi người 6 task (3 có công cụ, 3 không, cân bằng); tổng thời gian giảm 42,49%; hai task dễ nhất lại **chậm hơn** khi có công cụ; mẫu nhỏ nên chỉ 2/6 task có ý nghĩa thống kê | LogAssist, TSE 2022 (online 2021) — [PDF](https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf) |
| Chưa tìm thấy nghiên cứu có kiểm soát nào đo kỹ sư làm RCA microservice có/không có công cụ; số "giảm x% MTTR" phần lớn là vendor tự công bố | kết quả tra cứu |

**Bài học:** `base-manual-auto` theo thiết kế hiện tại gần như chính là TraceRCA/SimpleRCA — những baseline mạnh. Nếu bảng chính chỉ có Top-K trên 4 case với quan sát đầy đủ, engine nhiều khả năng **hòa**. Phải chọn đúng chỗ để đo và nói thẳng điều này trong báo cáo.

### 2.2. Về dữ liệu và workload

| Phát hiện | Nguồn |
| --- | --- |
| **Log Moodle Unistudium 2022** (Đại học Perugia): 4 khóa, 1 học kỳ, timestamp tới giây, tên sự kiện chuẩn của Moodle; CC BY 4.0, 991 KB. Nhóm đã kiểm: 1 234 user, 208 109 sự kiện, 45 loại sự kiện, 91 ngày; nhiều nhất `course_module_viewed` 85 692, `course_viewed` 73 727, `attempt_started/submitted` ~4 100, `user_enrolment_created` 642, `assessable_uploaded` 128 | [Zenodo 13763175](https://zenodo.org/records/13763175) |
| Trên log đó (tách phiên khi nghỉ > 30 phút): ~34 247 phiên, số sự kiện/phiên p50 = 3, p90 = 14; nhịp ngày rõ (đáy 3h, đỉnh 10h và 14–16h); ngày cao điểm quiz gấp ~7 lần trung bình | tính bởi nhóm (agent nghiên cứu), cần tính lại bằng script trong repo |
| OULAD: 10,6 triệu dòng nhưng chỉ là tổng click theo ngày | đã kiểm file |
| EdNet (ms, 131 triệu tương tác) là app luyện đề, license phi thương mại; KDD Cup 2015/XuetangX có giờ trong ngày nhưng license/link không chắc; MOOCCubeX quá lớn | trang dữ liệu tương ứng |
| **WESSBAS**: học Behavior Model (Markov) và Behavior Mix từ session log rồi sinh tải; tự thừa nhận Markov bậc 1 sinh phiên dài hơn thật | Vögele et al., SoSyM 2018 — [PMC5910480](https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/) |
| Thời điểm bắt đầu phiên của người dùng mô hình tốt bằng Poisson có tốc độ đổi theo giờ; bên trong phiên burst hơn nhiều; lưu lượng do timer thì không phải Poisson | Paxson & Floyd, ToN 1995 — [PDF](https://www.icir.org/vern/papers/poisson.TON.pdf) |
| LLM agent đóng vai người dùng: UXAgent ~8 s mỗi bước (bản v2 của bài), không so định lượng với người; AgentA/B agent chỉ 6,05 hành động/phiên so với 15,96 của người (quá "đi thẳng tới mục tiêu"); cấu hình temperature 0 vẫn không tất định | [UXAgent](https://arxiv.org/html/2504.09407v2), [AgentA/B](https://arxiv.org/html/2504.09723v1), [arXiv 2408.04667](https://arxiv.org/pdf/2408.04667) |
| Hướng gần nhất với "LLM có căn cứ dữ liệu thật": SimGym dựng persona từ clickstream production | [arXiv 2602.01443](https://arxiv.org/pdf/2602.01443) |

---

## 3. Đề xuất A — dữ liệu bán thực

### 3.1. Dải bốn mức (trả lời đủ ba mức của giảng viên)

| Mức | Nội dung | Phần "thật" | Vai trò |
| --- | --- | --- | --- |
| 1 | Chuỗi request cố định W1–W7 | — | Đã có; dùng làm **baseline giả lập đơn giản** khi kiểm chứng độ thực |
| 2 | Máy trạng thái theo profile/goal, think time, phản ứng lỗi, nhịp theo giờ | Tỉ lệ profile và nhịp trước hạn từ OULAD | Dùng cho vai trò **không có dữ liệu thật**: giảng viên (W2), admin (W5), job lịch (W7) |
| **2+** (mới) | **Phát lại phiên thật** của học viên từ log Moodle, ánh xạ sự kiện → endpoint; tốc độ bắt đầu phiên theo giờ và đỉnh trước hạn quiz lấy từ cùng log; ma trận chuyển mức 2 của học viên **học từ log** (kiểu WESSBAS) cho phần cần sinh thêm | Thứ tự thao tác, think time trong phiên, đường cong tải, đỉnh trước hạn | **Nguồn chính** của traffic học viên (W1, W3, W4) |
| 3 (offline) | LLM sinh một lần persona giảng viên và **nội dung** (đề cương, câu hỏi quiz, tài liệu cho W6), lưu JSON có hash, k6 chỉ đọc | Nội dung giống người viết | Trả lời gợi ý mức 3 mà vẫn tái lập; nói rõ đây là độ thực của **nội dung**, không phải nhịp tải |

Lý do không chạy LLM agent online làm nguồn tải: mỗi bước ~8 giây, không tất định, và nghiên cứu cho thấy hành vi lệch người thật (6,05 so với 15,96 hành động/phiên). Đây là lập luận có trích dẫn thay cho câu "khó tái lập" hiện tại.

### 3.2. Ánh xạ sự kiện Moodle → LMS testbed (nháp, sẽ kiểm trên log)

| Sự kiện Moodle | Thao tác LMS | Workflow |
| --- | --- | --- |
| bắt đầu phiên | đăng nhập (`POST /auth/student/login`) | W1 |
| `user_enrolment_created` | ghi danh | W3 |
| `course_viewed` | xem chi tiết khóa học | W3 |
| `course_module_viewed` | xem danh sách/nội dung bài học | W3 |
| `course_module_completion_updated` | cập nhật tiến độ | W3 |
| `attempt_started` / `attempt_updated` / `attempt_submitted` / `attempt_viewed` | bắt đầu / lưu đáp án / nộp / xem lại quiz | W3 |
| `assessable_uploaded`, `submission_created` | upload tệp | W4 |
| `discussion_viewed`, `access_prevented`, `user_graded`, `role_assigned`… | không có tương ứng hoặc là sự kiện phía server → bỏ | — |

Báo cáo tỉ lệ sự kiện được phủ: theo số đếm ở mục 2.2, các sự kiện ánh xạ được chiếm khoảng 90,6% số dòng (188 516/208 109; tính sơ bộ, sẽ tính lại bằng script). Người dùng và khóa học trong log được gán sang tài khoản/khóa học seed; quy mô nhỏ thì **chồng nhiều ngày/nhiều khóa** (đổi id) để đủ tải, ghi rõ là đã khuếch đại.

Thời gian: **chỉ nén lịch bắt đầu phiên** (một ngày còn 48 phút); think time bên trong phiên giữ nguyên như thật, để hành vi từng người không bị méo.

### 3.3. Chứng minh "giống thật"

- Chia log: một phần dùng để xây (ví dụ 60 ngày đầu hoặc khóa A–C), phần còn lại giữ làm **hold-out**.
- Ghi log gateway khi k6 chạy, so với hold-out theo: phân phối số thao tác/phiên và độ dài phiên (KS, báo thống kê D), think time, tỉ lệ loại thao tác (Jensen–Shannon), hình dạng theo giờ (tương quan), tỉ số đỉnh/trung bình theo ngày, độ burst (index of dispersion, Hurst).
- Chạy **cùng bộ đo cho ba nguồn tải**: tốc độ hằng (kiểu benchmark cũ), mức 2 thuần giả định, bán thực. Kết quả mong muốn: bán thực gần hold-out nhất — đây là phần "chứng minh" giảng viên yêu cầu.
- Ngưỡng đề xuất (chốt trước khi đo): JSD < 0,05, KS D < 0,1, trung vị lệch < ±10%.

---

## 4. Đề xuất B — chứng minh AI/RCA đóng góp thực sự

### 4.1. Lập luận trung tâm

> Khi quan sát đầy đủ và tải đơn giản, người (hoặc luật đơn giản) đã đủ tìm ra nguyên nhân — điều này đúng và nhóm báo cáo trung thực. RCA engine tạo giá trị ở chỗ: **phát hiện** sự cố trong nhiễu của tải thật mà ngưỡng cố định không làm được, **giữ được độ chính xác khi quan sát bị thiếu**, **giảm công sức và thời gian** của người vận hành, và chạy **tự động, ổn định** trên mọi incident.

### 4.2. Bộ bằng chứng, xếp ưu tiên

| # | Bằng chứng | Trả lời câu hỏi | Mức | Công sức |
| --- | --- | --- | --- | --- |
| E1 | **Phát hiện dưới tải bán thực:** detector học máy (fit trên run khỏe) so với cảnh báo ngưỡng cố định; đo báo động giả/giờ trên run khỏe có đỉnh trước hạn quiz, độ trễ phát hiện, recall trên run có lỗi | Dữ liệu thật làm ngưỡng tĩnh hỏng, ML thì không — nối trực tiếp hai góp ý | MVP | 0,5 tuần (dùng pipeline sẵn có) |
| E2 | **Bảng chính công bằng:** engine so với random, xếp hạng hằng, ngưỡng tĩnh, `base-manual-auto`, **SimpleRCA**, **BARO**; Top-1, MRR (chỉ số chính), Top-3; theo từng case; bootstrap CI 95%; kiểm định ghép cặp (McNemar exact) | So với baseline mạnh đã công bố, không chỉ baseline tự đặt | MVP | 1 tuần |
| E3 | **Quan sát suy giảm** (offline, cùng run): trace lấy mẫu 10%, log mất `trace_id`, mất một nguồn metric | Baseline dựa trace sụp còn engine đa nguồn giữ được — đúng thực tế production (trace thường bị lấy mẫu) | MVP (thay RQ4 hiện tại) | 0,5 tuần |
| E4 | **Chi phí chẩn đoán:** số artifact phải mở (trace, panel, truy vấn log) và thời gian của `base-manual-auto` so với engine; engine trả bằng chứng đã chọn sẵn | "Hỗ trợ" = giảm công sức | MVP | 0,5 tuần |
| E5 | **Ablation:** bỏ từng modality; bỏ cạnh async/auth; thay detector ML bằng z-score | Thành phần nào thật sự đóng góp | MVP | 0,5 tuần |
| E6 | **Đối chứng ngoài trên RCAEval RE2** (OB, TT): tái lập BARO trước để kiểm pipeline, rồi chạy engine qua adapter, đặt cạnh số đã công bố | Engine không chỉ khớp với lỗi do chính nhóm thiết kế | Target | 1–1,5 tuần |
| E7 | **Thử nghiệm người nhỏ:** 6–10 người (bạn cùng khóa/kỹ sư), within-subject, mỗi người 4 incident, nửa dùng Grafana thủ công, nửa có báo cáo engine, cân bằng thứ tự; đo thời gian, đúng/sai, số thứ đã mở, NASA-TLX rút gọn, SUS; Wilcoxon ghép cặp + CI; ghi rõ là nghiên cứu sơ bộ | Hiệu quả với người thật — đúng chữ "hỗ trợ" | Target | 1 tuần |
| E8 | **Case study C6:** chuỗi bằng chứng của engine đặt cạnh đường truy vết thủ công (lỗi hiện ở gateway, nguyên nhân ở `identity` im lặng, cờ `telemetry_silent`) | Tính diễn giải | MVP | 0,25 tuần |

### 4.3. Củng cố bộ case

- Thêm **biến thể** cho mỗi case MVP (mức trễ khác nhau, thời điểm khác nhau) để tăng số incident test từ 16 lên khoảng 32–40, cho CI hẹp hơn.
- Chạy fault **chồng lên đỉnh tải bán thực** (ví dụ trễ DB đúng lúc cao điểm trước hạn quiz): nhiều triệu chứng cùng lúc, tải cao hợp lệ lẫn với sự cố — nơi ngưỡng tĩnh và truy vết theo trace đầu tiên dễ sai.
- Ghi trước giả thuyết, cấu hình và tiêu chí đánh giá vào repo **trước** khi chạy run test (pre-registration) để chống nghi ngờ "tự ra đề tự chấm".

### 4.4. Rủi ro và cách trình bày trung thực

| Rủi ro | Cách xử lý |
| --- | --- |
| Engine hòa `base-manual-auto` về Top-1 trên quan sát đầy đủ | Báo cáo đúng; trọng tâm chuyển sang E1, E3, E4 (đã thiết kế để đo đúng chỗ khác biệt) |
| Engine thua BARO/SimpleRCA trên RCAEval | Ghi rõ; trích Fang et al. cho thấy SOTA cũng thua kiểu đó; RCAEval là kiểm tra khả năng tổng quát, không phải bảng xếp hạng |
| Mẫu nhỏ | Luôn kèm CI, không tuyên bố có ý nghĩa thống kê khi không đạt |
| Ánh xạ Moodle → LMS không khớp hết | Bảng ánh xạ + tỉ lệ phủ; phần không phủ do mức 2 đảm nhiệm |

---

## 5. Ảnh hưởng tới kế hoạch

Theo lịch còn 8 tuần (tuần lịch 17–24) cho khối lượng tuần 13–23 của plan, nên mọi bổ sung phải thay thế chứ không chỉ cộng thêm.

| Việc | Thay đổi | Tuần plan |
| --- | --- | --- |
| Mức 2+ (replay Moodle) + kiểm chứng hold-out | **Thay** phần lớn công việc mức 2 thuần của tuần 14 (mức 2 chỉ còn cho giảng viên/admin) | 14 |
| Thêm biến thể case, fault chồng đỉnh tải | Trong fault manifest tuần 14–15 | 14–15 |
| SimpleRCA, BARO | Baseline rẻ, thêm vào tuần 17 (RCA baselines) | 17 |
| E1, E3, E4, E5, E8 | Đã có khung RQ1–RQ5; đổi trọng tâm báo cáo | 19–21 |
| E6 RCAEval | Target, làm nếu tuần 18 đúng hạn | 18–20 |
| E7 thử nghiệm người | Target, cần chốt người tham gia sớm (tuần 15) | 20 |
| Mức 3 offline (LLM nội dung) | Stretch | — |

Tài liệu đã sửa khi chốt (task-06 tuần 13): ADR-007 (quyết định), plan v0.3 → v0.4 (tuần 14–21), [workload-design-v1](../architecture/workload-design-v1.md) (thêm mức 2+, mức 3 offline), [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) (baseline mới, E1/E3/E4, RCAEval, thử nghiệm người).

## 6. Quyết định của Bách (17/11/2026)

| Câu hỏi | Quyết định |
| --- | --- |
| 1. Dùng log Moodle Unistudium làm nguồn phiên thật cho học viên (mức 2+)? | **Có** (Bách giao agent quyết theo hướng hợp lý) |
| 2. Mức 3: làm dạng LLM offline hay chỉ trình bày lập luận? | **Stretch** — làm sau nếu còn thời gian |
| 3. E6 (RCAEval) và E7 (thử nghiệm người) ở mức nào? | **Target** cả hai |
| 4. Có tìm được 6–10 người tham gia E7? | **Chưa chắc** — chốt trước tuần 15 của plan; không có thì E7 tối thiểu 2–3 người định tính hoặc bỏ |

## 7. Nguồn

- Fang et al., 2025, arXiv 2510.04711 — https://arxiv.org/html/2510.04711v2
- Pham et al., ASE 2024 — https://arxiv.org/html/2408.13729v2
- RCAEval, WWW 2025 Companion — https://arxiv.org/html/2412.17015v5 , https://github.com/phamquiluan/RCAEval
- LogAssist, TSE 2022 (online 2021) — https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf
- Ahmed et al., ICSE 2023 (đánh giá gợi ý root cause với 25 incident owner) — https://ar5iv.labs.arxiv.org/html/2301.03797
- Unistudium 2022 Moodle logs — https://zenodo.org/records/13763175
- OULAD — https://pmc.ncbi.nlm.nih.gov/articles/PMC5704676/
- WESSBAS — https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/
- Paxson & Floyd 1995 — https://www.icir.org/vern/papers/poisson.TON.pdf
- UXAgent — https://arxiv.org/html/2504.09407v2 ; AgentA/B — https://arxiv.org/html/2504.09723v1 ; tính không tất định của LLM — https://arxiv.org/pdf/2408.04667 ; SimGym — https://arxiv.org/pdf/2602.01443
- Nezha — https://github.com/IntelligentDDS/Nezha ; TraceRCA, MicroRank, BARO, CIRCA, RCD: qua RCAEval và survey https://arxiv.org/pdf/2407.01710
- NASA-TLX — https://en.wikipedia.org/wiki/NASA-TLX ; SUS — https://measuringu.com/sus/
