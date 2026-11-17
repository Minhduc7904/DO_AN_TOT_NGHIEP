# Thiết kế phần AI/RCA và cách chứng minh AI có ích

> **File này giải thích gì:** RCA engine (hệ thống phát hiện sự cố và xếp hạng nguyên nhân của đồ án) hoạt động từng bước ra sao; phần nào thật sự là học máy; so với những baseline nào; chấm điểm thế nào; sáu câu hỏi nghiên cứu RQ1–RQ6; cách trả lời góp ý giữa kỳ "truy vết thủ công vẫn tìm ra, vậy AI giúp gì?" bằng bộ bằng chứng E1–E8 của ADR-007; phạm vi và lịch của phần AI. Đây là phần Bách làm chính và phải bảo vệ trước hội đồng.
>
> **Nguồn gốc (canonical):**
>
> - [ADR-006](../adr/adr-006-trim-project-scope-v1.md) (vai trò "hỗ trợ", phần học máy, `base-manual-auto` mới, case MVP)
> - [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) (bộ bằng chứng E1–E8, baseline SimpleRCA và BARO, đăng ký trước, cách báo cáo), đề xuất gốc kèm số liệu nghiên cứu: [realism-and-ai-contribution-strategy-v1](../direction/realism-and-ai-contribution-strategy-v1.md); danh mục tài liệu tham khảo: [literature-matrix-v1](../plan/literature-matrix-v1.md); giải thích dễ hiểu: [`research-defense/`](research-defense/README.md)
> - [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) (quyết định cũ, một phần đã bị ADR-006 thay)
> - [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md) (mục 1, 5–20)
> - [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) (mục 4, 5, 9–18)
> - [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md) (mục 9.1, 12)
> - [complex-case-catalogue-and-rca-result-v0](../architecture/complex-case-catalogue-and-rca-result-v0.md) (mục 1–3, mục 5 schema kết quả)
> - [research-questions-and-metrics-v2](../direction/research-questions-and-metrics-v2.md), [project-scope-v2](../direction/project-scope-v2.md)
> - [plan-v0.4](../plan/plan-v0.4-24-weeks.md) (mục 0, 4, 7, 8, 9 và tuần 13–21; thay [plan-v0.3](../plan/plan-v0.3-24-weeks.md))
> - Code: [`tracing-smoke.mjs`](../../../lms/test/observability/tracing-smoke.mjs) (C6), [`aiops-platform/README.md`](../../../aiops-platform/README.md) (hiện trạng thư mục); `aiops-platform/training/` và [telemetry-data-dictionary-v2](../architecture/telemetry-data-dictionary-v2.md) trên nhánh PR #77/#79 (chưa merge)
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên. Lưu ý: evaluation protocol, analysis blueprint, research questions có đoạn chi tiết viết trước ADR-007 (ví dụ RQ4 "bỏ 50% trace"); gặp chỗ mâu thuẫn thì theo ADR-007.
>
> Trạng thái tại: 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge)

Hai điều cần biết trước khi đọc:

- **Chưa có dòng code nào của RCA engine** (feature, detector, incident, graph, xếp hạng). Tuần 13 mới có **đầu vào** của nó: export telemetry của một run ra file Parquet và kiểm chất lượng (`aiops-platform/training/`, PR #77 và #79, chưa merge); cùng với k6 mức 1 (`load/`, PR #76) và công cụ gây lỗi (`faults/`, PR #75). `evaluation/` chưa tạo. Mọi thuật toán, ngưỡng, trọng số dưới đây là **đề xuất** trong tài liệu thiết kế, chưa kiểm chứng trên dữ liệu.
- **Một số đoạn trong tài liệu gốc còn giọng cũ của ADR-002** ("AI là bên truy vết chính, không cần người", "phần chính là huấn luyện mô hình"). ADR-006 đã thay các ý đó; ghi chú này viết theo ADR-006.

Thuật ngữ thực nghiệm (run, split, ground truth, window…) đã giải thích ở [thuật ngữ thực nghiệm](07-experiment-concepts.md). Các case và workload ở [case và workload](09-cases-and-workload.md).

---

## 1. Bức tranh chung: thám tử, hồ sơ vụ án và quy chế thi

### 1.1. Ba vai

| Câu hỏi | Ví như | Tài liệu |
| --- | --- | --- |
| AI xử lý dấu vết thế nào để chỉ ra nghi phạm? | **Thám tử** điều tra | blueprint-v1 |
| Dấu vết và đáp án được ghi theo mẫu nào? | **Mẫu hồ sơ vụ án** | telemetry-and-ground-truth-schema-v1 |
| Chấm thám tử thế nào cho công bằng? | **Quy chế thi** | evaluation-protocol-v1 |

```text
Chương trình chạy thí nghiệm (runner) chạy 1 run
   ├── RunGroundTruth (đáp án, cất riêng)
   └── Telemetry artifact + phiếu chất lượng (dấu vết)
                 │
                 ▼
RCA engine: feature → bất thường → incident → graph → xếp hạng → bằng chứng
                 │
                 ▼
Giám khảo: lấy kết quả của AI, mở đáp án, tính điểm
```

Điểm mấu chốt: **AI chỉ được thấy dấu vết. Đáp án chỉ được mở ở bước chấm, sau khi AI đã nộp bài.**

### 1.2. Vai trò "hỗ trợ" theo ADR-006

Tên đề tài đã đăng ký là "phát hiện bất thường và **hỗ trợ** phân tích nguyên nhân sự cố". ADR-002 từng đổi thành "AI là bên truy vết chính, kết luận không cần người". ADR-006 kéo về đúng tên đề tài:

| Điểm | ADR-002 (cũ) | ADR-006 (hiện hành) |
| --- | --- | --- |
| Vai trò | AI truy vết chính, kết luận không cần người | AI **tự động** phát hiện incident và đưa ra **danh sách nghi phạm kèm bằng chứng** để **hỗ trợ** người vận hành |
| Học máy | "Phần chính là huấn luyện mô hình" | Detector không giám sát fit trên run khỏe; ngưỡng và trọng số hiệu chỉnh trên validation |
| Ranker học có nhãn | Phần chính | Stretch |
| Chứng minh giá trị | "Người không tìm ra, AI tìm ra" | So **chi phí và độ ổn định** của chẩn đoán |
| MCP/agent LLM | Thứ yếu | Ngoài phạm vi |

Hình dung: RCA engine không phải "thám tử thay cảnh sát", mà là **trợ lý trực ca**: tự phát hiện có chuyện, lập sẵn danh sách nghi phạm theo thứ tự, kèm vật chứng chỉ đúng chỗ. Người vận hành vẫn là người kết luận cuối cùng. Kết quả gọi là **xếp hạng ứng viên nguyên nhân**, không tuyên bố "đã chứng minh nhân quả", vì telemetry chỉ là dữ liệu quan sát.

---

## 2. Dây chuyền xử lý từng bước

```text
① nhận telemetry + kiểm chất lượng
② chia window 60s, bước 15s
③ tính feature (theo service và theo cạnh)
④ chấm điểm bất thường → gộp điểm metric / trace / log
⑤ mở incident  (NORMAL → SUSPECTED → OPEN → RECOVERING → RESOLVED)
⑥ dựng graph phụ thuộc động (cạnh đồng bộ, bất đồng bộ, xác thực)
⑦ xếp hạng nghi phạm  R(s) = 0.30·A + 0.20·T + 0.20·P + 0.20·E + 0.10·V
⑧ chọn bằng chứng + timeline
⑨ ghi RcaIncidentResult  (ranked | insufficient_evidence)
⑩ (offline) chấm với RunGroundTruth
```

RCA engine là **một chương trình Python** (gom nhiều module trong một khối, chạy bằng dòng lệnh), chạy **ngoài luồng**: đọc telemetry sau, không nằm trên đường xử lý request của LMS.

### 2.1. Bước ①: nhận dữ liệu và kiểm chất lượng

**Ý chính:** trước khi phân tích, mỗi run có một phiếu kiểm tra (`TelemetryQualityReport`). Run không đạt bị đánh `invalid` hoặc `partial`, không lẳng lặng vào kết quả chính.

Phiếu kiểm tra: timestamp đúng UTC; `service.name` thuộc 11 tên chuẩn; span thiếu cha, cặp PRODUCER/CONSUMER không nối được; metric bị hở; log `dependency.failure` có `trace_id`/`span_id`; dữ liệu phủ đủ các pha. **Đã cài ở tuần 13** (PR #79) phần lớn các mục này, trả `pass`/`partial`/`fail`; phần "phủ đủ các pha" chờ fault manifest ở tuần 14–15. Chi tiết: [`05-observability.md`](05-observability.md) mục 10.6.

Bốn đặc điểm của testbed v2 mà engine phải chịu được:

- **Độ trễ thu thập khác nhau** (log khoảng 2 giây, trace 2,5 giây, counter 4–10 giây): ghép ba nguồn phải chừa độ trễ, không thì sinh "thiếu dữ liệu" giả.
- **Tempo dễ bị kill vì hết bộ nhớ** (giới hạn 512 MiB): truy vấn tuần tự, giới hạn số trace.
- **Trace gây nhiễu** (`scheduler-worker` thăm dò DB mỗi giây, trace `/ready`): luật lọc có version (`noise_filter_version`), áp dụng **như nhau** cho engine lẫn baseline thủ công.
- **Tín hiệu chưa có:** pool kết nối PostgreSQL, tuổi message trong queue, độ trễ outbox, log khi worker xử lý command, nối trace `scheduler` → `scheduler-worker`. Engine không giả định chúng tồn tại và ghi việc thiếu vào kết quả.

**Bảy kiểu "không có số"** phải phân biệt, cấm điền 0 máy móc: thật sự bằng 0; không có traffic; không áp dụng (ví dụ feature HTTP của worker); tín hiệu testbed chưa đo (ví dụ log của worker: `not_instrumented`); không thu được metric hoặc service im lặng; trace bị mất; nguồn log hỏng. Riêng **service im lặng** có cờ `telemetry_silent`: đây là bằng chứng chính về `identity` ở C6 (container bị pause không phát gì). Tuần 13 phát hiện: runtime ngừng mà Prometheus **vẫn có mẫu** của nó thêm ~5 phút với giá trị đứng yên, nên cờ được tính từ việc bộ đếm CPU **không tăng** hơn 30 giây (đã cài ở PR #79, thử với `scheduler`). Dùng cờ này làm **feature xếp hạng** vẫn là đề xuất chưa kiểm chứng.

### 2.2. Bước ②: chia window

**Ý chính:** cắt thời gian thành ô 60 giây, trượt mỗi 15 giây (giá trị khởi điểm, chốt sau pilot). Ô ghép tín hiệu phải ít nhất 15 giây vì độ trễ thu thập. Metric, span, log cùng xếp vào một ô để so được với nhau; span CONSUMER xếp theo thời điểm bắt đầu của chính nó. Case có độ trễ nhân quả dài (C4 nhiều phút, C6 tới thời hạn sống của token dịch vụ, gọi tắt TTL) cần thêm một **cửa sổ gộp incident** dài hơn ô feature; giá trị chưa có.

### 2.3. Bước ③: feature, tức "con số tóm tắt" của mỗi ô

**Ý chính:** mỗi ô sinh hai bảng: một dòng cho mỗi service (`ServiceWindowFeature`) và một dòng cho mỗi cạnh bên gọi → bên được gọi (`EdgeWindowFeature`).

| Nguồn | Ví dụ feature | Ghi chú |
| --- | --- | --- |
| Metric của service | tốc độ request, tỷ lệ lỗi (tách 4xx/5xx), độ trễ p50/p95/p99, CPU, RSS, tỷ số so với mức bình thường | Bỏ route `/health`, `/ready` |
| Metric của dependency | `dep_error_rate`, `dep_timeout_rate`, `dep_latency_p95` theo từng `dependency_identity` | Hai feature đề xuất: độ trễ tăng đều trên mọi `operation_name` (nhắm C2), số service cùng lỗi trên một loại cạnh (nhắm C6, C7) |
| Trace | tỷ lệ span lỗi, `span_duration_p95`, `consumer_start_delay_p95`, `span_missing_downstream` | `consumer_start_delay_p95` = CONSUMER bắt đầu muộn bao lâu so với PRODUCER cùng trace, thay cho "tuổi message" chưa đo được. `span_missing_downstream` (trace lỗi mà không có span của service đích, dấu hiệu C6) là đề xuất chưa kiểm chứng |
| Queue | `queue_ready`, `queue_unacked`, `queue_consumers`, độ dốc | Mô tả **worker tiêu thụ**, không phải nguyên nhân |
| Log | số log lỗi, số `dependency.failure` theo cạnh, mẫu log mới | Log không đưa nguyên văn vào model; số trong log thay bằng `<*>` để gom thành mẫu câu. Worker gần như không có log nghiệp vụ nên log là nguồn yếu ở phía worker |

Ví dụ C2 (chèn trễ trước `course-postgres`): trong các ô có lỗi, `lms_dependency_duration_seconds` của cạnh `course-postgres` tăng đều trên mọi truy vấn; độ trễ p95 của `course` tăng; cạnh `gateway-course` chậm theo; không có span lỗi. Số đo tuần 13 (PR #75): trễ 200 ms ở proxy làm trung vị `course-postgres` từ 0,0025 s lên khoảng 0,175 s.

Hai bẫy khi tính feature (phát hiện tuần 13, [`05-observability.md`](05-observability.md) mục 10): (1) runtime ngừng thì series của nó "đứng yên" ~5 phút chứ không biến mất, nên feature phải dựa vào **mức tăng**; (2) bộ đếm lỗi xuất hiện lần đầu giữa cửa sổ là series mới, `increase()` của Prometheus bỏ mẫu đầu, nên feature phải tính từ giá trị thô và coi giá trị trước đó là 0.

### 2.4. Bước ④: chấm điểm bất thường

**Ý chính:** câu hỏi ở bước này là "ô này của service X có lạ không?". Có nhiều cách, từ đơn giản tới phức tạp:

| Ký hiệu | Cách | Ý tưởng | Tầng |
| --- | --- | --- | --- |
| A | Ngưỡng cố định | `tỷ lệ lỗi > ngưỡng` thì báo. Dễ hiểu, là mốc tối thiểu | MVP |
| B | Z-score | Lệch bao nhiêu "độ lệch chuẩn" so với trung bình | MVP (phụ) |
| C | **Robust z-score** | Như B nhưng dùng trung vị và MAD (độ lệch trung vị). Baseline thống kê được ưu tiên | MVP |
| D | **Isolation Forest** | Mô hình học máy nhìn nhiều feature cùng lúc | MVP |
| E | Change-point | Tìm **thời điểm** dữ liệu đổi trạng thái, để ước lượng lúc lỗi bắt đầu | Target |
| | Học sâu (autoencoder, LSTM) | Chỉ xét khi các cách trên có điểm yếu rõ | Stretch |

**Vì sao C tốt hơn B.** Độ trễ bình thường `100, 102, 98, 101` nhưng có một lần lạc `5000`. Trung bình bị kéo lên khoảng 1080, nên mọi giá trị khác trông "bình thường". Trung vị vẫn khoảng 101.

```text
robust_z = 0.6745 × (x − median) / MAD
```

**Isolation Forest hiểu đơn giản.** Mô hình cắt dữ liệu ngẫu nhiên nhiều lần. Điểm bình thường nằm giữa đám đông, cần rất nhiều nhát mới tách riêng ra được; điểm lạ nằm lẻ loi, vài nhát là tách xong. Càng ít nhát càng bất thường. Ưu điểm: bắt được kiểu "độ trễ hơi cao + CPU hơi cao + lỗi cạnh hơi nhiều" mà từng ngưỡng riêng lẻ không bắt được. Đầu vào là vector feature của một service trong một ô (độ trễ, lỗi, CPU, RSS, lỗi/độ trễ dependency, span lỗi, queue, log lỗi). Worker không có feature HTTP nên dùng vector con hoặc detector riêng, chọn sau pilot. Mô hình lưu kèm danh sách feature, bộ chuẩn hóa, tham số, các run dùng để fit, commit code.

**Gộp ba nguồn.**

```text
điểm_service = w_m × điểm_metric + w_t × điểm_trace + w_l × điểm_log      (w_m + w_t + w_l = 1)
```

Config mẫu ghi 0.4 / 0.4 / 0.2 (minh họa, chưa tune); baseline đơn giản là chia đều. Thiếu nguồn nào thì dùng phương án dự phòng đã định trước; với worker, thiếu log là chuyện thường chứ không phải ngoại lệ. Lưu cả ba điểm thành phần để giải thích.

### 2.5. Bước ⑤: mở incident

**Ý chính:** một ô điểm cao chưa đủ để báo động. Incident có vòng đời cố định:

```text
NORMAL → SUSPECTED (nghi) → OPEN (mở) → RECOVERING (đang hồi) → RESOLVED (xong)
```

- **Mở khi:** điểm gộp vượt ngưỡng **ít nhất 3 bước liên tiếp** (3 × 15 giây), hoặc nhiều tín hiệu liên quan cùng bất thường. Config mẫu: `persistence_steps: 3`, `merge_gap_seconds: 60`, `recovery_steps: 3` (minh họa).
- **Gộp:** bất thường gần nhau về thời gian, cùng nhánh graph hoặc cùng luồng nghiệp vụ thì thành **một** incident. C6 làm lỗi ở nhiều nơi cùng lúc (gateway và các worker khi token của chúng hết hạn) nên phải là một incident có nhiều `affected_services`, không phải nhiều incident.
- **Lỗi lộ muộn:** C6 lan rộng sau 70–74 giây (TTL 60), C4 cách nguyên nhân nhiều phút. Khoảng gộp phải cho phép khoảng cách này mà không gộp nhầm hai sự cố độc lập; giá trị chốt sau pilot.
- **`estimated_start_time`:** engine tự ước lượng lúc lỗi bắt đầu, từ ô bất thường đầu tiên, từ change-point (Target), hoặc từ bằng chứng sớm nhất đủ tin cậy.
- Khi incident sang `OPEN`, engine tự chạy bước xếp hạng; trace nhiễu đã bị lọc trước nên không tự mở incident.

### 2.6. Bước ⑥: graph phụ thuộc động

**Ý chính:** với mỗi run/ô, engine dựng graph **từ span thật**: node là service, cạnh là "ai gọi ai". Gọi là "động" vì mỗi ô có thể khác nhau tùy luồng nào đang chạy. Bản đồ thiết kế (cạnh `e01–e29` trong service catalogue v2) chỉ dùng để **kiểm tra** graph: phát hiện cạnh lạ, cạnh đảo chiều, cạnh mất do thiếu trace.

| Loại cạnh | Lấy từ đâu | Ví dụ | Tầng |
| --- | --- | --- | --- |
| Đồng bộ (`sync`) | Span CLIENT/SERVER cùng trace, metric `lms_dependency_*` dạng `<bên gọi>-<bên nhận>` | `gateway → course`, `course → ai`, `ai-worker → course` | MVP |
| Bất đồng bộ (`async`) | Cặp span PRODUCER → CONSUMER cùng `trace_id` (command qua RabbitMQ) | `ai → ai-worker`, `media → media-worker` | MVP |
| Xác thực (`auth`) | Cạnh thiết kế **luôn tồn tại**, vì token chỉ làm mới khoảng 5 phút một lần nên đa số ô không có lời gọi nào | `<service>-identity-token`, `<service>-identity-jwks` → `identity` | MVP |
| Tới hạ tầng (`dependency`) | Span CLIENT và metric tới PostgreSQL, MinIO, SMTP, LLM provider | `course-postgres`, `media-minio`, `ai-llm-provider` | MVP, chỉ là bằng chứng |
| Dùng chung (`shared-resource`) | Topology thiết kế: hai service cùng dùng một broker hay một instance PostgreSQL | Cần cho C1 | Target |

Ba điểm riêng của graph v2:

- **Có vòng:** `course → ai` (HTTP) và `ai-worker → course` (HTTP) tạo vòng `course → ai → course`. Thuật toán không được giả định graph không có vòng, phải giới hạn độ dài đường đi và không đếm một triệu chứng hai lần.
- **Cạnh `scheduler → scheduler-worker` không có trong trace** (hai bên chỉ gặp nhau qua bảng job trong `scheduler_db`). Graph thêm nó như cạnh thiết kế "bàn giao qua DB". Đây là chỗ C4 bị đứt chuỗi trace.
- **Hạ tầng không bao giờ là nghi phạm.** Tín hiệu gắn với hạ tầng được **quy về service chủ sở hữu**:

| Tín hiệu ở | Quy về ứng viên |
| --- | --- |
| `<service>-postgres`, `<service>-rabbitmq` | `<service>` |
| `media-minio` | `media` |
| `notification-smtp` | `notification-worker` |
| `ai-llm-provider` | `ai` (process thật sự gọi provider là `ai-worker`) |
| Cạnh HTTP `<bên gọi>-<bên nhận>` | `<bên nhận>` |
| `<bên gọi>-identity-token`, `<bên gọi>-identity-jwks` | `identity` |

Bảng này là đề xuất chờ xác nhận. Trọng số cạnh ở MVP chỉ dựa trên số lời gọi đã chuẩn hóa; bản Target cộng thêm mức tăng độ trễ và lỗi của cạnh.

### 2.7. Bước ⑦: xếp hạng nghi phạm, phần quan trọng nhất

**Vì sao không chọn "service bất thường nhất".** Người hét to nhất ở hiện trường chưa chắc là thủ phạm. Ở C6, `gateway` lỗi 504 trên mọi route, nhưng `gateway` thậm chí không nằm trong danh sách ứng viên. Trong 10 ứng viên còn lại, `course` và `media` đột ngột mất traffic (request không tới), còn `identity` thì **im lặng** nên không có điểm bất thường nào để so. Một cách xếp "ai lạ nhất đứng đầu" rất dễ chọn sai (nhận xét của người viết, chưa kiểm chứng). Cách "ai lạ sớm nhất" cũng sai khi nguyên nhân không có thời điểm bắt đầu riêng rõ ràng.

**Năm thành phần điểm cho mỗi ứng viên `s`:**

| Ký hiệu | Tên | Hỏi gì | C6: `identity` | C2: `course` |
| --- | --- | --- | --- | --- |
| **A(s)** | Mức bất thường | s lạ tới đâu? | Khó đo: im lặng, không có điểm | Cao: độ trễ tăng trên mọi route |
| **T(s)** | Đi trước về thời gian | s có dấu hiệu **sớm hơn** triệu chứng không? Với service im lặng, lúc bắt đầu im lặng là mốc | Cao: im lặng từ lúc pause, trước khi lỗi lan rộng hơn một phút | Cao: `course-postgres` chậm trước `gateway-course` |
| **P(s)** | Khớp hướng lan truyền | Nếu s là thủ phạm thì triệu chứng có lan **ngược lên** đúng hướng không? | Cao: nhiều service cùng lỗi trên cạnh `*-identity-token`, sau một khoảng yên lặng | Cao: `gateway` gọi `course` và chậm theo |
| **E(s)** | Cạnh hỏng thuộc về s | Cạnh đi ra của s, hoặc hạ tầng s sở hữu, có chậm/lỗi không? | Cao: `gateway-identity-token` quy về `identity` | Rất cao: `course-postgres` thuộc `course` |
| **V(s)** | Độ mạnh bằng chứng | Metric, span, log ủng hộ s nhiều đến đâu? Bị chiết khấu khi telemetry của s thiếu | Trung bình: bằng chứng nằm ở phía bên gọi | Cao |

Hai cột ví dụ là suy luận để hiểu công thức, không phải kết quả đo.

**Công thức gộp ("Hướng 1", phương án MVP):**

```text
R(s) = 0.30·A(s) + 0.20·T(s) + 0.20·P(s) + 0.20·E(s) + 0.10·V(s)
```

Các trọng số kế thừa từ bản thiết kế trước refactor, **chưa kiểm chứng trên topology v2**. Chỉ được hiệu chỉnh trên validation hoặc đánh giá bằng phân tích độ nhạy (thử thay trọng số xem thứ hạng đổi bao nhiêu); không sửa sau khi xem kết quả test.

**Lan truyền theo từng loại cạnh** (đề xuất, chưa kiểm chứng): mỗi loại cạnh có cách hiểu riêng, không áp nguyên công thức đồng bộ.

- **Đồng bộ:** lỗi ở bên được gọi lan ngược lên bên gọi; `P(s)` cộng dồn theo các service bị ảnh hưởng phía trên, có tính "s xuất hiện trước hoặc cùng lúc".
- **Bất đồng bộ:** triệu chứng nằm ở **queue của worker tiêu thụ** (CONSUMER bắt đầu muộn, backlog tăng), không ở bên gửi; nếu dependency riêng của worker vẫn bình thường mà backlog vẫn tăng thì nguyên nhân ở chỗ khác.
- **Xác thực:** chấp nhận độ trễ tới khoảng TTL token; bằng chứng chính là **độ rộng** (nhiều service cùng lỗi một loại cạnh); `identity` được cộng điểm khi nó im lặng hoặc khi `*-identity-jwks` phải tải lại khóa.
- **Dùng chung** (Target): chỉ cộng khi không có đường nào khác giải thích được triệu chứng.

**Tính tất định** (cùng đầu vào thì cùng kết quả): khi bằng điểm, phá hòa theo thứ tự cố định `identity < course < media < media-worker < notification < notification-worker < scheduler < scheduler-worker < ai < ai-worker`. Thứ tự này chỉ để kết quả lặp lại được, không có nghĩa service nào dễ là thủ phạm hơn.

### 2.8. Bước ⑧: bằng chứng

**Ý chính:** mỗi nghi phạm phải kèm bằng chứng máy đọc được, **do engine chọn và nén sẵn**, trả lời: tín hiệu nào lạ, bình thường là bao nhiêu và lúc sự cố là bao nhiêu, bắt đầu khi nào, span/log/cạnh nào liên quan, bằng chứng ủng hộ hay phản bác.

- Mỗi bằng chứng tham chiếu lại được dữ liệu gốc: `service.name` + `trace_id`/`span_id` (với trace, log), hoặc tên metric + nhãn + khoảng thời gian (với metric).
- Không cộng thô số lượng bằng chứng, vì log có hàng nghìn dòng sẽ "đè" metric; phải chuẩn hóa theo nguồn và bỏ trùng.
- Mọi chuỗi lấy từ log/trace là **dữ liệu không tin cậy**: engine không coi chúng là chỉ dẫn và giới hạn độ dài phần tóm tắt.

### 2.9. Bước ⑨: kết quả `RcaIncidentResult`

**Ý chính:** mỗi incident cho ra một file JSON bất biến. Schema nằm ở một chỗ duy nhất: catalogue case mục 5.2.

```text
RcaIncidentResult
- rca_result_schema_version   "0"
- incident_id, run_id (null khi giám sát thật), created_at, window {start, end}
- telemetry_quality           tham chiếu phiếu chất lượng (thiếu tín hiệu gì)
- verdict                     "ranked" | "insufficient_evidence"
- model {name, version, graph_ref, config_ref}
- symptom {service, signal, first_seen}
- ranking[]                   rỗng khi insufficient_evidence
    - rank, candidate {service, component, dependency_identity}, score
    - mechanism               loại lỗi dự đoán (dependency_latency, ...)
    - propagation_path[]      chuỗi service từ nguồn tới triệu chứng
    - evidence[] {kind, service, trace_id/span_id hoặc metric/labels/window, summary}
```

Một phần tử `ranking[]` minh họa cho C6 (giá trị trong `<...>` là chỗ giữ chỗ):

```json
{
  "rank": 1,
  "candidate": { "service": "identity", "component": "identity", "dependency_identity": "gateway-identity-token" },
  "score": "<score>",
  "mechanism": "dependency_unavailable",
  "propagation_path": ["identity", "gateway"],
  "evidence": [
    { "kind": "trace", "service": "gateway", "trace_id": "<trace_id>", "span_id": "<span_id>",
      "summary": "CLIENT gateway-identity-token lỗi, trace không có span của service đích" },
    { "kind": "metric", "service": "gateway", "metric": "lms_dependency_error_count_total",
      "labels": { "dependency_identity": "gateway-identity-token" },
      "window": { "start": "<utc>", "end": "<utc>" }, "summary": "tăng sau khoảng yên lặng" }
  ]
}
```

**`insufficient_evidence` (không đủ chứng cứ).** Engine phải tự biết khi nào **không** kết luận: trả `verdict = "insufficient_evidence"` và `ranking` rỗng khi thiếu tín hiệu cần cho cơ chế đang nghi; khi không ứng viên nào vượt ngưỡng điểm hoặc hạng 1 và hạng 2 sát nhau quá; khi chỉ thấy triệu chứng ở `gateway` mà không có bằng chứng ở đâu khác. Ngưỡng chưa có, chốt trên validation. Để engine không "né" case khó bằng cách từ chối, đánh giá báo riêng tỷ lệ `insufficient_evidence` và tính nó là **trượt** ở điểm toàn trình (mục 5.2).

Nơi lưu đề xuất: `aiops-platform/training/results/<run_id hoặc ngày>/<incident_id>.json` kèm `manifest.json`; thư mục chưa tồn tại. Phần "nơi lưu cho MCP đọc" không còn là yêu cầu vì MCP đã ngoài phạm vi.

---

## 3. Phần nào là "học máy" thật, phần nào không

**Ý chính:** theo ADR-006 mục 2, phần học máy là **detector không giám sát** (học "bình thường" mà không cần nhãn lỗi) fit trên run khỏe, cộng với **hiệu chỉnh** ngưỡng và trọng số trên validation. Không gọi đây là "huấn luyện mô hình có giám sát".

| Thành phần | Học hoặc chỉnh từ đâu | Bản chất |
| --- | --- | --- |
| Bộ chuẩn hóa, trung vị/MAD theo service | Healthy run của tập train | Thống kê |
| Isolation Forest | Healthy run của tập train | **Học máy không giám sát** |
| Ngưỡng detector, trọng số gộp M/T/L, số bước kéo dài | Validation | Hiệu chỉnh tham số |
| Trọng số `w1..w5` của `R(s)`, ngưỡng `insufficient_evidence` | Validation | Hiệu chỉnh tham số |
| Graph phụ thuộc | Dựng lại từ trace của từng run | Suy ra từ dữ liệu, không học |
| Ranker học có nhãn ("Hướng 2") | Fault run có nhãn, tách riêng | **Học máy có giám sát**: Stretch |

**"Hướng 2" là gì.** Mỗi cặp (incident, ứng viên) thành một dòng gồm năm điểm thành phần, đặc trưng đồ thị (khoảng cách tới triệu chứng theo từng loại cạnh, số service triệu chứng ở phía dưới…) và nhãn "có trùng đáp án không"; một mô hình như hồi quy logistic hay gradient boosting học cách xếp hạng. Loại mô hình chưa chọn.

**Vì sao không huấn luyện trên fault run:**

1. **Quy chế cấm.** Evaluation protocol mục 5.3 cấm dùng lại fault run của validation/test làm dữ liệu huấn luyện. Muốn học có nhãn phải có một tập fault run riêng, tức một "phần mở rộng quy chế" riêng.
2. **Quá ít dữ liệu.** Cả campaign chỉ có 20 fault run trên 4 case với 4 đáp án khác nhau. Mô hình học từ chừng ấy dễ **học thuộc** kiểu "thấy cạnh token lỗi thì đáp `identity`" chứ không học được quy luật chung.
3. **Không đo được khả năng tổng quát.** Quy chế không giữ lại case nào "chưa từng thấy" cho test (mục 4.4); muốn chứng minh ranker học được thì cần kiểu "bỏ một case ra để test", hiện chỉ là đề xuất.
4. **Hướng 1 dễ giải thích hơn**: mỗi thứ hạng tách được thành năm điểm thành phần, hợp với vai trò "hỗ trợ" người vận hành.

**Điểm mạnh của cách không giám sát**: detector học "bình thường" chứ không học "lỗi X trông thế nào", nên về nguyên tắc vẫn báo được lỗi kiểu mới chưa từng thấy.

Cách nói trước hội đồng gợi ý: "Phát hiện bất thường bằng học máy không giám sát, học từ dữ liệu vận hành khỏe; xếp hạng nguyên nhân bằng mô hình chấm điểm có giải thích, kết hợp đồ thị phụ thuộc và thứ tự thời gian, tham số hiệu chỉnh trên tập validation tách biệt."

**Lưu ý của người viết:** tập validation chỉ có 4 fault run. Chỉnh 5 trọng số trên 4 run dễ "khớp" đúng 4 run đó. Blueprint cho phép thay việc tune bằng phân tích độ nhạy; nên báo cả hai.

---

## 4. Các baseline để so sánh

**Ý chính:** "baseline" là phương pháp đơn giản dùng làm mốc. Phương pháp đề xuất chỉ có giá trị khi hơn được các mốc này, hoặc phải nói thật nếu không hơn.

| Baseline | Làm gì | Dùng cho | Điểm yếu dự kiến |
| --- | --- | --- | --- |
| Ngưỡng cố định (Baseline A) | Báo khi tỷ lệ lỗi, độ trễ, CPU, độ sâu queue vượt ngưỡng cấu hình sẵn | Phát hiện; đối chứng phát hiện của RQ6 (mô phỏng cách vận hành thủ công) | Ngưỡng thấp thì báo nhầm khi tải cao; ngưỡng cao thì báo muộn |
| Max anomaly | Ai có điểm bất thường cao nhất đứng đầu | RQ2 | Chọn triệu chứng "kêu to" thay vì nguyên nhân |
| Earliest anomaly | Ai bất thường sớm nhất đứng đầu | RQ3 | Sai khi nguyên nhân im lặng hoặc không có lúc bắt đầu riêng |
| Graph-aware simple | Điểm bất thường + quan hệ trên graph, **chỉ cạnh đồng bộ** | RQ2 | Không thấy cạnh bất đồng bộ và xác thực |
| `base-manual-auto` | Mô phỏng cách kỹ sư vận hành tra thủ công (xem dưới) | RQ6 | Là mô phỏng, không phải người thật |
| **SimpleRCA** (ADR-007, tuần 17) | Đếm cảnh báo theo service: metric vượt 3-sigma/P95, trace chậm gấp ≥ 3 lần mức thường, log có từ khóa lỗi; service nhiều cảnh báo nhất đứng đầu (Fang et al. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711) | E2, E3 | Không có graph, không có thời gian; nhưng nghiên cứu cho thấy nó thường ngang hoặc hơn SOTA |
| **BARO** (ADR-007, tuần 17) | Tìm thời điểm dữ liệu đổi trạng thái (Bayesian online change point) rồi xếp hạng service bằng kiểm định phi tham số (trung vị/IQR) (Pham et al., FSE 2024, `[L-BARO]`, https://arxiv.org/abs/2405.09330; mã nguồn trong RCAEval, giấy phép MIT) | E2, E6 | Chỉ dùng metric |
| Xếp hạng cố định, xếp hạng ngẫu nhiên | Không nhìn dữ liệu | Mốc tham chiếu, **luôn báo kèm** (ADR-006, ADR-007) | Cho biết điểm Top-K cao có thật sự cần telemetry không |
| **Đề xuất (Hướng 1)** | `R(s)` với A, T, P, E, V | Mọi RQ, E1–E8 | Trọng số chưa kiểm chứng |

SimpleRCA và BARO là **baseline đã công bố**: người ngoài đã dùng và kiểm, nhóm không tự đặt ra. Có chúng trong bảng chính thì kết quả khó bị chê "so với đối thủ yếu do mình dựng". Plan v0.4 mục 9 cấm cắt cả hai khi nén lịch: phải giữ ít nhất một.

### 4.1. `base-manual-auto`: định nghĩa cũ và mới

**Định nghĩa cũ** (ADR-002, blueprint 12.6 bản trước): "ngưỡng + tìm trace lỗi/chậm nhất **theo đường request của triệu chứng**", tức baseline **không được nhìn ra ngoài đường request**.

Vì sao bị coi là "tự chứng minh": các case được **chọn đúng vì** nguyên nhân nằm ngoài đường request. So với một đối thủ bị cấm nhìn đúng chỗ đó thì thắng là chắc, giống thi chạy mà buộc chân đối thủ. Hội đồng dễ bác bỏ. Thêm nữa, trace của testbed v2 đã **nối xuyên RabbitMQ**, nên ở C3–C6 span lỗi của nguyên nhân nằm ngay trong trace; một kỹ sư thật sẽ thấy nó.

**Định nghĩa mới** (ADR-006 mục 3.2), mô phỏng cách kỹ sư vận hành làm thật:

```text
1. Từ triệu chứng, lấy các trace lỗi/chậm nhất trong cửa sổ incident.
2. Đi theo span CLIENT lỗi hoặc chậm SÂU NHẤT.
3. Nếu trace dẫn sang service khác qua cạnh bất đồng bộ hoặc xác thực → được đi theo.
4. Kết luận: service sở hữu span đó.
```

Minh họa với C6:

```text
GET /api/v1/...            [gateway, SERVER]  504
 └─ gateway-identity-token POST /internal/v1/auth/service-token  [gateway, CLIENT]  LỖI
    (không có span của course: request không tới service đích)
→ span CLIENT lỗi sâu nhất là cạnh xác thực → được đi theo sang identity
```

Nhiều khả năng baseline cũng tìm ra `identity` ở C6 (dự đoán của người viết, chưa kiểm chứng). Đó là điều bình thường và phải báo cáo.

Ràng buộc của quy chế: chạy trên **cùng run, cùng 10 ứng viên, cùng đáp án** như engine; chỉ dùng tín hiệu một người có (metric tốc độ/lỗi/độ trễ theo service, trace, log theo `trace_id`), không dùng mô hình đã học, graph model, điểm bất thường học từ run khỏe hay đáp án; xuất cùng schema `RcaIncidentResult`, xếp đủ 10 ứng viên; luật chi tiết chọn trên validation, có version, niêm phong trước test. Plan tuần 17 thêm: **đếm số trace/panel phải mở**.

**Các điểm luật còn mở (gợi ý của người viết):**

- **Quy về chủ sở hữu:** ở C3, span chậm sâu nhất là `ai-llm-provider POST chat/completions` do process `ai-worker` phát, nhưng đáp án là `ai`. Nếu baseline kết luận theo `service.name` của span (`ai-worker`) còn engine dùng bảng quy về chủ sở hữu (mục 2.6) thì engine thắng nhờ quy ước, không nhờ phân tích. Nên cho baseline dùng **cùng bảng quy đổi**, và báo thêm điểm theo chủ sở hữu (gộp `X` với `X-worker`) như quy chế đã đề xuất.
- **"Chậm" so với cái gì:** job AI luôn có trace dài vì gọi LLM. Nếu "chậm nhất" là độ dài tuyệt đối, baseline có thể bị trace AI bình thường đánh lừa ở C2, C4. Một luật công bằng nên so theo từng route; cần chốt trên validation.

---

## 5. Cách chấm điểm

### 5.1. Phát hiện: ghép incident với đáp án

Mỗi fault run hợp lệ có **một** đáp án với `fault_start`, `fault_end`.

- **Báo trước khi lỗi bắt đầu là báo nhầm** (`early_tolerance_seconds = 0`), kể cả khi incident đó còn mở lúc lỗi bắt đầu.
- **Được báo trễ một khoảng tính sẵn:** `late_tolerance = window + max(0, số_bước_kéo_dài − 1) × bước`. Với giá trị khởi điểm 60/15/3: 60 + 2 × 15 = **90 giây** (phép tính minh họa). Khoảng được chấp nhận là `[fault_start, fault_end + late_tolerance]`. Khoảng này **không** bù độ trễ lan truyền của case; độ trễ đó xử lý bằng cách cho fault chạy đủ lâu.
- **Nhiều incident:** incident sớm nhất trong khoảng chấp nhận là **đúng (TP)**; mọi incident khác là **báo nhầm (FP)**; không có incident nào thì là **bỏ sót (FN)**.

| Chỉ số | Công thức | Nghĩa |
| --- | --- | --- |
| Precision | TP / (TP + FP) | Trong các lần báo động, bao nhiêu phần đúng |
| Recall | TP / (TP + FN) | Trong các sự cố thật, bắt được bao nhiêu phần |
| F1 | 2·P·R / (P + R) | Cân bằng hai chỉ số trên |
| Detection Delay | `detected_at − fault_start` | Phát hiện sau bao lâu; chỉ tính cho TP |
| FPR | số healthy run test có ≥ 1 incident / tổng healthy run test | Tỷ lệ run khỏe bị báo động bậy |
| FP mỗi giờ khỏe | số incident báo nhầm / số giờ chạy khỏe | Mức "ồn" của cảnh báo |

Riêng **C6 báo Detection Delay tách riêng**, vì delay chứa luôn khoảng yên lặng (tối thiểu cỡ 70–74 giây với TTL 60), không do detector chậm. Mẫu số bằng 0 thì ghi `null`, không tự quy ước 0 hay 1.

### 5.2. Xếp hạng nguyên nhân

| Chỉ số | Nghĩa |
| --- | --- |
| Top-1 | Đáp án đứng hạng 1 |
| Top-3 | Đáp án nằm trong 3 hạng đầu |
| MRR | Trung bình của `1 / hạng của đáp án`: hạng 1 được 1 điểm, hạng 2 được 0,5, hạng 3 được 0,33… |
| Average Rank | Hạng trung bình của đáp án, dùng bổ sung |

**Hai cách lấy mẫu số**, đây là ý quan trọng:

- **Có điều kiện:** chỉ các run đã phát hiện incident **và** có xếp hạng.
- **Toàn trình (end-to-end):** **mọi** fault run hợp lệ; run không phát hiện được, không có xếp hạng, hoặc `insufficient_evidence` đều tính **trượt** (Top-1, Top-3 trượt, `1/hạng = 0`). Bắt buộc cho RQ1, RQ4 và so sánh với baseline thủ công.

Kèm `rca_coverage = số run có xếp hạng / số fault run hợp lệ`.

Theo ADR-007 mục 5: **Top-1 và MRR là chỉ số chính**, Top-3 báo kèm; luôn kèm hai mốc random và xếp hạng hằng; báo **theo từng case**; kèm **khoảng tin cậy 95% bằng bootstrap** (lấy mẫu lại các incident nhiều lần để thấy kết quả dao động bao nhiêu); so engine với từng baseline bằng **kiểm định ghép cặp McNemar exact** (chỉ đếm các incident mà hai bên cho kết quả khác nhau). Mẫu nhỏ nên không tuyên bố "có ý nghĩa thống kê" khi kiểm định không đạt.

Ví dụ giả định để hiểu công thức (không phải kết quả): C6 có 4 run test; đáp án đứng hạng 1, 2, (không đủ chứng cứ), 1.

| Chỉ số | Có điều kiện (mẫu 3) | Toàn trình (mẫu 4) |
| --- | --- | --- |
| Top-1 | 2/3 ≈ 67% | 2/4 = 50% |
| Top-3 | 3/3 = 100% | 3/4 = 75% |
| MRR | 2,5/3 ≈ 0,83 | 2,5/4 = 0,625 |
| `rca_coverage` | 3/4 = 75% | |

Chỉ chấm ở **mức service**: `root_cause_component` chỉ là chẩn đoán phụ. Danh sách ứng viên cố định gồm **10** service/worker (bỏ `gateway`, vì không fault nào có nguyên nhân ở `gateway`); mọi phương pháp phải xếp đủ 10, không được bỏ ứng viên vì thiếu dữ liệu của nó.

### 5.3. Rủi ro "Top-3 bão hòa"

**Ý chính:** khi số đáp án khác nhau quá ít, một cách xếp hạng **không nhìn dữ liệu** vẫn đạt Top-3 cao.

- Trước refactor (v1): F1–F5 chỉ có 3 đáp án khác nhau, nên xếp cố định ba service đó đạt Top-3 = 100%.
- Bảy case v2: 5 đáp án khác nhau, `identity` chiếm 3 case; xếp cố định tốt nhất đạt Top-3 ≈ 71%, Top-1 ≈ 43% (evaluation protocol mục 18.4).
- **Bốn case MVP** (phép tính của người viết, giả định số run test bằng nhau mỗi case): 4 đáp án khác nhau (`course`, `ai`, `media`, `identity`). Xếp cố định ba trong bốn service ở đầu đạt **Top-3 = 75%**, Top-1 = 25%, MRR ≈ 0,52. Xếp ngẫu nhiên trên 10 ứng viên: Top-1 = 10%, Top-3 = 30%, MRR ≈ 0,29.

Như vậy bộ case MVP **giảm** rủi ro ở Top-1 nhưng **không giảm** ở Top-3. Khi báo cáo phải: đọc Top-3 cùng Top-1, MRR và kết quả **từng case**; luôn đặt cạnh hai mốc xếp cố định và xếp ngẫu nhiên; ghi rõ số case `K` và số lần lặp `R`.

Lưu ý: bản đầu evaluation protocol mục 18.4 ghi xếp ngẫu nhiên Top-1 = 1/11, Top-3 = 3/11 (tính trên 11 service); với danh sách ứng viên 10 thì đúng là 1/10 và 3/10, đã sửa ở PR #74.

### 5.4. Thời gian chẩn đoán và số artifact

```text
T_engine = thời gian chạy bước RCA trên một incident (đo thật)
T_base   = thời gian chạy luật base-manual-auto trên incident
T_human  = từ lúc nhận mô tả triệu chứng tới lúc nộp đáp án (chỉ khi làm thử nghiệm người, Target)
```

- Mốc bắt đầu chung là lúc incident được khai báo (`detected_at`). Detection Delay và độ trễ thu thập báo riêng, không cộng ngầm.
- Run được phân tích lại offline nên `created_at` của kết quả **không** dùng làm thời gian chẩn đoán.
- `T_human` và `T_engine` khác bản chất (người đọc dashboard so với máy chạy cả dây chuyền xử lý): chỉ mô tả cạnh nhau, **không kết luận "nhanh hơn bao nhiêu lần"**.
- **Số artifact phải mở** (trace, panel, truy vấn log) của baseline thủ công là thước đo gần nhất cho công sức của người, khi chưa có thử nghiệm người thật.
- Không tạo một điểm tổng hợp gộp độ đúng và thời gian.

---

## 6. Sáu câu hỏi nghiên cứu RQ1–RQ6

| RQ | Hỏi gì | So sánh | Đo bằng |
| --- | --- | --- | --- |
| RQ1 | Thêm trace và log vào metric có giúp phát hiện và tìm nguyên nhân tốt hơn không? | `M` vs `M+T` vs `M+T+L` (M = metric, T = trace, L = log) | Precision/Recall/F1/FPR/Delay; Top-1/Top-3/MRR toàn trình |
| RQ2 | Graph phụ thuộc từ trace có giúp xếp hạng tốt hơn chỉ nhìn mức bất thường không? | Max anomaly vs graph-aware; cùng công thức có/không phần graph | Top-1/Top-3/MRR, Average Rank |
| RQ3 | Thứ tự thời gian có giúp tách nguyên nhân khỏi triệu chứng không? | Có/không thành phần `T`; thêm Earliest anomaly | Top-1/Top-3/MRR |
| RQ4 = **E3** | Khi telemetry thiếu thì kết quả giảm ra sao? | Đầy đủ vs **giữ 50% và 10% trace** (lấy mẫu cả trace, seed cố định), **log mất `trace_id`**, **mất một nguồn** (ADR-007 thay định nghĩa cũ chỉ "bỏ 50% trace"); so cặp trên cùng run, cả engine lẫn `base-manual-auto`, SimpleRCA | Giá trị tuyệt đối và độ chênh của mọi chỉ số |
| RQ5 | Đổi lại chất lượng thì tốn bao nhiêu (thời gian chạy, CPU, RAM, độ phức tạp, khả năng giải thích)? | Bảng đánh đổi giữa các biến thể đã chạy ở RQ1–RQ4, RQ6 | Thời gian từng bước, CPU/RAM đỉnh, kích thước artifact, chi phí thêm do gắn telemetry vào service |
| RQ6 | So với truy vết thủ công, engine có chẩn đoán đúng hơn, rẻ hơn, ổn định hơn không? | Engine vs `base-manual-auto`, Max anomaly, SimpleRCA, BARO (E2); detector vs ngưỡng cố định (E1); chi phí (E4) | Top-1/MRR theo case (kèm CI), thời gian tới kết luận đúng, số artifact phải mở, độ ổn định qua các lần lặp |

Quan hệ RQ ↔ bằng chứng của ADR-007: RQ1–RQ3 và ablation là **E5**; RQ4 là **E3**; RQ6 gồm **E1** (phát hiện), **E2** (khoanh vùng), **E4** (chi phí); **E8** là case study C6; **E6** (RCAEval) và **E7** (thử nghiệm người) là Target, bổ sung cho RQ6.

**Giả thuyết đi kèm** (sẽ được **đăng ký trước** ở tuần 19, cùng cấu hình và ngưỡng, trước khi chạy run test):

- H1: thêm trace/log cải thiện ít nhất một nhóm chỉ số, đổi lại tốn tài nguyên hơn. Log của worker gần như không có nên giá trị của `L` bị giới hạn ở case liên quan worker.
- H2: graph giúp tách nguyên nhân khỏi triệu chứng phía trên (C6: triệu chứng ở `gateway`; C3: vòng `course → ai → course`).
- H3: nguyên nhân thường có dấu hiệu trước triệu chứng; với C6 nguyên nhân có từ `fault_start` nhưng chỉ thấy gián tiếp qua cạnh `gateway-identity-token`.
- H4: thiếu trace làm RCA dựa vào graph giảm mạnh hơn phát hiện dựa vào metric. Bỏ nguyên trace thì mất cả phía request lẫn phía worker của luồng bất đồng bộ; nối lại bằng `message_id` **chưa kiểm chứng** được.
- H6: ở case phức tạp, engine xếp đúng tốt hơn baseline thủ công; nếu số liệu không ủng hộ thì báo trung thực, không sửa case hay cách đo để thắng.

**Ablation** (thí nghiệm bỏ bớt một thành phần để đo giá trị của nó):

| Ablation | Tầng |
| --- | --- |
| `M` / `M+T` / `M+T+L` | MVP |
| Có / không graph | MVP |
| Có / không thời gian (`T`) | MVP |
| Thay detector học máy bằng z-score | MVP (E5, ADR-007) |
| Có / không điểm bằng chứng (`V`) | Target nếu thiếu thời gian |
| Tách theo từng loại cạnh (bỏ async, bỏ auth, bỏ shared) | Target |
| Ranker học (Hướng 2) vs Hướng 1 | Chỉ khi làm Stretch |
| Nhiều mức thiếu trace | MVP ở hai mức 50% và 10% (E3); thêm mức khác là Target |

Nguyên tắc chung: mỗi phép so sánh **chỉ đổi đúng biến đang kiểm tra**, còn lại giữ nguyên (cùng run, cùng ứng viên, cùng đáp án, cùng cấu hình đã niêm phong).

---

## 7. Trả lời góp ý giữa kỳ: "truy vết thủ công vẫn tìm ra, vậy AI giúp gì?"

### 7.1. Hiểu đúng câu hỏi

Plan v0.3 ghi yêu cầu của giảng viên: "chứng minh việc áp dụng ML/AI giúp chẩn đoán **hiệu quả hơn hoặc nhanh hơn** truy vết thủ công, vì truy vết thủ công vẫn có thể tìm ra nguyên nhân". Giảng viên **đã chấp nhận** rằng người tra thủ công tìm ra được. Câu hỏi thật là: tìm ra **với chi phí bao nhiêu, có ổn định không, có sớm không**.

So sánh đời thường: một bác sĩ giỏi đọc phim vẫn chẩn đoán đúng. Máy sàng lọc tự động không thay bác sĩ, nhưng nó báo sớm ca bất thường, khoanh sẵn vùng cần nhìn, mỗi lần đọc cho kết quả như nhau, và không mệt lúc ba giờ sáng. Giá trị nằm ở đó.

### 7.2. Hai lập luận đã bỏ

**"Người không tìm ra, AI tìm ra."** ADR-002 định chứng minh bằng case mà người không tìm ra, với baseline thủ công bị giới hạn trong đường request. ADR-006 bỏ cách này vì:

- Đó là so sánh **tự chứng minh** (mục 4.1).
- Trace đã nối xuyên RabbitMQ, nên ở C3–C6 **span lỗi của nguyên nhân nằm ngay trong trace**. Nói "người không tìm ra" là không đúng sự thật.

**"AI thắng mọi case."** ADR-007 bỏ luôn kỳ vọng này, vì nghiên cứu cho thấy baseline đơn giản rất mạnh (mục 7.3). Hứa thắng mọi case mà kết quả hòa thì cả báo cáo mất tin cậy; nói trước chỗ nào hòa thì kết quả hòa vẫn là kết quả có giá trị.

### 7.3. Vì sao không hứa "thắng mọi case": baseline đơn giản rất mạnh

**Ý chính:** trong nghiên cứu RCA microservice, phương pháp phức tạp thường **không** hơn rõ cách đơn giản; và benchmark có tải "đồ chơi" làm mọi phương pháp trông giỏi hơn thật.

| Kết quả nghiên cứu | Nguồn |
| --- | --- |
| Đánh giá 21 phương pháp RCA và 9 phương pháp tìm quan hệ nhân quả: "không phương pháp nào nổi bật ở mọi tình huống"; nhiều phương pháp nhân quả cho kết quả gần như chọn ngẫu nhiên (Dummy); NSigma, BARO chạy khoảng 0,01 giây mỗi case mà vẫn cạnh tranh | Pham et al., ASE 2024 (`[L-Pham2024ASE]`, https://arxiv.org/abs/2408.13729) |
| SimpleRCA (đếm cảnh báo theo service) thắng các phương pháp mới nhất trên 7/11 bộ dữ liệu (Top@1); tác giả kết luận benchmark hiện tại "có thể phóng đại tiến bộ" | Fang et al. 2025 (`[L-Fang2025]`, https://arxiv.org/abs/2510.04711) |
| Tải của các benchmark cũ chỉ 0,14–4,35 (ví dụ trên Train-Ticket) request/giây và gọi tới ít service (RE2-TT chỉ phủ 27/69 service). Đổi sang tải theo máy trạng thái (16,47 request/giây, phủ 84% service): Top-1 trung bình của 11 phương pháp còn **0,21**; Nezha từ 0,87 xuống **0,04** | Fang et al. 2025 (như trên); Nezha: Yu et al., FSE 2023 (`[L-Nezha]`, https://github.com/IntelligentDDS/Nezha) |
| Số đã công bố trên RCAEval RE2-TT (độ chính xác Top-1): BARO đa nguồn 0,69; TraceRCA 0,66; PDiagnose 0,48; CIRCA 0,32; MicroRank 0,16. Một luật kiểu "service nào có nhiều trace bất thường" (TraceRCA) đứng sát phương pháp tốt nhất | Pham et al., RCAEval, WWW 2025 Companion (`[L-RCAEval]`, https://arxiv.org/abs/2412.17015); TraceRCA: Li et al., IWQoS 2021 (`[L-TraceRCA]`, https://github.com/NetManAIOps/TraceRCA) |

**Hệ quả cho đồ án.** `base-manual-auto` ("đi theo span lỗi/chậm sâu nhất") về bản chất gần TraceRCA và SimpleRCA, tức là một baseline **mạnh**. Ở C2, C3, C4 span lỗi nằm ngay trong trace, nên nếu chỉ so Top-K khi quan sát đầy đủ và tải đơn giản thì engine **nhiều khả năng chỉ hòa**. Nhóm nói trước điều này, và chọn đo ở những chỗ có lý do để khác biệt (mục 7.4). Đồng thời, đo trên **tải bán thực** chứ không phải tải đều, để tránh đúng cái bẫy "tải đồ chơi" mà Fang et al. chỉ ra.

So sánh đời thường: một bài kiểm tra quá dễ thì học sinh giỏi và học sinh trung bình đều được 10 điểm; muốn thấy khác biệt phải ra đề có "nhiễu" giống đời thật, và phải chấm thêm thời gian làm bài, số lần lật sách.

### 7.4. Lập luận trung tâm và bộ bằng chứng E1–E8

Lập luận (ADR-007 mục 3): *khi quan sát đầy đủ và tải đơn giản, luật đơn giản hoặc người đã đủ tìm ra nguyên nhân; nhóm báo cáo trung thực điều này. RCA engine tạo giá trị ở bốn chỗ: phát hiện sự cố trong nhiễu của tải thật, giữ độ chính xác khi quan sát bị thiếu, giảm công sức và thời gian chẩn đoán, và chạy tự động, ổn định trên mọi incident.*

| Chỗ engine tạo giá trị | Bằng chứng | Đo bằng | So với | Mức |
| --- | --- | --- | --- | --- |
| **Phát hiện** trong nhiễu của tải thật | **E1** | Báo động giả mỗi giờ trên run khỏe có cao điểm trước hạn quiz; độ trễ phát hiện; recall trên run có lỗi | Cảnh báo ngưỡng cố định | MVP |
| **Khoanh vùng** đúng, ổn định | **E2** | Top-1, MRR (chính), Top-3; theo từng case; CI bootstrap 95%; McNemar exact; có run lỗi trùng cao điểm tải | Random, xếp hạng hằng, ngưỡng tĩnh, `base-manual-auto`, SimpleRCA, BARO | MVP |
| **Giữ độ chính xác khi quan sát thiếu** | **E3** | Cùng chỉ số khi giữ 50%/10% trace, log mất `trace_id`, mất một nguồn | `base-manual-auto`, SimpleRCA trên cùng bản cắt bớt | MVP |
| **Giảm công sức** | **E4** | Số trace, panel, truy vấn log phải mở; thời gian tới kết luận đúng | `base-manual-auto` | MVP |
| Thành phần nào đóng góp | **E5** | Ablation: bỏ từng nguồn, bỏ graph, bỏ thời gian, thay detector bằng z-score | Chính engine | MVP |
| Giải thích được | **E8** | Case study C6: chuỗi bằng chứng của engine (lỗi ở gateway, nguyên nhân ở `identity` im lặng, cờ `telemetry_silent`) cạnh đường truy vết thủ công | Truy vết thủ công | MVP |
| Không chỉ khớp đề tự ra | **E6** | Chạy engine trên RCAEval RE2 (Online Boutique, Train Ticket) qua adapter, đặt cạnh số đã công bố; tái lập BARO trước để kiểm pipeline | Số công bố | Target |
| Hiệu quả với người thật | **E7** | Within-subject, mỗi người 4 incident, nửa dùng Grafana thủ công, nửa có báo cáo engine; thời gian, đúng/sai, số thứ đã mở, NASA-TLX rút gọn, SUS | Chính người đó khi không có engine | Target |

Bốn trục cũ của ADR-006 (phát hiện, khoanh vùng, chi phí, độ ổn định) vẫn đúng; ADR-007 biến chúng thành các phép đo cụ thể ở trên và thêm "quan sát thiếu" (E3).

**Vì sao E3 quan trọng.** Ở hệ thống thật, trace thường bị **lấy mẫu** (chỉ giữ một phần) để tiết kiệm; testbed thì giữ 100%. Một baseline chỉ dựa vào trace (như `base-manual-auto`, SimpleRCA phần trace) có thể sụp khi thiếu trace, còn engine dùng cả metric và log có cơ hội giữ được. Đây là **giả thuyết**, phải đo; nếu không đúng thì báo cáo đúng như vậy.

**Thử nghiệm người (E7)** lấy mẫu từ LogAssist (IEEE TSE 2022 (online 2021), `[L-LogAssist]`, https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf): 19 người, mỗi người làm cả hai điều kiện; tổng thời gian giảm 42,49%, nhưng hai task dễ nhất lại **chậm hơn** khi có công cụ, và chỉ 2/6 task có ý nghĩa thống kê. Bài học: mẫu nhỏ thì báo mô tả và khoảng tin cậy, không hứa "nhanh hơn X lần". Chưa tìm thấy nghiên cứu có kiểm soát nào đo kỹ sư làm RCA microservice có/không có công cụ; nghiên cứu gần nhất cho 25 người phụ trách sự cố chấm gợi ý nguyên nhân (Ahmed et al., ICSE 2023, `[L-Ahmed2023]`, https://arxiv.org/abs/2301.03797).

### 7.5. Vì sao kỳ vọng engine có lợi thế ở những chỗ đó

Các lý do dưới là **giả thuyết của người viết**, dựa trên thiết kế; phải kiểm chứng bằng dữ liệu campaign.

1. **Ngưỡng cố định khó đặt dưới tải thật (E1).** Tải bán thực có nhịp theo giờ và cao điểm trước hạn quiz lấy từ log Moodle; người dùng mức 2 còn thử lại khi gặp 5xx, đăng nhập lại khi 401, bỏ dở khi chờ lâu. Ngưỡng thấp thì báo nhầm lúc cao điểm khỏe; ngưỡng cao thì báo muộn. Detector học "bình thường" của từng service từ run khỏe (gồm cả profile tải cao) nên có cơ hội cân bằng tốt hơn.
2. **"Trace chậm nhất" dễ bị nhiễu nền đánh lừa (E2).** LMS có thao tác vốn dĩ chậm (job AI gọi LLM, upload file). Engine so mỗi service với mức bình thường **của chính nó** (robust z-score), nên một job AI dài bình thường không bị coi là lạ. Lợi thế này nhỏ đi nếu luật baseline đã so "chậm" theo từng route (mục 4.1). Lỗi trùng cao điểm tải làm khó cả hai, nhưng khó baseline hơn.
3. **Nhiều triệu chứng cùng lúc (E2, E4).** Ở C6, `gateway` và các worker lần lượt lỗi khi token của từng bên hết hạn, vào các thời điểm khác nhau. Engine gộp thành **một** incident có nhiều service bị ảnh hưởng và **một** danh sách nghi phạm; người tra thủ công đứng trước nhiều trace lỗi rải rác và phải tự chọn.
4. **Lỗi đến muộn, lan lệch giờ (E2, E8).**
   - **C6:** khi lỗi lan rộng (70–74 giây sau pause với TTL 60; với TTL mặc định 600 giây chưa đo), `identity` đã im lặng hơn một phút. Thành phần `T` lấy lúc bắt đầu im lặng làm mốc, nên `identity` "đi trước" triệu chứng dù không có span lỗi nào của chính nó. Lưu ý phát hiện tuần 13: lúc im lặng, metric của `identity` vẫn còn ~5 phút với giá trị đứng yên, nên "im lặng" phải đo bằng bộ đếm không tăng.
   - **C3:** triệu chứng không phải request lỗi: job AI chạy rất lâu (`RUNNING`), tài liệu kẹt `EXTRACTING`, `course` thấy lỗi muộn ở cạnh `ai-worker → course`; kết cục cuối là `FAILED` (ví dụ `AI_PROVIDER_ERROR` khi provider lỗi, đã đo tuần 13) hoặc vẫn `COMPLETED` nếu chỉ chậm vừa phải. Nguyên nhân (`ai-llm-provider`) xảy ra trước, ở process `ai-worker`, còn đáp án là chủ sở hữu `ai`; graph lại có vòng `course → ai → course`.
   - **C4:** còn khó hơn với trace: media kẹt `PENDING`, rồi nhiều phút sau job dọn của `scheduler-worker` coi là **upload bỏ dở** (`UPLOAD_ABANDONED`) và xóa. `scheduler` và `scheduler-worker` **không cùng trace**, nên chuỗi trace bị đứt ở đúng chỗ đó. Engine có cạnh thiết kế "bàn giao qua DB" và thành phần thời gian. Độ trễ thật chưa đo.
5. **Chi phí (E4).** Engine trả một `RcaIncidentResult` có sẵn thứ hạng và vật chứng chỉ đúng chỗ. Baseline thủ công phải mở lần lượt panel, trace, truy vấn log; số artifact phải mở đo đúng phần công này.
6. **Quan sát thiếu (E3).** Như mục 7.4: khi trace bị lấy mẫu hoặc log mất `trace_id`, cách dựa một nguồn mất nhiều thông tin hơn cách gộp ba nguồn.

### 7.6. Kỳ vọng trung thực theo từng case MVP

Dự đoán của người viết, chưa kiểm chứng:

| Case | Baseline thủ công có tìm ra không? | Chỗ engine có thể hơn | Chỗ engine có thể thua hoặc hòa |
| --- | --- | --- | --- |
| C2 | Có. ADR-006 cố ý đặt C2 làm **case đối chứng dễ** | Phát hiện dưới nhiễu nền (E1); ít artifact phải mở (E4); khi thiếu trace (E3) | Khoanh vùng khi quan sát đầy đủ nhiều khả năng hòa, kể cả với SimpleRCA |
| C3 | Tùy luật quy về chủ sở hữu (`ai` hay `ai-worker`) | Triệu chứng muộn, không phải request lỗi; vòng phụ thuộc | Log worker là `not_instrumented`; điểm chia giữa `ai` và `ai-worker` |
| C4 | Khó hơn: triệu chứng ở trace khác, muộn nhiều phút | Thời gian + cạnh thiết kế `scheduler → scheduler-worker` | Độ trễ chưa đo; triệu chứng có thể rơi ra ngoài khoảng chấm; engine cũng có thể trượt |
| C6 | Nhiều khả năng có, nhờ được đi theo cạnh xác thực | Gộp nhiều triệu chứng; thời gian im lặng; phát hiện sớm; case study E8 | `identity` im lặng nên `A(identity)` không có dữ liệu; cờ `telemetry_silent` mới thử với `scheduler`, chưa thử với `identity` |

### 7.7. Điểm yếu phải nói thẳng

- **Ở nhiều case, span lỗi của nguyên nhân nằm ngay trong trace**, và baseline đơn giản nói chung rất mạnh (mục 7.3). Lập luận không dựa vào "người không tìm ra" hay "AI thắng mọi case"; baseline tìm ra ở vài case là kết quả bình thường.
- **Chuỗi nhân quả mới chạy thật ở C6**, một lần, ở mức kiểm tra nhanh (smoke test). C2, C3, C4 đã có công cụ gây lỗi và số đo tác động trực tiếp (tuần 13), chưa chạy thành run có ground truth.
- **Ít dữ liệu:** 16 run test, 4 run mỗi case. Luôn kèm khoảng tin cậy bootstrap; kiểm định McNemar có thể không đạt và phải báo đúng như vậy. Biến thể để có 32–40 incident là Target.
- **Top-3 bão hòa:** xếp cố định đã đạt 75% Top-3 trên 4 case MVP (mục 5.3); vì vậy Top-1 và MRR là chỉ số chính.
- **Tự ra đề tự chấm:** case, testbed, baseline thủ công đều do nhóm làm. Cách giảm: đăng ký trước ở tuần 19, baseline đã công bố (SimpleRCA, BARO), và nếu kịp thì RCAEval (E6).
- **Thời gian chưa so được với người thật:** `T_engine` và `T_base` đều là thời gian máy chạy; thử nghiệm người (E7) là Target. Không được nói "AI nhanh hơn người X lần".
- **Baseline thủ công là mô phỏng do chính nhóm viết.** Cách giảm thiên vị: luật chọn trên validation, có version, đăng ký trước, cùng bộ lọc nhiễu và cùng bảng quy đổi như engine.
- **Telemetry còn thiếu:** log worker (`not_instrumented`), metric pool DB, nối trace `scheduler` → `scheduler-worker`.

Nếu kết quả cho thấy engine gần ngang baseline, plan v0.4 (bảng rủi ro) đã định sẵn cách xử lý: báo cáo trung thực theo từng case, trọng tâm vào E1, E3, E4 và tính tự động; trích Pham et al. 2024 và Fang et al. 2025 để cho thấy kết quả "hòa" cũng là điều nghiên cứu đã gặp.

### 7.8. Gợi ý câu trả lời ngắn trước hội đồng

Gợi ý của người viết, cần sửa theo kết quả thật sau campaign:

> "Nhóm đồng ý rằng người vận hành có kinh nghiệm vẫn tìm ra nguyên nhân, vì trace của hệ thống đã nối xuyên hàng đợi; nghiên cứu gần đây cũng cho thấy luật đơn giản thường ngang các phương pháp phức tạp. Vì vậy nhóm không so 'AI tìm ra, người không tìm ra' và không hứa 'AI thắng mọi case'. Nhóm đo ở bốn chỗ: phát hiện sự cố dưới tải bán thực, phát lại từ log Moodle thật, so với cảnh báo ngưỡng cố định; độ chính xác Top-1 và MRR theo từng case, so với random, `base-manual-auto` và hai baseline đã công bố SimpleRCA, BARO; độ chính xác khi trace bị lấy mẫu hoặc log mất `trace_id`; và số artifact, thời gian để tới kết luận đúng. Cấu hình và giả thuyết được đăng ký trước khi chạy run test. Case nào engine hòa hoặc thua, nhóm báo đầy đủ."

---

## 8. Phạm vi và lịch của phần AI

### 8.1. MVP, Target, Stretch, ngoài phạm vi

| Tầng | Hạng mục của phần AI/RCA |
| --- | --- |
| **MVP** | Export telemetry theo run + kiểm chất lượng; feature service/cạnh; ngưỡng cố định, robust z-score, Isolation Forest; gộp M/T/L có dự phòng; incident có `estimated_start_time`; graph động với cạnh đồng bộ, bất đồng bộ, xác thực; Max anomaly, Earliest anomaly, Graph-aware simple, `base-manual-auto`; ranker Hướng 1 có bằng chứng và `insufficient_evidence`; một lệnh từ `run_id` ra kết quả; đánh giá RQ1–RQ6 trên 4 case × 5 run; ablation modality/graph/thời gian; một phép thử độ bền (bỏ 50% trace) |
| **Target** | Change-point; cạnh dùng chung và ablation theo từng loại cạnh; case C1, C5, C7; thử nghiệm người thật 2–3 người; ablation điểm bằng chứng; nhiều mức bỏ trace; mẫu log nâng cao; bộ dữ liệu công khai bên ngoài |
| **Stretch** | Ranker học có giám sát (Hướng 2); mô hình học sâu; tìm quan hệ nhân quả đầy đủ; RCA mức component hoặc instance làm chỉ số chính; nhiều lỗi cùng lúc |
| **Ngoài phạm vi** | MCP server và agent LLM đọc kết quả RCA; LLM thay engine để xếp hạng; tính năng LMS mới |

### 8.2. Lịch theo plan v0.3

Plan ghi rõ: "số tuần trong plan là **thứ tự công việc**". Theo lịch, Gate R lẽ ra xong cuối tuần 12, nhưng đến 17/11/2026 (tuần 16 theo lịch) phần AI vẫn chưa có dòng code nào; ADR-006 và các sửa của Gate R mới merge hôm đó. Các tuần dưới đây vì vậy sẽ **dịch theo** ngày Gate R thật sự đạt (trạng thái nghiệm thu Gate R chưa kiểm chứng trong ghi chú này).

| Tuần (thứ tự) | B — Bách (AI primary) | A — Đức (collaborator/platform) | Mốc |
| --- | --- | --- | --- |
| 13 | Lớp đọc/export Prometheus, Tempo, Loki theo run; từ điển dữ liệu; kiểm chất lượng (11 runtime, thiếu nguồn, `telemetry_silent`) | Thiết kế workload, k6 mức 1, LLM stub, proxy chèn trễ | |
| 14 | `RunGroundTruth` tối thiểu + script đối chiếu; triệu chứng và đường lan dự kiến 4 case; dây chuyền tính feature v0 (60s/15s) | k6 mức 2; fault manifest C2, C3, C4, C6 | |
| 15 | Kiểm nhãn và đáp án; chia train/validation/test theo run; dây chuyền tính feature v1 có kiểm tra chống lộ đề | Chương trình chạy thí nghiệm, pilot, dataset v0 | **M3** |
| 16 | Ngưỡng cố định, robust z-score, Isolation Forest fit trên healthy train; gộp M/T/L; vòng đời incident | Bộ chấm Precision/Recall/F1/FPR/Delay; baseline cảnh báo ngưỡng cố định cho RQ6; kiểm báo nhầm trên tải cao | |
| 17 | Graph động (sync, async, xác thực); Max anomaly, Earliest anomaly, Graph-aware simple | `base-manual-auto` + đếm trace/panel phải mở; bộ chấm Top-K; kiểm graph với catalogue | |
| 18 | Ranker Hướng 1 (A/T/P/E/V), hiệu chỉnh trên validation; bằng chứng; `RcaIncidentResult`; `insufficient_evidence` | CLI một lệnh `run_id` → Top-3 + bằng chứng; demo | **M4** |
| 19 | Chạy dây chuyền phân tích trên toàn bộ run, tính chỉ số, kiểm lộ đề | Niêm phong; final test 4 case × 4 run + healthy với seed mới | |
| 20 | RQ1–RQ5: modality, graph, thời gian, bỏ 50% trace, đánh đổi | RQ6 theo từng case: phát hiện, khoanh vùng, chi phí, độ ổn định | |
| 21 | Việc chung của hai người: phân tích lỗi theo case, kết luận, giới hạn; Target nếu còn thời gian (thử nghiệm người thật, C1/C5/C7) | (việc chung) | **M5** |

**Nếu thiếu thời gian** (plan mục 9), cắt theo thứ tự, dừng ngay khi đủ: bỏ mọi Target; gộp tuần 13–14 phần workload; giảm `R` từ 5 xuống 4; gộp tuần 20–21, chỉ giữ RQ1, RQ2, RQ6 và một kết quả độ bền; bỏ C3 nếu LLM stub chưa ổn định; dùng tuần 24. **Không được cắt:** Gate R, ground truth, chia tập chống lộ đề, đối chứng với `base-manual-auto`.

---

## Tóm tắt

- RCA engine **hỗ trợ** người vận hành: tự phát hiện incident và đưa danh sách nghi phạm kèm bằng chứng; không tuyên bố chứng minh nhân quả. Chưa có dòng code nào.
- Dây chuyền: kiểm chất lượng → window 60s/15s → feature → chấm bất thường → incident → graph động → `R(s) = 0.30·A + 0.20·T + 0.20·P + 0.20·E + 0.10·V` → bằng chứng → `RcaIncidentResult`.
- Học máy thật là detector không giám sát (Isolation Forest, thống kê robust) fit trên run khỏe; ngưỡng và trọng số chỉ hiệu chỉnh trên validation; ranker học có nhãn là Stretch vì quy chế cấm và dữ liệu quá ít.
- Hạ tầng không bao giờ là nghi phạm; tín hiệu được quy về service chủ sở hữu (ví dụ `*-identity-token` → `identity`).
- Baseline: ngưỡng cố định, Max anomaly, Earliest anomaly, Graph-aware simple, `base-manual-auto` định nghĩa mới (được đi theo cạnh bất đồng bộ và xác thực), cùng hai mốc xếp cố định/ngẫu nhiên.
- Chấm theo incident: báo trước lỗi là báo nhầm; incident sớm nhất trong khoảng chấp nhận là đúng; RCA báo cả điểm có điều kiện và toàn trình, `insufficient_evidence` là trượt.
- Top-3 bão hòa vẫn còn: xếp cố định đạt 75% Top-3 trên 4 case MVP; phải đọc Top-1, MRR, từng case.
- Trả lời góp ý giữa kỳ bằng bốn trục: phát hiện, khoanh vùng, chi phí, độ ổn định; nói thẳng rằng span lỗi thường nằm ngay trong trace.
- Lịch: tuần 16–18 làm detector, graph, ranker (M4); tuần 19–21 campaign và đánh giá (M5); tuần thực tế dịch theo ngày Gate R đạt.

## Câu hỏi tự kiểm tra

1. ADR-006 đổi vai trò của RCA engine thế nào so với ADR-002?

<details><summary>Đáp án</summary>
Từ "AI truy vết chính, kết luận không cần người" thành "tự động phát hiện incident và xếp hạng nghi phạm kèm bằng chứng để hỗ trợ người vận hành", đúng tên đề tài đã đăng ký.
</details>

2. Năm thành phần của `R(s)` là gì, trọng số khởi điểm bao nhiêu?

<details><summary>Đáp án</summary>
A mức bất thường 0,30; T đi trước về thời gian 0,20; P khớp hướng lan truyền 0,20; E cạnh hỏng thuộc về s 0,20; V độ mạnh bằng chứng 0,10. Trọng số chưa kiểm chứng trên v2.
</details>

3. Phần nào của engine là học máy, và vì sao không huấn luyện ranker trên fault run?

<details><summary>Đáp án</summary>
Isolation Forest (không giám sát) và thống kê robust fit trên run khỏe; ngưỡng/trọng số chỉ hiệu chỉnh trên validation. Không huấn luyện trên fault run vì quy chế cấm dùng lại fault run validation/test, chỉ có 20 fault run với 4 đáp án (dễ học thuộc), và không có case "chưa thấy" để đo tổng quát.
</details>

4. Vì sao định nghĩa cũ của `base-manual-auto` bị coi là "tự chứng minh"?

<details><summary>Đáp án</summary>
Baseline bị cấm nhìn ra ngoài đường request, trong khi case được chọn chính vì nguyên nhân nằm ngoài đường request, nên engine thắng là chắc. Hơn nữa trace đã nối xuyên RabbitMQ nên kỹ sư thật vẫn thấy span lỗi.
</details>

5. Một run có `verdict = "insufficient_evidence"` được tính thế nào ở điểm toàn trình?

<details><summary>Đáp án</summary>
Tính là trượt: Top-1 và Top-3 trượt, <code>1/hạng = 0</code>; đồng thời đếm riêng số run <code>insufficient_evidence</code>. Nó không vào điểm có điều kiện.
</details>

6. Với 4 case MVP, một cách xếp hạng cố định đạt Top-3 bao nhiêu? Hệ quả khi báo cáo?

<details><summary>Đáp án</summary>
Khoảng 75% Top-3 (25% Top-1), theo phép tính với số run mỗi case bằng nhau. Vì vậy không kết luận chỉ bằng Top-3; phải đọc Top-1, MRR, từng case và so với mốc xếp cố định, xếp ngẫu nhiên.
</details>

7. Bốn trục dùng để trả lời "AI giúp gì khi người vẫn tìm ra" là gì?

<details><summary>Đáp án</summary>
Phát hiện (sớm hơn, ít báo nhầm hơn ngưỡng cố định), khoanh vùng (Top-K theo case so với <code>base-manual-auto</code>), chi phí (thời gian tới kết luận đúng, số artifact phải mở), độ ổn định (qua các lần lặp, dưới nhiễu nền).
</details>

8. Vì sao không được nói "AI nhanh hơn người X lần"?

<details><summary>Đáp án</summary>
Thử nghiệm người thật chỉ là Target; <code>T_engine</code> và <code>T_base</code> đều là thời gian máy chạy, còn <code>T_human</code> khác bản chất nên chỉ mô tả cạnh nhau, chưa có cách chuẩn hóa.
</details>

9. Ở C3, điều gì có thể làm phép so sánh với baseline thủ công thiếu công bằng?

<details><summary>Đáp án</summary>
Span chậm nằm ở process <code>ai-worker</code> nhưng đáp án là <code>ai</code>. Nếu engine quy về chủ sở hữu còn baseline thì không, engine thắng nhờ quy ước. Nên cho baseline dùng cùng bảng quy đổi và báo thêm điểm theo chủ sở hữu.
</details>
</content>
</invoke>
