# Tổng quan đề tài: đang làm gì, tới đâu, sắp làm gì

> **File này giải thích gì:** bức tranh toàn cảnh của đồ án sau đợt tái cấu trúc: bài toán, cách giải, hai phần lớn (testbed và AI/RCA), góp ý giữa kỳ của giảng viên và cách nhóm trả lời, các quyết định thu gọn phạm vi (ADR-006), tuần 13 đã làm gì, quyết định về workload bán thực và bộ bằng chứng (ADR-007), kế hoạch 24 tuần (plan v0.4) và vị trí hiện tại. Đọc file này đầu tiên.
>
> **Nguồn gốc (canonical):**
>
> - [`../description/Mo_ta_de_tai_DATN_260811_125322_day_du.md`](../description/Mo_ta_de_tai_DATN_260811_125322_day_du.md) (mô tả đề tài đã đăng ký)
> - [`../direction/project-scope-v2.md`](../direction/project-scope-v2.md), [`../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md`](../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md)
> - [`../adr/adr-006-trim-project-scope-v1.md`](../adr/adr-006-trim-project-scope-v1.md), [`../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md`](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md)
> - [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) (thay [`plan-v0.3`](../plan/plan-v0.3-24-weeks.md), giữ làm lịch sử), [`../plan/weekly/week-13_2026-10-25_to_2026-10-31/weekly-overview.md`](../plan/weekly/week-13_2026-10-25_to_2026-10-31/weekly-overview.md)
> - [`../direction/realism-and-ai-contribution-strategy-v1.md`](../direction/realism-and-ai-contribution-strategy-v1.md) (đề xuất gốc của ADR-007, có số liệu nghiên cứu)
> - [`../../../README.md`](../../../README.md)
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge).

---

## 1. Đề tài trong một câu

> **Xây dựng hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố trong kiến trúc microservice dựa trên dữ liệu observability và học máy.**

Nói đời thường: khi một hệ thống gồm nhiều service gặp sự cố (trang web chậm, báo lỗi), đồ án xây một "trợ lý" tự động:

1. **phát hiện** có chuyện bất thường, từ lúc nào;
2. **khoanh vùng** service nào nhiều khả năng là thủ phạm, xếp hạng các nghi phạm;
3. **đưa bằng chứng** (metric, trace, log nào cho thấy điều đó)

để **người vận hành** chẩn đoán nhanh và chắc hơn. Chữ quan trọng là **"hỗ trợ"**: trợ lý không thay con người ra quyết định cuối cùng.

## 2. Vì sao bài toán này khó

Hình dung một bệnh viện có 11 khoa liên thông với nhau. Bệnh nhân (người dùng) chỉ thấy "khám mãi không xong". Nguyên nhân có thể ở phòng xét nghiệm, ở kho thuốc, hay ở quầy cấp thẻ. Triệu chứng hiện ra ở một nơi, nguyên nhân nằm ở nơi khác:

- **Lỗi lan truyền**: một service chậm làm những service gọi nó chậm theo. Nơi "kêu" to nhất thường **không phải** thủ phạm.
- **Lỗi đến muộn**: với việc chạy nền (worker, hàng đợi), người dùng đã nhận "OK" từ lâu, sự cố lộ ra sau vài phút, thậm chí vài giờ.
- **Lỗi rải rác**: khi `identity` (nơi cấp "thẻ ra vào") chết, các service lỗi lần lượt, mỗi nơi một thời điểm, theo lúc token của nó hết hạn.
- **Dữ liệu quá nhiều**: mỗi phút có hàng nghìn trace, hàng chục nghìn dòng log. Người lục tay sẽ tốn thời gian và dễ bỏ sót.

## 3. Cách nhóm giải bài toán: hai phần lớn

```text
┌──────────────────────── PHẦN 1: TESTBED (môi trường thí nghiệm) ────────────────────────┐
│  LMS thu gọn (7 service + 4 worker)  ← workload mô phỏng người dùng                     │
│                                        ← cố tình gây lỗi (fault injection) có đáp án    │
│        │ phát telemetry: metric + trace + log (OpenTelemetry)                           │
└────────┼─────────────────────────────────────────────────────────────────────────────────┘
         ▼
┌──────────────────────── PHẦN 2: AI/RCA ENGINE (sản phẩm chính) ─────────────────────────┐
│  chia cửa sổ thời gian → tính đặc trưng → chấm điểm bất thường → mở incident            │
│  → dựng đồ thị phụ thuộc → xếp hạng nghi phạm + bằng chứng                               │
│        │                                                                                 │
│        ▼  so với đáp án (ground truth) và với cách truy vết thủ công → đánh giá RQ1–RQ6 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Phần 1, testbed**: một hệ thống quản lý học tập (LMS) thu gọn, được xây **chỉ để làm vật thí nghiệm** (System Under Test). LMS không phải sản phẩm chính. Nó cần đủ phức tạp để sự cố lan truyền thật, và phải **tái lập được**: chạy lại cùng điều kiện thì ra cùng kết quả. Chi tiết: [`04-testbed-architecture.md`](04-testbed-architecture.md), [`05-observability.md`](05-observability.md), [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md).
- **Phần 2, AI/RCA engine**: đọc telemetry, phát hiện incident và xếp hạng nghi phạm. Đây là **phần chính** của đề tài. Chi tiết: [`08-ai-rca-design.md`](08-ai-rca-design.md).
- **Cầu nối giữa hai phần** là **thí nghiệm có kiểm soát**: chạy workload, gây một lỗi đã biết trước đáp án, thu telemetry, cho engine "làm bài", rồi chấm điểm. Chi tiết: [`07-experiment-concepts.md`](07-experiment-concepts.md), [`09-cases-and-workload.md`](09-cases-and-workload.md).

## 4. Hai thành viên và vai trò

| Ký hiệu trong plan | Người | Vai trò chính |
| --- | --- | --- |
| **A** | Đức | Backend/Platform: testbed, hạ tầng, workload, cơ chế gây lỗi |
| **B** | Bách | AI/Diagnosis: dữ liệu, detector, RCA engine, đánh giá |

Phân vai này lấy từ `implementation-backlog-v1.md`, vẫn giữ trong plan v0.4. Từ 17/11/2026, Bách tự làm phần bắt kịp tiến độ (dọn repo, ADR-006, plan v0.3, Gate R, toàn bộ tuần 13, ADR-007, plan v0.4), tức làm cả vai A lẫn B, và sẽ thông báo cho Đức khi repo ổn định tới phase RCA. Plan v0.4 mục 0.1 ghi rõ: các gate viết cho hai người (M3 đổi case, M4 chạy chéo) được Bách làm bằng cách chạy lại từ môi trường sạch theo checklist và ghi là ngoại lệ.

## 5. Chuyện gì đã xảy ra: từ báo cáo giữa kỳ tới hôm nay

### 5.1. Báo cáo giữa kỳ (sau tuần 10)

Tới tuần 10, nhóm có testbed **v1** (6 service + gateway, Redis, Storage Mock, một chuỗi bất đồng bộ) và bộ quan sát hoàn chỉnh. Giảng viên hướng dẫn góp ý **hai điểm**:

1. **"Truy vết thủ công vẫn tìm ra nguyên nhân, vậy AI/ML giúp gì?"** Phải chứng minh áp dụng ML/AI giúp chẩn đoán **hiệu quả hơn** hoặc **nhanh hơn**.
2. **"Traffic giả lập phải giống người dùng thật"**, không chỉ dùng k6 bắn request đều đều. Giảng viên gợi ý ba mức:
   - **Mức 1**, giả lập chuỗi request: đăng nhập → xem khóa học → mở bài học → làm bài → nộp bài.
   - **Mức 2**, giả lập hành vi: hồ sơ người dùng → mục tiêu → mô hình hành vi → hành động tiếp theo → phản hồi của hệ thống → cập nhật trạng thái người dùng → hành động tiếp theo.
   - **Mức 3**, AI agent đóng vai người dùng. Giảng viên lưu ý: nếu làm hướng khác thì phải chứng minh được.

Lúc đầu (plan v0.3) nhóm chọn **mức 1 + 2**; mức 3 không làm vì khó tái lập (mỗi lần chạy AI quyết định khác nhau) và không tạo được tải đủ lớn. Ngày 17/11/2026, ADR-007 đổi thành **dải bốn mức** có thêm **mức 2+** (phát lại phiên học viên thật từ log Moodle) và mức 3 dạng offline, xem mục 5.6.

### 5.2. Đợt tái cấu trúc (refactor) của Đức

Để testbed đủ phức tạp, giúp chứng minh giá trị của AI, Đức dựng lại testbed thành **v2**: 7 service + 4 worker, command qua RabbitMQ, lưu file ở MinIO, gửi email qua SMTP, gọi nhà cung cấp AI, và cơ chế "thẻ ra vào" giữa các service. Kèm theo là 5 quyết định kiến trúc (ADR-001 → ADR-005). Chi tiết: [`03-refactor-v1-to-v2.md`](03-refactor-v1-to-v2.md).

### 5.3. Bách thu gọn phạm vi (ADR-006, 17/11/2026)

Tới tuần 16, testbed v2 đã dựng xong nhưng **phần AI chưa có dòng code nào**, trong khi phạm vi lại phình thêm (tính năng LMS mới, MCP/agent, ranker có giám sát, 7 case). ADR-006 chốt lại:

| Quyết định | Nội dung ngắn |
| --- | --- |
| Đóng băng LMS | Không thêm tính năng; chỉ nhận thay đổi phục vụ telemetry, gây lỗi, workload. Hủy R-18 (URL ký cho media) |
| Vai trò RCA engine | **Hỗ trợ** người vận hành (đúng tên đề tài), không "tự kết luận thay người" |
| Phần học máy | Detector **không giám sát**, fit trên run khỏe, hiệu chỉnh trên tập validation. Ranker học có giám sát chuyển xuống Stretch |
| Đối chứng với thủ công (RQ6) | Đo bằng độ chính xác Top-K, thời gian, số thứ phải mở, độ ổn định khi nhiễu. Baseline thủ công được định nghĩa lại cho giống SRE thật |
| Bộ case | MVP: **C2, C3, C4, C6**; Target: C1, C5, C7; mỗi case **5 lần chạy** (1 validation + 4 test) |
| Ngoài phạm vi | MCP server và agent LLM |

### 5.4. Plan v0.3 và Gate R

Plan v0.3 viết lại lộ trình 24 tuần: tuần 1–10 giữ nguyên; tuần 11–12 là **giai đoạn tái cấu trúc**, kết thúc bằng **Gate R** (cổng cứng: chưa đạt thì không làm tiếp); tuần 13–23 là kế hoạch mới; tuần 24 để dự phòng. Plan v0.4 (mục 5.7) giữ nguyên khung này.

Gate R có 6 điều kiện. Trạng thái ngày 17/11/2026, sau khi PR #73 và #74 được merge: **đạt 5/6**.

| # | Điều kiện | Trạng thái |
| --- | --- | --- |
| 1 | Tài liệu v2 nhất quán | ✅ (PR #74 sửa thêm các chỗ lệch nhỏ, xem [`README`](README.md)) |
| 2 | LMS đóng băng trên `main` | ✅ |
| 3 | Regression, Postman, smoke đạt trên stack sạch; CI xanh | ✅ chạy ở máy đều đạt; CI trên GitHub tạm không chạy được vì tài khoản chủ repo bị khóa do vấn đề thanh toán |
| 4 | Telemetry đủ cho RCA, `operation_name` không chứa ID, lỗi publish RabbitMQ đúng identity | ✅ (sửa ngày 17/11/2026) |
| 5 | **Bách tự dựng stack từ máy sạch và giải thích được W1–W7** | ⏳ **Bách làm sau**, theo [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md); phải xong và có bằng chứng trước khi đóng tuần 13 |
| 6 | Issue cũ (#44, #50) và board refactor đã đóng | ✅ |

**Ngoại lệ:** Gate R là cổng cứng, nhưng Bách đã quyết định (sau khi được cảnh báo) bắt đầu tuần 13 khi còn thiếu điều kiện 5. Lý do: điều kiện 5 kiểm chứng hiểu biết của người làm, không thay đổi testbed; LMS đã đóng băng. Ngoại lệ ghi ở [tổng quan tuần 13](../plan/weekly/week-13_2026-10-25_to_2026-10-31/weekly-overview.md); Gate R không bị cắt.

### 5.5. Tuần 13 đã làm gì (từ 17/11/2026)

Tuần 13 của plan được lập và làm từ 17/11/2026 (tuần 16 theo lịch). Mọi task do Bách làm; 5 PR **đang mở, chưa merge** (thứ tự merge dự kiến #78 → #75 → #76 → #77 → #79 → PR task-06):

| Task | PR | Làm gì | Kết quả đã đo (17/11/2026) |
| --- | --- | --- | --- |
| task-01 | #78 | Tài liệu `workload-design-v1.md`: thiết kế workload mức 1 + 2 (profile, goal, máy trạng thái, think time, phản ứng lỗi, nhịp theo giờ), tham số tính lại từ OULAD | Đang được bổ sung mục mức 2+ và mức 3 offline theo ADR-007 |
| task-03 | #75 | `aiops-platform/faults/`: proxy **toxiproxy** chèn trễ/cắt kết nối (C2, C4), **LLM stub** chỉnh độ trễ/lỗi (C3), CLI `fault-control.mjs` | Trễ 200 ms ở `course` → PostgreSQL làm request chậm từ ~2 ms lên ~204 ms; LLM lỗi 100% → job AI `FAILED` (`AI_PROVIDER_ERROR`) |
| task-02 | #76 | `aiops-platform/load/`: k6 mức 1, mỗi hành trình W1–W7 một nhóm người dùng ảo | Run 2 phút: 7/7 hành trình, 737 request, 0 lỗi ngoài mong đợi |
| task-04 | #77 | `aiops-platform/training/`: export Prometheus, Tempo, Loki của một run ra file Parquet | Run thử: 152 608 điểm metric, 8 943 span (721 trace), 1 649 log, mất 82 giây |
| task-05 | #79 | `telemetry-data-dictionary-v2.md` + lệnh kiểm chất lượng dữ liệu (`pass`/`partial`/`fail`, cờ `telemetry_silent`) | Run thử `pass`; thử pause `scheduler` 70 giây → `partial`, đúng cờ `telemetry_silent` |
| task-06 | (PR tài liệu) | ADR-007, plan v0.4, rà soát tài liệu và bộ ghi chú này | — |

Cách tự chạy các phần này (sau khi merge): [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md) phần J. Các phát hiện kỹ thuật trong lúc làm: [`05-observability.md`](05-observability.md) mục 10.

### 5.6. ADR-007: workload bán thực và bộ bằng chứng (17/11/2026)

Làm xong tuần 13, Bách rà lại hai góp ý giữa kỳ và thấy câu trả lời còn yếu ở cả hai:

- **Dữ liệu vẫn giả lập 100%.** Mức 2 đã thiết kế, nhưng xác suất chuyển, mức kiên nhẫn, đường cong theo giờ là "giả định của đề tài". OULAD (Kuzilek et al. 2017, `[L-OULAD]`, https://pmc.ncbi.nlm.nih.gov/articles/PMC5704676/) chỉ có tổng click **theo ngày**, không tái dựng được một phiên học.
- **Baseline đơn giản rất mạnh.** Đánh giá 21 phương pháp RCA cho thấy "không phương pháp nào nổi bật ở mọi tình huống", nhiều phương pháp phức tạp gần như ngang chọn ngẫu nhiên (Pham et al. 2024, `[L-Pham2024ASE]`, https://arxiv.org/abs/2408.13729). Một luật đơn giản tên SimpleRCA (đếm cảnh báo theo service) thắng các phương pháp mới nhất trên 7/11 bộ dữ liệu (Top@1) (Fang et al. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711). Baseline thủ công `base-manual-auto` của đồ án về bản chất gần SimpleRCA, nên nếu chỉ so Top-K khi dữ liệu đầy đủ thì engine nhiều khả năng chỉ **hòa**.
- **Workload "đồ chơi" làm RCA trông giỏi hơn thật.** Cũng Fang et al. 2025: khi đổi từ tải đều, ít service sang tải theo hành vi phủ 84% service, độ chính xác Top-1 trung bình của 11 phương pháp còn 0,21; Nezha rơi từ 0,87 xuống 0,04 khi đánh giá trên bộ khó và thực tế hơn (bộ mới đổi nhiều yếu tố cùng lúc, không chỉ workload). Dữ liệu càng thật thì phép thử càng trung thực.

ADR-007 quyết định:

| Phần | Quyết định | Mức |
| --- | --- | --- |
| Nguồn traffic | Dải bốn mức: **mức 1** (đã có, làm mốc giả lập đơn giản); **mức 2** chỉ cho giảng viên, admin, job lịch (vai không có dữ liệu công khai); **mức 2+** phát lại phiên học viên thật từ log Moodle Unistudium 2022 (Franzoni, Biondi, Milani; `[L-Unistudium]`, https://zenodo.org/records/13763175, CC BY 4.0; 1 234 người, 208 109 sự kiện, 91 ngày); **mức 3 offline**: LLM sinh persona và nội dung **một lần**, k6 chỉ đọc lại | Mức 2, 2+: MVP; mức 3 offline: Stretch |
| Kiểm chứng "giống thật" | Giữ một phần log làm **hold-out** (không dùng để chỉnh tham số); đo cùng một bộ chỉ số cho ba nguồn tải (mức 1, mức 2 thuần, bán thực) và so với hold-out; ngưỡng chốt trước: JSD < 0,05, KS D < 0,1, trung vị lệch < ±10% | MVP |
| Bằng chứng AI có ích | E1 phát hiện dưới tải bán thực; E2 bảng chính có thêm **SimpleRCA** và **BARO**; E3 quan sát bị thiếu (trace lấy mẫu, log mất `trace_id`); E4 chi phí chẩn đoán; E5 ablation; E8 case study C6 | MVP |
| | E6 đối chứng trên benchmark công khai RCAEval; E7 thử nghiệm người (6–10 người nếu có, không thì 2–3 người định tính) | Target |
| Bộ case | Giữ 4 case × `R = 5` làm sàn; mỗi case có ít nhất một run test đặt lỗi **trùng cao điểm tải**; biến thể để có 32–40 incident là Target | MVP / Target |
| Đăng ký trước | Ở tuần 19, commit giả thuyết, cấu hình, ngưỡng, cách tính **trước** khi chạy run test | MVP |

Vì sao không dùng LLM agent chạy trực tiếp làm người dùng ảo: chậm (UXAgent khoảng 8 giây mỗi bước (bản v2 của bài); CHI EA 2025, `[L-UXAgent]`, https://arxiv.org/abs/2504.09407), hành vi lệch người thật (agent 6,05 so với người 15,96 thao tác/phiên; AgentA/B 2025, `[L-AgentAB]`, https://arxiv.org/abs/2504.09723), và không tất định ngay cả khi đặt temperature 0 (`[L-LLMNondet]`, 2024, https://arxiv.org/abs/2408.04667). Giải thích dễ hiểu hơn: [`research-defense/`](research-defense/README.md).

### 5.7. Plan v0.4 thay plan v0.3

Plan v0.4 (17/11/2026) giữ **khung 24 tuần, Gate R, mốc M3–M6 và tuần 24 dự phòng**; chỉ đổi nội dung:

| Tuần | Plan v0.3 | Plan v0.4 |
| --- | --- | --- |
| 13 | Thiết kế workload, k6 mức 1, LLM stub + proxy, export, data dictionary | Giữ nguyên (đã làm, PR #75–#79); thêm task-06 tài liệu |
| 14 | k6 mức 2 cho mọi vai; kiểm traffic so với phân phối mục tiêu | **Mức 2+** cho học viên (script log Moodle → file phiên, k6 phát lại); mức 2 chỉ cho giảng viên/admin/job lịch; **kiểm chứng hold-out** so ba nguồn tải; fault manifest |
| 15 | Runner, pilot, dataset v0 | Thêm pilot lỗi **trùng cao điểm tải**; chốt người tham gia E7 |
| 16 | Detector, incident | Thêm **E1** (detector học máy so với ngưỡng cố định dưới tải bán thực) |
| 17 | Graph, RCA baselines, `base-manual-auto` | Thêm **SimpleRCA**, **BARO**; đếm artifact cho E4 |
| 18 | Ranker, pipeline một lệnh (M4) | Giữ; bắt đầu E6 (RCAEval) nếu M4 đúng hạn (Target) |
| 19 | Đóng băng protocol, campaign chính | Thêm **đăng ký trước**; mỗi case ít nhất một run test trùng cao điểm |
| 20 | RQ1–RQ6, ablation, độ bền (RQ4 = bỏ 50% trace) | RQ4 thay bằng **E3** (giữ 50% và 10% trace, log mất `trace_id`, mất một nguồn); thêm E4, E8 |
| 21 | Phân tích lỗi, kết luận (M5) | E6, E7 (Target), mức 3 offline (Stretch) nếu còn thời gian |

Phương án nén lịch (plan v0.4 mục 9) cũng đổi thứ tự cắt, xem mục 6.

## 6. Lộ trình từ đây tới cuối kỳ

Tuần 1 bắt đầu ngày 02/08/2026. Bảng dưới ghép **số tuần trong plan** với **ngày theo lịch**:

| Tuần | Ngày | Việc chính theo plan v0.4 | Mốc |
| --- | --- | --- | --- |
| 13 | 25/10 – 31/10 | Thiết kế workload mức 1 + 2, k6 mức 1, LLM stub + proxy chèn trễ; export telemetry, từ điển dữ liệu, kiểm chất lượng dữ liệu; task-06 (ADR-007, plan v0.4). **Đã làm từ 17/11/2026, PR #75–#79 chưa merge** | |
| 14 | 01/11 – 07/11 | **Mức 2+** (log Moodle → file phiên, k6 phát lại phiên học viên) + mức 2 cho giảng viên/admin/job lịch; kiểm chứng hold-out so ba nguồn tải; fault manifest 4 case; `RunGroundTruth`, feature pipeline v0 | |
| 15 | 08/11 – 14/11 | Runner thí nghiệm, pilot (thêm run lỗi trùng cao điểm tải), dataset v0; chốt người tham gia E7 | **M3** |
| 16 | 15/11 – 21/11 | Detector và mở incident; baseline ngưỡng cố định; **E1** | |
| 17 | 22/11 – 28/11 | Đồ thị phụ thuộc, các baseline RCA, **SimpleRCA**, **BARO**, `base-manual-auto` + đếm artifact (E4) | |
| 18 | 29/11 – 05/12 | Ranker đề xuất (Hướng 1), bằng chứng, pipeline chạy bằng một lệnh; bắt đầu E6 nếu đúng hạn (Target) | **M4** |
| 19 | 06/12 – 12/12 | **Đăng ký trước**, đóng băng protocol, chạy campaign chính (mỗi case ≥ 1 run trùng cao điểm) | |
| 20 | 13/12 – 19/12 | Đánh giá RQ1–RQ6, **E3** (thay RQ4 cũ), E4, ablation E5, case study C6 (E8) | |
| 21 | 20/12 – 26/12 | Phân tích lỗi, kết luận, đóng băng kết quả; E6, E7 (Target), mức 3 offline (Stretch) nếu còn thời gian | **M5** |
| 22 | 27/12 – 02/01 | Đóng băng hệ thống, hợp nhất báo cáo | |
| 23 | 03/01 – 09/01 | Bàn giao cuối | **M6** |
| 24 | 10/01 – 16/01 | Dự phòng | |

**Vị trí hiện tại:** theo lịch đang là **tuần 16**, công việc vừa xong phần **tuần 13 của plan** (PR chưa merge) và Gate R còn điều kiện 5. Việc đang chậm khoảng 3–4 tuần: còn 8 tuần lịch (tuần 17–24) cho khối lượng tuần 13–23 của plan. Nhóm giữ mốc 24 tuần và **làm bù**. Nếu không kịp, plan v0.4 mục 9 có "phương án nén lịch", cắt theo thứ tự và dừng ngay khi đủ:

1. bỏ Stretch (mức 3 offline) và toàn bộ Target, theo thứ tự E7 → E6 → biến thể case → C1/C5/C7;
2. gộp tuần 14 và 15 (mức 2+ chỉ cho W3, mức 2 tối thiểu cho W2/W5);
3. giảm số lần chạy từ 5 xuống 4;
4. gộp tuần 20 và 21;
5. bỏ C3 nếu LLM stub chưa ổn sau tuần 14;
6. dùng tuần 24.

**Không bao giờ cắt**: Gate R, chất lượng đáp án (ground truth), cách chia dữ liệu chống "lộ đề", baseline thủ công `base-manual-auto` cùng ít nhất một baseline đã công bố (SimpleRCA hoặc BARO), kiểm chứng độ thực của workload, và đăng ký trước.

## 7. Trả lời góp ý giữa kỳ: ý chính

Phần này tóm tắt lập luận theo ADR-007, chi tiết ở [`08-ai-rca-design.md`](08-ai-rca-design.md) mục 7 và [`09-cases-and-workload.md`](09-cases-and-workload.md) mục 4.

**Góp ý 1, "AI giúp gì khi thủ công vẫn tìm ra":** nhóm **không** lập luận "người không tìm ra", vì ở nhiều case span lỗi của nguyên nhân nằm ngay trong trace. Nhóm cũng **không hứa "AI thắng mọi case"**: nghiên cứu cho thấy baseline đơn giản thường ngang hoặc hơn phương pháp phức tạp (Pham et al. 2024, `[L-Pham2024ASE]`, https://arxiv.org/abs/2408.13729; Fang et al. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711). Lập luận trung tâm: khi quan sát đầy đủ và tải đơn giản thì người hoặc luật đơn giản đã đủ tìm ra (nhóm báo cáo trung thực điều này); RCA engine tạo giá trị ở bốn chỗ, mỗi chỗ có một bằng chứng đo được:

- **Phát hiện trong nhiễu của tải thật** (E1): detector học máy so với cảnh báo ngưỡng cố định trên run khỏe có cao điểm trước hạn quiz (báo động giả mỗi giờ) và trên run có lỗi (độ trễ phát hiện).
- **Giữ độ chính xác khi quan sát bị thiếu** (E3): chỉ giữ 50% hoặc 10% trace, log mất `trace_id`, mất một nguồn dữ liệu; đúng với thực tế production, nơi trace thường bị lấy mẫu.
- **Giảm công sức và thời gian** (E4): số trace, biểu đồ, truy vấn log mà cách thủ công phải mở, so với bằng chứng engine trả sẵn.
- **Tự động, ổn định** trên mọi incident, kể cả khi lỗi trùng cao điểm tải.

Kèm theo: bảng chính so với **baseline mạnh đã công bố** SimpleRCA và BARO (Pham et al. 2024, `[L-BARO]`, https://arxiv.org/abs/2405.09330) chứ không chỉ baseline tự đặt (E2); case study C6 (E8); và nếu kịp thì đối chứng trên benchmark công khai RCAEval (Pham et al. 2025, `[L-RCAEval]`, https://arxiv.org/abs/2412.17015) và thử nghiệm người nhỏ theo mẫu LogAssist (TSE 2022 (online 2021), `[L-LogAssist]`, https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf).

**Góp ý 2, "traffic phải giống thật":** dải bốn mức. Học viên dùng **phiên thật** phát lại từ log Moodle (mức 2+); giảng viên, admin, job lịch dùng mô phỏng hành vi (mức 2); mức 1 giữ làm mốc so sánh; mức 3 chỉ làm dạng offline (Stretch). Giảng viên nói "làm hướng khác thì phải chứng minh được": nhóm chứng minh bằng **hold-out**, tức so traffic sinh ra với phần log thật được giữ lại, đo cùng một bộ chỉ số cho ba nguồn tải, với ngưỡng chốt trước khi đo.

---

## Tóm tắt

- Đề tài: phát hiện bất thường và **hỗ trợ** tìm nguyên nhân sự cố trong microservice, dựa trên telemetry và học máy.
- Hai phần: **testbed** (LMS v2, 7 service + 4 worker, chỉ là vật thí nghiệm) và **AI/RCA engine** (phần chính).
- Góp ý giữa kỳ: chứng minh AI giúp chẩn đoán hơn truy vết thủ công; traffic phải giống người dùng thật.
- Đức đã refactor testbed thành v2; Bách thu gọn phạm vi bằng ADR-006 (đóng băng LMS, 4 case MVP, R = 5, ML không giám sát, MCP ra ngoài phạm vi).
- Tuần 13 đã làm (5 PR #75–#79, chưa merge): proxy chèn trễ + LLM stub, k6 mức 1, export telemetry ra Parquet, data dictionary + kiểm chất lượng.
- ADR-007: học viên dùng phiên thật từ log Moodle (mức 2+), kiểm chứng bằng hold-out; bằng chứng E1–E8 với baseline đã công bố SimpleRCA, BARO; không hứa "AI thắng mọi case"; đăng ký trước ở tuần 19.
- Plan v0.4 thay v0.3: giữ khung 24 tuần, Gate R, M3–M6; đổi nội dung tuần 13–21.
- Gate R đạt 5/6, còn điều kiện 5 (Bách tự dựng stack và giải thích W1–W7), làm sau theo ngoại lệ đã ghi.
- Theo lịch đang tuần 16 nhưng công việc mới xong tuần 13 của plan: phải làm bù, có phương án nén lịch (plan v0.4 mục 9).

## Câu hỏi tự kiểm tra

1. Vì sao LMS chỉ là "vật thí nghiệm" mà không phải sản phẩm chính?
   <details><summary>Đáp án</summary>Đề tài là phát hiện bất thường và hỗ trợ RCA; LMS chỉ cung cấp một hệ thống microservice thật để tạo workload, telemetry, sự cố lan truyền và đáp án có kiểm soát. Sản phẩm chính là AI/RCA engine và kết quả đánh giá của nó.</details>

2. Chữ "hỗ trợ" trong tên đề tài ảnh hưởng gì tới thiết kế?
   <details><summary>Đáp án</summary>Engine đưa ra xếp hạng nghi phạm kèm bằng chứng để người vận hành quyết định, không phải tự kết luận thay người. ADR-006 dùng chữ này để thay cách nói "AI là bên truy vết chính" của ADR-002.</details>

3. Nhóm trả lời góp ý "thủ công vẫn tìm ra" bằng lập luận nào, và tránh lập luận nào?
   <details><summary>Đáp án</summary>Khi quan sát đầy đủ và tải đơn giản thì người hoặc luật đơn giản đã đủ tìm ra (báo cáo trung thực); engine có giá trị ở phát hiện trong nhiễu của tải thật (E1), giữ độ chính xác khi quan sát bị thiếu (E3), giảm công sức chẩn đoán (E4) và chạy tự động, ổn định; so với cả baseline đã công bố SimpleRCA, BARO (E2). Tránh lập luận "người không tìm ra" (ở nhiều case nguyên nhân hiện ngay trong trace) và tránh hứa "AI thắng mọi case" (nghiên cứu cho thấy baseline đơn giản thường ngang SOTA).</details>

4. Gate R là gì, vì sao gọi là "cổng cứng", và vì sao tuần 13 vẫn bắt đầu khi Gate R mới đạt 5/6?
   <details><summary>Đáp án</summary>Là mốc cuối tuần 12 của plan, xác nhận testbed v2 ổn định và đóng băng (6 điều kiện). "Cổng cứng" nghĩa là chưa đạt thì không bắt đầu việc của tuần 13 trở đi. Tuần 13 bắt đầu theo ngoại lệ Bách xác nhận: điều kiện 5 còn thiếu chỉ kiểm chứng hiểu biết của người làm, không đổi testbed; điều kiện này vẫn phải xong trước khi đóng tuần 13.</details>

5. Kể 4 case MVP và vì sao mỗi case lặp 5 lần.
   <details><summary>Đáp án</summary>C2, C3, C4, C6. Lặp 5 lần (1 validation + 4 test) để có đủ lần chấm cho mỗi case và báo cáo được khoảng dao động, thay vì 7 case × 3 lần chỉ có 2 lần test mỗi case. ADR-007 giữ <code>R = 5</code> làm sàn và thêm ít nhất một run test mỗi case trùng cao điểm tải.</details>

6. Nếu cuối kỳ không kịp, những thứ gì tuyệt đối không được cắt?
   <details><summary>Đáp án</summary>Theo plan v0.4 mục 9: Gate R, chất lượng ground truth, cách chia dữ liệu chống lộ đề, baseline thủ công <code>base-manual-auto</code> cùng ít nhất một baseline đã công bố (SimpleRCA hoặc BARO), kiểm chứng độ thực của workload, và đăng ký trước.</details>

7. Mức 2+ khác mức 2 ở đâu, và vì sao học viên dùng mức 2+?
   <details><summary>Đáp án</summary>Mức 2 sinh hành vi từ máy trạng thái với xác suất do đề tài tự đặt; mức 2+ phát lại phiên thật của học viên từ log Moodle Unistudium 2022 (thứ tự thao tác, think time, nhịp theo giờ lấy từ log). Học viên có dữ liệu công khai đủ chi tiết nên dùng phiên thật để trả lời "dữ liệu có thật không"; giảng viên, admin, job lịch không có dữ liệu công khai nên vẫn dùng mức 2.</details>

8. Plan v0.4 khác plan v0.3 ở những điểm lớn nào?
   <details><summary>Đáp án</summary>Khung 24 tuần, Gate R, M3–M6 giữ nguyên. Đổi nội dung: tuần 14 làm mức 2+ và kiểm chứng hold-out; tuần 15 thêm lỗi trùng cao điểm tải; tuần 16 thêm E1; tuần 17 thêm SimpleRCA, BARO; tuần 19 thêm đăng ký trước; tuần 20 E3 thay RQ4 cũ; E6, E7 là Target, mức 3 offline là Stretch; thứ tự nén lịch cũng đổi.</details>
