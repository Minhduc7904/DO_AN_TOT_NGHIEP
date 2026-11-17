# Lộ trình đọc tài liệu gốc (bản v2)

> **File này giải thích gì:** trong `docs/processed/` có rất nhiều tài liệu, nhiều bản đã cũ. File này chỉ ra tài liệu gốc nào **còn hiệu lực**, đọc theo thứ tự nào, phần nào bỏ qua được, và khi hai tài liệu nói khác nhau thì tin bản nào. Thay cho `reading-guide.md` của folder cũ (viết cho testbed v1).
>
> **Nguồn gốc (canonical):** [`../../../README.md`](../../../README.md) (bảng "Tài liệu canonical"), [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) (mục 10), [`../adr/adr-006-trim-project-scope-v1.md`](../adr/adr-006-trim-project-scope-v1.md), [`../../../AGENTS.md`](../../../AGENTS.md).
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch).

---

## 1. Quy tắc ưu tiên khi tài liệu mâu thuẫn

Đợt tái cấu trúc làm nhiều tài liệu bị "cũ một nửa": phần đầu đã có banner cập nhật, nhưng đoạn chi tiết bên dưới chưa sửa từng dòng. Thứ tự tin cậy, từ cao xuống thấp:

```text
1. Code đang chạy trên `main` + kết quả test thật           ← sự thật cuối cùng về hành vi
2. ADR-007 + ADR-006 (17/11/2026)                           ← quyết định mới nhất: workload bán thực, E1–E8; thu gọn phạm vi
3. plan-v0.4                                                ← ai làm gì, khi nào
4. ADR-001 → ADR-005                                        ← quyết định kiến trúc testbed v2
5. Tài liệu kiến trúc/định hướng bản v2 (hoặc v1 cho AI/RCA) ← chi tiết thiết kế
6. Ghi chú giải thích (folder này, folder cũ)               ← chỉ để hiểu, không phải nguồn
```

Mẹo: thấy banner **"Cập nhật 17/11/2026 (ADR-006)"** ở đầu một file nghĩa là đoạn nào trong file đó trái với ADR-006 thì theo ADR-006.

## 2. Bảng tài liệu còn hiệu lực

### 2.1. Nhóm "vì sao, làm gì"

| Tài liệu | Nói gì | Nên đọc khi |
| --- | --- | --- |
| [`../description/Mo_ta_de_tai_DATN_260811_125322_day_du.md`](../description/Mo_ta_de_tai_DATN_260811_125322_day_du.md) | Mô tả đề tài đã đăng ký với khoa | Trước khi bảo vệ: để nói đúng tên và mục tiêu |
| [`../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md`](../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md) | Định hướng tổng thể: vì sao, làm gì, câu hỏi nghiên cứu | Muốn nhìn toàn cảnh học thuật |
| [`../direction/project-scope-v2.md`](../direction/project-scope-v2.md) | Phạm vi: MVP / Target / Stretch / ngoài phạm vi | Cần biết một hạng mục có bắt buộc không |
| [`../direction/research-questions-and-metrics-v2.md`](../direction/research-questions-and-metrics-v2.md) | RQ1–RQ6 và cách đo | Chuẩn bị phần đánh giá |
| [`../adr/adr-006-trim-project-scope-v1.md`](../adr/adr-006-trim-project-scope-v1.md) | Thu gọn phạm vi, đóng băng LMS, 4 case MVP, R = 5 | **Bắt buộc**, ngắn (khoảng 12 KB) |
| [`../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md`](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) | Workload bán thực (mức 2+ phát lại phiên Moodle thật), bộ bằng chứng E1–E8, đăng ký trước | **Bắt buộc** trước phần thực nghiệm |
| [`../direction/realism-and-ai-contribution-strategy-v1.md`](../direction/realism-and-ai-contribution-strategy-v1.md) | Phân tích gốc kèm tra cứu cho ADR-007 | Muốn biết vì sao chọn như vậy |

### 2.2. Nhóm "khi nào, ai làm"

| Tài liệu | Nói gì |
| --- | --- |
| [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) | **Kế hoạch hiện hành** (thay v0.3 từ 17/11/2026; khác v0.3 ở nội dung tuần 13–21, xem mục 0.1): 24 tuần, Gate R, mốc M3–M6, phương án nén lịch (mục 9) |
| [`../plan/refactor/refactor-board-v1.md`](../plan/refactor/refactor-board-v1.md) | Nhật ký chi tiết các task tái cấu trúc R-01 → R-18 (đã đóng) |
| [`../plan/implementation-backlog-v1.md`](../plan/implementation-backlog-v1.md) | Phân vai A = Đức, B = Bách còn dùng; phần việc từ tuần 11 đã bị plan v0.3 thay |

### 2.3. Nhóm testbed (backend)

| Tài liệu | Nói gì |
| --- | --- |
| [`../architecture/backend-microservice-testbed-blueprint-v2.md`](../architecture/backend-microservice-testbed-blueprint-v2.md) | **Blueprint backend canonical**: phạm vi, topology, yêu cầu workload/fault/observability, kiến trúc code |
| [`../architecture/service-catalogue-and-topology-v2.md`](../architecture/service-catalogue-and-topology-v2.md) | Danh mục 11 runtime, đồ thị phụ thuộc, cạnh `e01–e29`, candidate set, W1–W7 |
| [`../architecture/http-and-event-contracts-v2.md`](../architecture/http-and-event-contracts-v2.md) | Mọi API và command (rất dài, dùng để tra) |
| [`../architecture/dependency-resilience-policy-v2.md`](../architecture/dependency-resilience-policy-v2.md) | Timeout, circuit breaker, retry, token, cách quy đổi lỗi, dependency identity |
| [`../architecture/data-ownership-and-fault-matrix-v2.md`](../architecture/data-ownership-and-fault-matrix-v2.md) | Dữ liệu thuộc ai, ma trận lỗi FA–FH |
| [`../adr/`](../adr/) ADR-001 → ADR-005 | Các quyết định của đợt tái cấu trúc |

### 2.4. Nhóm AI/RCA và đánh giá

| Tài liệu | Nói gì |
| --- | --- |
| [`../architecture/analysis-anomaly-rca-blueprint-v1.md`](../architecture/analysis-anomaly-rca-blueprint-v1.md) | **Blueprint AI/RCA canonical**: dữ liệu, feature, detector, incident, graph, xếp hạng, bằng chứng (rất dài, khoảng 110 KB) |
| [`../architecture/evaluation-protocol-v1.md`](../architecture/evaluation-protocol-v1.md) | Quy chế "thi": chia dữ liệu, chống lộ đề, chấm điểm (khoảng 100 KB) |
| [`../architecture/telemetry-and-ground-truth-schema-v1.md`](../architecture/telemetry-and-ground-truth-schema-v1.md) | Định dạng dữ liệu telemetry và phiếu đáp án `RunGroundTruth` |
| [`../architecture/complex-case-catalogue-and-rca-result-v0.md`](../architecture/complex-case-catalogue-and-rca-result-v0.md) | Tín hiệu có thật của testbed, case C1–C7, schema kết quả RCA |
| [`../plan/literature-matrix-v1.md`](../plan/literature-matrix-v1.md) | **Danh mục tài liệu tham khảo** (khóa `[L-…]`, trích dẫn đầy đủ, URL, giấy phép); v0 giữ phân tích chi tiết L1–L12 |
| [`../architecture/workload-design-v1.md`](../architecture/workload-design-v1.md) | Thiết kế workload mức 1, 2, 2+, 3 offline (PR #78) |
| [`../architecture/telemetry-data-dictionary-v2.md`](../architecture/telemetry-data-dictionary-v2.md) | Cột của artifact export, schema chuẩn hóa v2, data-quality report (PR #79) |
| [`research-defense/`](research-defense/README.md) | Giải thích dễ hiểu phần nghiên cứu cho phản biện, kèm PDF |

### 2.5. Nhóm hướng dẫn vận hành

| Tài liệu | Nói gì |
| --- | --- |
| [`../../../docker-compose/README.md`](../../../docker-compose/README.md) | Dựng stack, reset/seed, regression, smoke observability |
| [`../../../lms/README.md`](../../../lms/README.md) | Toolchain (Node, pnpm), lệnh test |
| [`../../../aiops-platform/observability/README.md`](../../../aiops-platform/observability/README.md) | Bộ quan sát: cổng, mật khẩu Grafana, metric hàng đợi |
| [`../../../lms/packages/observability/README.md`](../../../lms/packages/observability/README.md) | Metric, nhãn, định dạng log của LMS |
| [`../guides/seed-data-guide.md`](../guides/seed-data-guide.md) | Nạp dữ liệu mẫu số lượng lớn |
| [`../../../postman/README.md`](../../../postman/README.md) | Bộ request Postman/newman |

## 3. Thứ tự đọc đề xuất cho Bách

Mỗi bước: đọc **ghi chú giải thích** (folder này) trước cho dễ hiểu, rồi mới mở **tài liệu gốc** khi cần chi tiết hoặc con số chính xác.

| Bước | Ghi chú giải thích | Tài liệu gốc tương ứng | Mục tiêu |
| --- | --- | --- | --- |
| 1 | [`01-project-overview.md`](01-project-overview.md) | ADR-006, ADR-007, plan v0.4 mục 0 và 4 | Biết đề tài đang ở đâu |
| 2 | [`02-basic-concepts.md`](02-basic-concepts.md) | (không cần) | Nắm từ vựng |
| 3 | [`03-refactor-v1-to-v2.md`](03-refactor-v1-to-v2.md) | ADR-001 → ADR-005, refactor board | Hiểu testbed đã đổi gì |
| 4 | [`04-testbed-architecture.md`](04-testbed-architecture.md) | blueprint v2, catalogue v2 | Hiểu testbed hiện hành |
| 5 | [`05-observability.md`](05-observability.md) | `lms/packages/observability/README.md` | Biết dữ liệu nào có, dữ liệu nào thiếu |
| 6 | [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md) | `docker-compose/README.md` | **Tự dựng stack, tự giải thích W1–W7 (Gate R, điều kiện 5)** |
| 7 | [`07-experiment-concepts.md`](07-experiment-concepts.md) | telemetry schema v1, evaluation protocol v1 | Hiểu "kỳ thi" của engine |
| 8 | [`09-cases-and-workload.md`](09-cases-and-workload.md) | catalogue case, ADR-007, plan v0.4 tuần 13–15 | Chuẩn bị việc tuần 13–15 |
| 9 | [`08-ai-rca-design.md`](08-ai-rca-design.md) | analysis blueprint v1, research questions v2 | Chuẩn bị việc tuần 16–21, bảo vệ |
| — | [`10-naming-cheatsheet.md`](10-naming-cheatsheet.md) | | Tra tên khi đọc trace/metric |

Bước 8 đứng trước bước 9 vì workload và case là việc phải làm ngay sau Gate R.

## 4. Những tài liệu không cần đọc (đã cũ)

| Tài liệu | Vì sao bỏ qua |
| --- | --- |
| `../architecture/backend_microservice_testbed_blueprint.md` (tên có dấu gạch dưới) | Blueprint testbed **v1**, thay bằng `backend-microservice-testbed-blueprint-v2.md` |
| `../architecture/analysis-anomaly-rca-blueprint.md` (không có `-v1`) | Blueprint AI **v0**, thay bằng bản `-v1` |
| `*-v0.md`, `*-v1.md` khi đã có `-v2` cùng chủ đề (contracts, catalogue, resilience, data ownership, evaluation v0, telemetry schema v0) | Bản trước refactor |
| `../direction/project-scope-v1.md`, `research-questions-and-metrics-v1.md`, `khung_dinh_huong_tong_the_lms_microservice_ai_rca.md` | Bản trước refactor |
| `../plan/plan-v0.1-20-weeks.md`, `plan-v0.2-24-weeks.md`, `plan-v0.3-24-weeks.md` | Thay bằng plan v0.4 (v0.2 vẫn đúng cho tuần 1–10; v0.3 đúng cho tuần 11–12) |
| `../adr/adr-002-ai-primary-root-cause-analysis-v1.md` quyết định 1–3 | Đã bị ADR-006 thay |
| `../plan/weekly/` tuần 1–10, `../../../workspace/*/week-0*` | Hồ sơ lịch sử của testbed v1, chỉ đọc khi cần bằng chứng tiến độ cũ |

## 5. Folder giải thích cũ `weekly-explanations/` còn dùng được gì

Folder cũ viết cho testbed **v1**. Một phần còn đúng vì là khái niệm chung, phần lớn chỉ còn giá trị lịch sử:

| File cũ | Còn dùng? | Ghi chú |
| --- | --- | --- |
| `week-01` … `week-04` | ✅ để hiểu lịch sử | Chuẩn bị, chọn đề tài, chốt phạm vi, thiết kế trên giấy. Tư duy vẫn đúng; tên service đã đổi |
| `week-05` | ⚠️ một phần | Nền tảng repo, Compose, OpenTelemetry, CI: ý tưởng đúng, chi tiết đã đổi (pnpm, observability tách ra `aiops-platform/`) |
| `week-06` … `week-09` | ❌ code v1 | Gateway/Auth/Course/Enrollment/Submission/Grading đã bị gỡ hoặc viết lại. Đoạn giải thích khái niệm (timeout, retry, outbox, high cardinality) đã được đưa vào [`02-basic-concepts.md`](02-basic-concepts.md) |
| `experiment-concepts.md` | ✅ đã cập nhật | Bản mới: [`07-experiment-concepts.md`](07-experiment-concepts.md) |
| `ai-rca-design-docs-explained.md` | ⚠️ ý tưởng còn đúng | Viết theo blueprint v0; bản mới theo blueprint v1 + ADR-006: [`08-ai-rca-design.md`](08-ai-rca-design.md) |
| `testbed-design-docs-explained.md` | ❌ topology v1 | Bản mới: [`04-testbed-architecture.md`](04-testbed-architecture.md) |
| `identity-naming-cheatsheet.md` | ❌ tên v1 | Bản mới: [`10-naming-cheatsheet.md`](10-naming-cheatsheet.md) |
| `progress-report-week-10/` | ❌ trừ `week-10-observability.md` | Kịch bản báo cáo giữa kỳ và giải thích service v1. Phần observability đã cập nhật ở [`05-observability.md`](05-observability.md) |
| `reading-guide.md` | ❌ | Thay bằng file này |

## Tóm tắt

- Thứ tự tin cậy: code + test thật > ADR-007, ADR-006 > plan v0.4 > ADR-001→005 > tài liệu kiến trúc > ghi chú giải thích.
- Tài liệu hiện hành: các file `-v2` cho testbed; `analysis-anomaly-rca-blueprint-v1`, `evaluation-protocol-v1`, `telemetry-and-ground-truth-schema-v1` cho AI/RCA; `plan-v0.3` cho lịch.
- Bỏ qua: blueprint có dấu gạch dưới (v1), các bản `-v0`/`-v1` khi đã có `-v2`, plan v0.1/v0.2 (trừ tuần 1–10), hồ sơ tuần cũ.
- Đọc ghi chú trong folder này trước, mở tài liệu gốc khi cần số liệu chính xác.

## Câu hỏi tự kiểm tra

1. Một đoạn trong `evaluation-protocol-v1.md` ghi "`R = 3` mỗi case", ADR-006 ghi `R = 5`. Theo cái nào?
   <details><summary>Đáp án</summary>Theo ADR-006 (<code>R = 5</code>). File evaluation protocol có banner cập nhật ADR-006, nói rõ khi mâu thuẫn thì ADR-006 được ưu tiên.</details>

2. Muốn biết `course` có những endpoint nội bộ nào thì mở tài liệu nào?
   <details><summary>Đáp án</summary><code>http-and-event-contracts-v2.md</code> (hoặc code trong <code>lms/contracts/src/http/</code>); bảng tra nhanh ở <code>04-testbed-architecture.md</code>.</details>

3. `backend_microservice_testbed_blueprint.md` và `backend-microservice-testbed-blueprint-v2.md` khác nhau thế nào?
   <details><summary>Đáp án</summary>Bản có dấu gạch dưới là blueprint testbed v1 (trước refactor), chỉ còn giá trị lịch sử; bản <code>-v2</code> là blueprint canonical hiện hành.</details>

4. Vì sao code + kết quả test đứng trên cả ADR-006 trong thứ tự tin cậy?
   <details><summary>Đáp án</summary>ADR nói hệ thống <i>nên</i> thế nào; code và test cho biết hệ thống <i>đang</i> thế nào. Khi mô tả hành vi thực tế (tên span, giá trị mặc định, cổng…) thì code là sự thật; nếu code trái với quyết định trong ADR thì đó là lỗi cần sửa, không phải lý do để tin tài liệu.</details>
