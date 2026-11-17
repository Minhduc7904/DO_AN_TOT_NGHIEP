# ADR-007 — Workload bán thực và bộ bằng chứng đóng góp của RCA engine

| Trường            | Nội dung |
| ----------------- | -------- |
| Trạng thái        | Chấp nhận (Bách quyết định ngày 17/11/2026, giai đoạn tự bắt kịp tiến độ) |
| Ngày              | 17/11/2026 (tuần 16 theo lịch) |
| Người đề xuất     | Bách |
| Bổ sung cho       | [ADR-006](adr-006-trim-project-scope-v1.md) mục 3 (đối chứng thủ công) và phần "Việc tiếp theo" về workload; [plan-v0.3](../plan/plan-v0.3-24-weeks.md) được thay bằng [plan-v0.4](../plan/plan-v0.4-24-weeks.md) |
| Thay thế một phần | Phạm vi mức 2 trong [workload-design-v1](../architecture/workload-design-v1.md) (mức 2 thuần không còn là nguồn traffic học viên); định nghĩa degradation của RQ4 trong [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) mục 13 |
| Tài liệu nghiên cứu | [realism-and-ai-contribution-strategy-v1](../direction/realism-and-ai-contribution-strategy-v1.md) (đề xuất gốc); danh mục tài liệu tham khảo: [literature-matrix-v1](../plan/literature-matrix-v1.md); giải thích dễ hiểu: [explanations-v2/research-defense](../explanations-v2/research-defense/README.md) |

## Bối cảnh

Góp ý giữa kỳ của giảng viên hướng dẫn có hai điểm quyết định kết quả phản biện ([plan-v0.3 mục 0](../plan/plan-v0.3-24-weeks.md)):

1. "Truy vết thủ công vẫn tìm ra nguyên nhân, vậy AI/ML giúp gì?" — phải chứng minh RCA engine đóng góp **thực sự**.
2. "Traffic giả lập phải giống người dùng thật" — gợi ý ba mức: chuỗi request, mô phỏng hành vi (User Profile → Goal → Behavior Model → Next Action → System Response → Update User State), AI agent đóng vai người dùng; "làm hướng khác thì phải chứng minh được".

Rà soát ngày 17/11/2026 (sau khi xong phần việc tuần 13, PR #75–#79) cho thấy:

- **Dữ liệu vẫn giả lập 100%.** Mức 1 đã cài ([PR #76](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/76)); mức 2 đã thiết kế ([PR #78](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/78)) nhưng xác suất chuyển, mức kiên nhẫn, đường cong theo giờ là "giả định của đề tài". OULAD chỉ có tổng click **theo ngày** (đã kiểm `studentVle.csv`), không tái dựng được phiên.
- **Baseline đơn giản rất mạnh.** Pham et al. (ASE 2024) đánh giá 21 phương pháp RCA: "no method stands out in all situations", nhiều phương pháp causal gần như ngang chọn ngẫu nhiên ([arXiv 2408.13729](https://arxiv.org/abs/2408.13729)). Fang et al. (2025) cho thấy SimpleRCA (đếm cảnh báo theo service) thắng SOTA trên 7/11 bộ dữ liệu (Top@1) ([arXiv 2510.04711](https://arxiv.org/abs/2510.04711)). `base-manual-auto` của ADR-006 về bản chất gần TraceRCA/SimpleRCA, nên ở C2/C3/C4 (span lỗi nằm ngay trong trace) engine nhiều khả năng chỉ hòa nếu chỉ so Top-K khi quan sát đầy đủ.
- **Workload đơn giản làm RCA trông giỏi hơn thực tế.** Fang et al. đo QPS của các benchmark cũ chỉ 0,14–4,35 (ví dụ trên Train-Ticket) và phủ ít service (RE2-TT 27/69); với workload theo máy trạng thái (16,47 QPS, phủ 84%), Top-1 trung bình của 11 phương pháp còn 0,21, Nezha từ 0,87 xuống 0,04 khi đánh giá trên bộ khó và thực tế hơn (bộ mới đổi nhiều yếu tố cùng lúc, không chỉ workload) ([arXiv 2510.04711](https://arxiv.org/abs/2510.04711)). Dữ liệu càng thật thì phép đánh giá càng trung thực.
- **Có log LMS thật, công khai, đủ chi tiết để phát lại phiên:** Unistudium 2022 (Moodle, Đại học Perugia; [Zenodo 13763175](https://zenodo.org/records/13763175), CC BY 4.0) — 1 234 người dùng, 208 109 sự kiện, 45 loại sự kiện chuẩn của Moodle, 4 khóa, 91 ngày, timestamp tới giây (đã kiểm trên file).
- **LLM agent chạy online không hợp làm nguồn tải:** UXAgent khoảng 8 giây mỗi bước (bản v2 của bài) ([arXiv 2504.09407](https://arxiv.org/abs/2504.09407)); AgentA/B agent chỉ 6,05 hành động/phiên so với 15,96 của người thật ([arXiv 2504.09723](https://arxiv.org/abs/2504.09723)); cấu hình temperature 0 vẫn không tất định ([arXiv 2408.04667](https://arxiv.org/abs/2408.04667)).

## Quyết định

### 1. Nguồn traffic: dải bốn mức, học viên dùng dữ liệu thật

| Mức | Nội dung | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| 1 | Chuỗi request cố định W1–W7 | Smoke test; **mốc giả lập đơn giản** khi kiểm chứng độ thực | Đã cài (PR #76) |
| 2 | Máy trạng thái theo profile/goal, think time, phản ứng lỗi, nhịp theo giờ | **Chỉ** giảng viên (W2, W4 phía giảng viên, W6), admin (W5), job lịch (W7) — các vai không có dữ liệu công khai | MVP, tuần 14 |
| **2+** | **Phát lại phiên thật** của học viên từ log Moodle Unistudium 2022: ánh xạ sự kiện Moodle → endpoint LMS; giữ nguyên thứ tự thao tác và think time trong phiên; tốc độ bắt đầu phiên theo giờ và đỉnh trước hạn quiz lấy từ cùng log; chỉ nén lịch bắt đầu phiên (một ngày → 48 phút), không nén think time; phần cần sinh thêm dùng ma trận chuyển **học từ log** (cách làm của WESSBAS, [Vögele et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/)) | Nguồn chính cho học viên (W1, W3, W4 phía học viên) | MVP, tuần 14 |
| 3 (offline) | LLM sinh **một lần** persona giảng viên và nội dung (đề cương, câu hỏi, tài liệu cho W6), lưu JSON có hash, k6 chỉ đọc. Không chạy agent online | Độ thực của **nội dung**, không phải nhịp tải | **Stretch** (làm nếu còn thời gian) |

Quy tắc dữ liệu:

- Log Moodle không commit vào repo; repo có script tải từ Zenodo kèm kiểm sha256 và ghi nguồn đúng giấy phép CC BY 4.0. Bảng ánh xạ sự kiện và tỉ lệ sự kiện được phủ được báo cáo (theo bảng ánh xạ ở [workload-design-v1](../architecture/workload-design-v1.md) mục 13.2: 95,2% số dòng, 198 095/208 109).
- Người dùng và khóa học trong log được gán sang tài khoản/khóa học seed. Khi quy mô một ngày chưa đủ tải, **chồng nhiều ngày hoặc nhiều khóa** (đổi id) và ghi rõ là đã khuếch đại.
- OULAD giữ vai trò kiểm tra vĩ mô (tỉ lệ profile, mức tăng hoạt động trước hạn) và nguồn tham số cho mức 2.
- Thời điểm bắt đầu phiên theo Poisson không thuần nhất (tốc độ đổi theo giờ), theo [Paxson & Floyd 1995](https://www.icir.org/vern/papers/poisson.TON.pdf); W7 là lịch cố định.

### 2. Kiểm chứng độ thực của traffic

1. Chia log Moodle thành phần **xây** và phần **hold-out** (theo thời gian hoặc theo khóa); không dùng hold-out để chỉnh tham số.
2. Ghi log gateway khi k6 chạy và so với hold-out: phân phối số thao tác/phiên và độ dài phiên (KS, báo thống kê D), think time, tỉ lệ loại thao tác (Jensen–Shannon), hình dạng theo giờ (tương quan), tỉ số đỉnh/trung bình theo ngày, độ burst (index of dispersion, Hurst).
3. Chạy **cùng bộ đo** cho ba nguồn: mức 1 (tốc độ hằng), mức 2 thuần giả định, bán thực (mức 2+). Kết luận "giống thật" chỉ khi bán thực gần hold-out nhất.
4. Ngưỡng chốt trước khi đo: JSD < 0,05; KS D < 0,1; trung vị lệch < ±10%. Không đạt thì báo cáo đúng số đo, không đổi ngưỡng sau khi xem kết quả.

### 3. Bộ bằng chứng đóng góp của RCA engine

Lập luận trung tâm: khi quan sát đầy đủ và tải đơn giản, luật đơn giản hoặc người đã đủ tìm ra nguyên nhân — nhóm báo cáo trung thực điều này. RCA engine tạo giá trị ở bốn chỗ: **phát hiện** sự cố trong nhiễu của tải thật, **giữ độ chính xác khi quan sát bị thiếu**, **giảm công sức và thời gian** chẩn đoán, và chạy **tự động, ổn định** trên mọi incident.

| # | Bằng chứng | Mức |
| --- | --- | --- |
| E1 | Phát hiện dưới tải bán thực: detector học máy (fit trên run khỏe) so với cảnh báo ngưỡng cố định — báo động giả/giờ trên run khỏe có cao điểm trước hạn quiz, độ trễ phát hiện, recall trên run có lỗi | MVP |
| E2 | Bảng chính: engine so với random, xếp hạng hằng, ngưỡng tĩnh, `base-manual-auto`, **SimpleRCA** ([Fang et al. 2025](https://arxiv.org/abs/2510.04711)), **BARO** ([Pham et al., FSE 2024](https://arxiv.org/abs/2405.09330)); chỉ số chính Top-1 và MRR, kèm Top-3; theo từng case; bootstrap CI 95%; kiểm định ghép cặp (McNemar exact) | MVP |
| E3 | Quan sát suy giảm (offline, cùng run): giữ 50% và 10% trace (lấy mẫu cả trace), log mất `trace_id`, mất một modality — thay định nghĩa RQ4 chỉ có "bỏ 50% trace" | MVP |
| E4 | Chi phí chẩn đoán: số artifact (trace, panel, truy vấn log) `base-manual-auto` phải mở và thời gian, so với bằng chứng engine trả sẵn | MVP |
| E5 | Ablation: bỏ từng modality; bỏ graph; bỏ temporal; thay detector học máy bằng z-score | MVP |
| E6 | Đối chứng ngoài trên benchmark công khai **RCAEval RE2** (Online Boutique, Train Ticket; MIT; [arXiv 2412.17015](https://arxiv.org/abs/2412.17015)): tái lập BARO trước để kiểm pipeline, rồi chạy engine qua adapter, đặt cạnh số đã công bố | **Target** |
| E7 | Thử nghiệm người: within-subject, mỗi người 4 incident, nửa dùng Grafana thủ công, nửa có báo cáo engine, cân bằng thứ tự; đo thời gian, đúng/sai, số thứ đã mở, NASA-TLX rút gọn, SUS; mẫu tham khảo LogAssist ([IEEE TSE 2022 (online 2021)](https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf)). Số người: 6–10 nếu tìm được, nếu không thì 2–3 người, chỉ minh họa định tính như ADR-006 | **Target**; chốt người tham gia trước tuần 15 của plan |
| E8 | Case study C6: chuỗi bằng chứng của engine (lỗi ở gateway, nguyên nhân ở `identity` im lặng, cờ `telemetry_silent`) đặt cạnh đường truy vết thủ công | MVP |

Bổ sung cho bộ case (giữ `R = 5` của ADR-006 làm sàn):

- Mỗi case MVP có ít nhất một run test đặt fault **trùng cao điểm tải bán thực** (nhiều triệu chứng, tải cao hợp lệ lẫn với sự cố).
- Biến thể cường độ/thời điểm để tăng số incident test lên khoảng 32–40 là **Target**.

### 4. Đăng ký trước (pre-registration)

Ở mốc freeze protocol (tuần 19 của plan), commit vào repo **trước** khi chạy run test: giả thuyết của E1–E5, cấu hình engine và baseline (đã chọn trên validation), ngưỡng của mục 2, cách tính CI và kiểm định. Không đổi sau khi xem kết quả test; mọi thay đổi bắt buộc ghi thành phiên bản mới kèm lý do.

### 5. Cách báo cáo

- Chỉ số chính là Top-1 và MRR, luôn kèm mốc random và xếp hạng hằng (ADR-006).
- Case engine hòa hoặc thua baseline được báo cáo đầy đủ; kết quả trên RCAEval là kiểm tra khả năng tổng quát, không phải bảng xếp hạng.
- Mẫu nhỏ: luôn kèm CI, không tuyên bố có ý nghĩa thống kê khi không đạt.

## Hệ quả

- **Tuần 13 giữ nguyên.** PR #75 (fault overlay), #76 (k6 mức 1), #77 (export), #79 (data dictionary, quality) không đổi; PR #78 (workload-design-v1) được bổ sung mục mức 2+ và mức 3 offline. Thêm task-06 tuần 13 cho phần tài liệu này.
- [plan-v0.4](../plan/plan-v0.4-24-weeks.md) thay plan-v0.3: đổi nội dung tuần 14 (mức 2+), 15 (fault trùng cao điểm), 16 (E1), 17 (SimpleRCA, BARO), 18–20 (E6, E7 Target), 19 (đăng ký trước), 20 (E3, E4); khung 24 tuần, Gate và mốc không đổi.
- [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md), [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md), [research-questions-and-metrics-v2](../direction/research-questions-and-metrics-v2.md), [project-scope-v2](../direction/project-scope-v2.md) có ghi chú cập nhật trỏ về ADR này; đoạn chi tiết chưa sửa từng dòng thì ADR này được ưu tiên.
- Danh mục tài liệu tham khảo dùng cho báo cáo: [literature-matrix-v1](../plan/literature-matrix-v1.md).

## Phương án đã loại

- **Giữ mức 2 thuần giả định cho cả học viên:** không trả lời được "dữ liệu có thật không"; WESSBAS cũng ghi nhận Markov bậc 1 tự đặt sinh phiên dài hơn thật.
- **Phát lại OULAD:** chỉ có tổng click theo ngày, không có giờ trong ngày.
- **EdNet:** là app luyện đề, license CC BY-NC; **KDD Cup 2015/XuetangX:** license và link tải không chắc; **MOOCCubeX:** quá lớn (một tệp 21 GB); **trace Alibaba 2022:** khoảng 2 TB và tốc độ đã chuẩn hóa về 0–1.
- **LLM agent chạy online làm nguồn tải (mức 3 đầy đủ):** chậm (~8 s/bước, bản v2 của bài), không tất định, lệch hành vi người thật; chỉ giữ dạng offline ở Stretch.
- **Nâng RCAEval hoặc thử nghiệm người lên MVP:** theo lịch còn 8 tuần cho khối lượng tuần 13–23; giữ Target để không cắt E1–E5.

## Tài liệu tham khảo

Danh mục đầy đủ (trích dẫn, URL, giấy phép, dùng ở đâu) ở [literature-matrix-v1](../plan/literature-matrix-v1.md). Các nguồn chính của ADR này:

1. Fang et al., 2025 — arXiv 2510.04711 — https://arxiv.org/abs/2510.04711
2. Pham et al., ASE 2024 — arXiv 2408.13729 — https://arxiv.org/abs/2408.13729
3. Pham et al., RCAEval, WWW 2025 Companion — arXiv 2412.17015 — https://arxiv.org/abs/2412.17015 ; https://github.com/phamquiluan/RCAEval
4. Pham et al., BARO, FSE 2024 — arXiv 2405.09330 — https://arxiv.org/abs/2405.09330
5. Franzoni, Biondi, Milani — Unistudium 2022 Moodle logs — https://zenodo.org/records/13763175
6. Kuzilek et al., OULAD, Scientific Data 2017 — https://pmc.ncbi.nlm.nih.gov/articles/PMC5704676/
7. Vögele et al., WESSBAS, SoSyM 2018 — https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/
8. Paxson & Floyd, Wide-Area Traffic: The Failure of Poisson Modeling, ToN 1995 — https://www.icir.org/vern/papers/poisson.TON.pdf
9. UXAgent (LLM agent cho kiểm thử usability web), CHI EA 2025 — arXiv 2504.09407 — https://arxiv.org/abs/2504.09407
10. AgentA/B (A/B testing bằng LLM agent) — arXiv 2504.09723 — https://arxiv.org/abs/2504.09723
11. Nghiên cứu về tính không tất định của LLM ở cấu hình "deterministic" — arXiv 2408.04667 — https://arxiv.org/abs/2408.04667
12. LogAssist (hỗ trợ phân tích log, có user study), IEEE TSE 2022 (online 2021) — https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf
