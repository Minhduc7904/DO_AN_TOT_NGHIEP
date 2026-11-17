# Các case lỗi và workload mô phỏng người dùng

> **File này giải thích gì:** bảy case lỗi C1–C7 của testbed v2 (bốn case MVP được kể kỹ: người dùng thấy gì, lỗi gây ra thế nào, đáp án là gì, lỗi lan đi đâu, nhìn thấy bằng tín hiệu nào, vì sao truy vết thủ công tốn công hơn, còn thiếu dữ liệu gì), và thiết kế workload mô phỏng hành vi người dùng theo góp ý giữa kỳ. Cuối file nói ngắn cách ghép hai thứ này để chứng minh AI có ích, cùng lịch tuần 13–15.
>
> **Nguồn gốc (canonical):**
>
> - Case: [`../architecture/complex-case-catalogue-and-rca-result-v0.md`](../architecture/complex-case-catalogue-and-rca-result-v0.md) (mục 1–3), [`../architecture/data-ownership-and-fault-matrix-v2.md`](../architecture/data-ownership-and-fault-matrix-v2.md) (mục 5–6, fault FA–FH)
> - Đánh giá: [`../architecture/evaluation-protocol-v1.md`](../architecture/evaluation-protocol-v1.md) (mục 4.2, 5.2–5.5, 7.3, 8.4, 15)
> - Quyết định: [`../adr/adr-006-trim-project-scope-v1.md`](../adr/adr-006-trim-project-scope-v1.md) (mục 3–5), [`../adr/adr-004-service-access-token-and-api-surfaces-v1.md`](../adr/adr-004-service-access-token-and-api-surfaces-v1.md), [`../adr/adr-005-merge-auth-student-into-identity-v1.md`](../adr/adr-005-merge-auth-student-into-identity-v1.md)
> - Phạm vi và kế hoạch: [`../direction/project-scope-v2.md`](../direction/project-scope-v2.md) (mục 3.4), [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) (mục 0, giai đoạn 5, mục 8–9)
> - Code đã đối chiếu: [`../../../lms/services/course/src/application/use-cases/courses/export-courses-csv.use-case.ts`](../../../lms/services/course/src/application/use-cases/courses/export-courses-csv.use-case.ts), [`../../../lms/services/ai/src/application/use-cases/jobs/run-job.use-case.ts`](../../../lms/services/ai/src/application/use-cases/jobs/run-job.use-case.ts), [`../../../lms/services/ai/src/config/env.schema.ts`](../../../lms/services/ai/src/config/env.schema.ts), [`../../../lms/services/media/src/application/use-cases/cleanup/cleanup-media.use-case.ts`](../../../lms/services/media/src/application/use-cases/cleanup/cleanup-media.use-case.ts), [`../../../lms/services/media/src/config/env.schema.ts`](../../../lms/services/media/src/config/env.schema.ts), [`../../../lms/packages/common/src/auth/service-token.provider.ts`](../../../lms/packages/common/src/auth/service-token.provider.ts)
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch)

Khái niệm nền (service, worker, queue, command, outbox, timeout, retry, circuit breaker, token, JWKS, service token, trace, span, metric, log, k6) ở [khái niệm nền](02-basic-concepts.md). Các khái niệm thực nghiệm (run, ground truth, validation/test, campaign) ở [khái niệm thực nghiệm](07-experiment-concepts.md). Lịch sử vì sao có các case này ở [đợt tái cấu trúc](03-refactor-v1-to-v2.md).

---

## 0. Đọc nhanh trong một phút

**Ý chính:** muốn chứng minh "thám tử AI" có ích, cần hai thứ:

1. **Vụ án có đáp án** (case): cố tình gây một lỗi ở một chỗ đã biết, ghi lại đáp án, rồi xem AI và cách làm thủ công có tìm ra không, mất bao lâu.
2. **Đám đông giống thật** (workload): người dùng ảo đi lại, nghỉ, bỏ dở, thử lại như người thật. Nhờ vậy camera (telemetry) có cái để quay, và vụ án xảy ra giữa tiếng ồn bình thường của một ngày học.

Đến 17/11/2026 **chưa có dòng code nào** cho fault injector, workload k6, dataset hay RCA engine (thư mục `aiops-platform/load/`, `faults/`, `training/` chưa tạo). Mọi thứ trong file này là thiết kế, trừ những chỗ ghi rõ "đã chạy".

---

## 1. Case là gì và bảy case C1–C7

### 1.1. Ba từ cần phân biệt

- **Fault** (FA–FH): cơ chế gây lỗi, bật/tắt được, tái lập được, không sửa code nghiệp vụ. Ví dụ "chèn trễ vào MinIO".
- **Case** (C1–C7): kịch bản gồm một fault, chuỗi nhân quả dự kiến và **ground truth** (đáp án: service nào là nguyên nhân gốc, thành phần nào, kiểu lỗi gì, bật lúc nào, tắt lúc nào).
- **Trạng thái kiểm chứng** của case (catalogue mục 3):
  - **Đã chạy:** cơ chế gây lỗi đã chạy thật, có số đo.
  - **Đã đo tín hiệu:** các tín hiệu cần để nhận ra case đã có trong telemetry, nhưng cơ chế gây lỗi chưa chạy.
  - **Giả thuyết:** chuỗi nhân quả chưa kiểm chứng.

Tiêu chí "case phức tạp" ban đầu (ADR-002): nguyên nhân gốc nằm **ngoài đường đi của request bị lỗi**. ADR-006 nói thẳng một giới hạn: trace đã nối xuyên RabbitMQ, nên ở C3–C6 span lỗi của nguyên nhân **thường nằm ngay trong trace**. Vì vậy giá trị của AI phải đo bằng **chi phí và độ ổn định** của chẩn đoán, không phải bằng "người không tìm ra".

### 1.2. Bảng bảy case

| Case | Người dùng thấy gì | Fault | Nguyên nhân gốc (`root_cause_service` / component) | Mức (ADR-006) | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| C1 | Upload xong mà bước hoàn tất chậm/timeout | FB | `notification-worker` / `notification-worker-rabbitmq` | Target | Đã đo tín hiệu; chuỗi lan sang `media-worker` là **giả thuyết** |
| C2 | Mọi thao tác học (ghi danh, làm quiz) chậm đột ngột | FC (viết lại) | `course` / `course-postgres` | **MVP** | Tín hiệu đã có; cơ chế mới (chèn trễ) **chưa chạy** |
| C3 | Job AI soạn bài treo, tài liệu mãi "đang trích" | FD | `ai` / `ai-llm-provider` | **MVP** | Đã đo tín hiệu; LLM stub chậm chưa chạy |
| C4 | Ảnh/tệp vừa upload biến mất sau một thời gian | FA | `media` / `media-minio` | **MVP** | Đã đo tín hiệu; chèn trễ chưa chạy |
| C5 | Đợt gửi thông báo hàng loạt thiếu người nhận | FE | `identity` / `identity-postgres` | Target | Đã đo tín hiệu; chèn trễ chưa chạy |
| C6 | Đăng nhập lỗi ngay; sau một khoảng yên lặng (70–74 giây khi test với TTL 60 giây) mọi trang lỗi 504 | FG | `identity` / `identity` | **MVP** | **Đã chạy** (smoke `tracing-smoke`) |
| C7 | Nhiều service trả 401 cùng lúc dù hạ tầng khỏe | FH | `identity` / `identity-jwks` | Target | Đã đo tín hiệu; đổi khóa chưa chạy |

FF (quá tải CPU/bộ nhớ) không có case riêng; CPU và RAM chỉ là bằng chứng phụ.

### 1.3. Vì sao bốn case MVP là C2, C3, C4, C6

- **Bốn nguyên nhân gốc ở bốn service khác nhau:** `course`, `ai`, `media`, `identity`. Nếu giữ C5, C7 thì ba case cùng đáp án `identity`, một bảng xếp hạng cố định "luôn đặt `identity` đầu" đã ăn điểm dễ (ADR-005: Top-3 khoảng 71% trên 7 case).
- **C6 đã chạy thật**, các case còn lại có tín hiệu sẵn.
- **Mỗi case lặp `R = 5` lần**: 1 run cho validation (chỉnh ngưỡng, trọng số), 4 run cho test cuối. Tổng 20 run có lỗi. Ít case nhưng nhiều lần lặp để báo cáo được độ dao động.

Lưu ý (ghi chú này tự tính, chưa có trong tài liệu): với bốn đáp án khác nhau trong 10 ứng viên, một xếp hạng cố định vẫn có thể đặt ba trong bốn đáp án vào Top-3, tức **Top-3 = 3/4 = 75%** khi tính đều theo case, nhưng **Top-1 chỉ 1/4 = 25%**. Vì vậy với bộ MVP, Top-1 và MRR phân biệt tốt hơn Top-3, và mốc "xếp hạng cố định" (evaluation-protocol-v1 mục 18.4) vẫn cần báo cạnh kết quả.

### 1.4. Điều kiện để một case được vào đợt chấm chính thức

Theo evaluation-protocol-v1 mục 5.2, phải đủ cả năm:

1. Fault injector bật/tắt được, tái lập được, có thời điểm bắt đầu/kết thúc và cách reset.
2. Triệu chứng dự kiến xuất hiện thật trong lần chạy thử (pilot). Không xảy ra thì phải sửa mô tả case hoặc loại, ghi lý do, không âm thầm bỏ.
3. Tín hiệu bắt buộc có mặt, hoặc chỗ thiếu được ghi là giới hạn của case.
4. Có ground truth hợp lệ theo schema `RunGroundTruth`.
5. Pilot đã chạy và đã chốt thời lượng các pha, cường độ lỗi, độ trễ lan truyền.

---

## 2. Bốn case MVP

Trước khi vào từng case, cần biết "người truy vết thủ công" được mô phỏng thế nào, vì mỗi case sẽ so với nó.

**`base-manual-auto`** (ADR-006, mục 3.2): một chương trình bắt chước SRE thật. Từ triệu chứng, nó lấy các trace lỗi hoặc chậm nhất trong cửa sổ sự cố, đi theo **span CLIENT lỗi hoặc chậm nằm sâu nhất**, rồi kết luận service sở hữu span đó. Nếu trace dẫn sang service khác qua cạnh bất đồng bộ hoặc cạnh xác thực, nó được đi theo. Nó chỉ dùng thứ người thật có: metric theo service, trace, log theo `trace_id`. Luật chi tiết (ngưỡng nào, quy đổi trace thành xếp hạng thế nào) **chưa viết**; sẽ chọn trên validation và chốt trước khi chấm test.

Hình dung như một thám tử giỏi nhưng làm theo một quy trình cố định: luôn lần theo dấu chân sâu nhất trong hồ sơ.

### 2.1. C2 — Mọi thao tác học chậm vì database của `course` chậm (case đối chứng dễ)

**Câu chuyện.** Giữa buổi học, sinh viên bấm "ghi danh", "làm quiz", "xem tiến độ": tất cả chậm hẳn. Không có thông báo lỗi, chỉ là chờ lâu.

**Vì sao phải viết lại.** Bản cũ của C2 (FC) nói "nhiều export CSV khối lượng lớn giữ kết nối DB làm cạn pool". Code không làm vậy: export đọc **từng khối 500 dòng** theo khóa tăng dần, chính để không giữ một truy vấn dài.

```text
export-courses-csv.use-case.ts
  dòng 8:      EXPORT_CHUNK_SIZE = 500
  dòng 14–16:  "Sinh CSV theo từng khối bằng keyset (id tăng dần): bộ nhớ không phụ thuộc số khóa học
                và không giữ một truy vấn dài trên DB."
```

**Cơ chế gây lỗi (ADR-006, đã cài ở PR #75 tuần 13).** Proxy **toxiproxy** tên `course-to-postgres` đứng giữa `course` và PostgreSQL; lệnh `node aiops-platform/faults/fault-control.mjs latency course-to-postgres 200` làm mỗi lượt trả lời của DB chậm thêm 200 ms. Đo thử: p50 của `course-postgres` từ ~2,5 ms lên ~175–204 ms, gỡ ra thì về lại. Proxy luôn nằm trên đường đi kể cả run khỏe (chỉ thêm ~0,02 ms mỗi truy vấn).

**Ground truth.** `fault_type=dependency_latency`, `root_cause_service=course`, `root_cause_component=course-postgres`.

**Đường lan.**

```text
proxy chèn trễ ──> course-postgres ──> course (mọi route) ──> gateway ──> người dùng thấy chậm
                                           │
                                           └─ dự kiến: ai-worker gọi course (ai-context…) cũng chậm theo
```

**Tín hiệu nhìn thấy được.**

- `lms_dependency_duration_seconds{dependency_identity="course-postgres"}` tăng **đồng loạt ở mọi `operation_name`**.
- Trong trace của route `course`, các span `course-postgres *` dài ra; không có span lỗi (nếu trễ chưa vượt timeout).
- Độ trễ `gateway-course` tăng; CPU/RAM của `course` là bằng chứng phụ.

**Truy vết thủ công: dễ, và đó là chủ ý.** `base-manual-auto` mở trace chậm nhất của một route `course`, thấy span sâu nhất chậm là `course-postgres …`, thuộc `course`, kết luận đúng. ADR-006 gọi C2 là **case đối chứng dễ**: baseline thủ công được kỳ vọng tìm ra, để phép so sánh trung thực. Ở case này AI chỉ có thể hơn về thời gian và số thứ phải mở, không hơn về độ đúng.

**Còn thiếu.**

- Proxy chèn trễ chưa có.
- Chưa có metric pool kết nối PostgreSQL, nên không phân biệt được "pool cạn" với "DB chậm" (catalogue mục 1.5). Với cơ chế chèn trễ mới thì đây là "DB chậm", nên giới hạn này ít ảnh hưởng hơn bản cũ.

### 2.2. C3 — Job AI soạn bài treo vì nhà cung cấp LLM chậm

**Câu chuyện.** Giảng viên bấm "AI soạn bài". Màn hình báo job đang chạy (`RUNNING`) rất lâu rồi thất bại. Tài liệu PDF vừa đính kèm thì mãi hiện "đang trích nội dung" (`EXTRACTING`).

**Luồng liên quan (W6).**

```text
Giảng viên ─> gateway ─> course ─> ai ══(command)══> ai-worker ─> ai-llm-provider (LLM)
                                                         ├─> media  (đọc byte tài liệu)
                                                         └─> course (ai-context, ghi nội dung, tạo quiz)
Tài liệu: media ══(command extract)══> ai-worker; PDF và ảnh được trích qua LLM, TXT/MD đọc thẳng
```

(`─>` gọi HTTP đồng bộ, `══>` command qua RabbitMQ.)

**Cơ chế gây lỗi dự kiến.** Một **LLM stub** (nhà cung cấp LLM giả, chạy trong Compose) trả lời chậm hoặc lỗi ngắt quãng. Stub chỉnh được độ trễ/lỗi: chưa có, plan xếp vào tuần 13.

**Ground truth.** `fault_type=dependency_latency`, `root_cause_service=ai`, `root_cause_component=ai-llm-provider`. Chú ý: **chủ sở hữu** là `ai`, nhưng **tiến trình** chạm vào LLM là `ai-worker`.

**Đường lan dự kiến (catalogue).**

```text
LLM chậm ──> ai-worker giữ job lâu ──> job/tài liệu của ai treo ──> course thấy lỗi muộn (ai-worker → course)
```

**Đối chiếu code (điểm chưa kiểm chứng).** Hai giá trị mặc định trong `ai/src/config/env.schema.ts`: một lần gọi LLM tối đa `AI_COMPLETION_TIMEOUT_MS = 240000` (4 phút); lease của job `AI_WORKER_LEASE_MS = 600000` (10 phút), và lease được gia hạn trước mỗi lượt gọi model. Trong `run-job.use-case.ts`, lỗi khi chạy (kể cả lỗi gọi LLM) làm job `FAILED` với mã lỗi tương ứng; mã `WORKER_INTERRUPTED` chỉ xuất hiện khi command được giao lại trong lúc job còn `RUNNING` và lease đã hết hạn. Vậy với "stub chậm" đơn thuần, kết cục hay gặp có thể là `FAILED` với mã lỗi của lời gọi LLM, chứ không chắc là `WORKER_INTERRUPTED` như catalogue mô tả. Pilot phải xác nhận triệu chứng thật rồi sửa mô tả case cho khớp (điều kiện 2 ở mục 1.4).

**Tín hiệu nhìn thấy được.**

- Span CLIENT `ai-llm-provider POST chat/completions` dài hoặc lỗi trong trace luồng Job AI (trace này dài, đo được 37 span ở R-12).
- `lms_dependency_duration_seconds{dependency_identity="ai-llm-provider"}` tăng.
- Span CONSUMER `ai-worker--run-ai-job-v1` kéo dài.

**Vì sao truy vết thủ công tốn công hơn.**

- Triệu chứng người dùng thấy là **trạng thái** job, đọc qua request hỏi trạng thái. Request đó thường vẫn trả nhanh và thành công, chỉ có nội dung là "đang chạy" (dự kiến, chưa đo). Trace chậm nằm ở **luồng nền** của worker, không phải ở request người dùng gửi lúc nhìn thấy lỗi.
- Phải chuyển từ trace "hỏi trạng thái" sang trace "worker chạy job", trace dài nhiều chặng, có cả vòng `course → ai → ai-worker → course`.
- Bẫy chấm điểm: span chậm thuộc tiến trình `ai-worker`, nhưng đáp án là `ai`. Nếu luật "kết luận service sở hữu span" trả `ai-worker` thì trượt Top-1 theo chấm chính thức. evaluation-protocol-v1 mục 4.2 đề xuất báo thêm **owner-level Top-K** (gộp `ai` và `ai-worker`) làm số phụ; đề xuất này chờ xác nhận. RCA engine cũng phải quy đổi đúng chủ sở hữu.

**Còn thiếu.** LLM stub chỉnh được độ trễ; log có cấu trúc khi worker xử lý command (hiện worker chỉ có access log `/ready`); triệu chứng cuối cùng chưa kiểm chứng (đoạn trên). Plan v0.3 mục 9 cho phép **bỏ C3** nếu LLM stub chưa ổn định sau tuần 14 (khi phải nén lịch).

### 2.3. C4 — Tệp vừa upload biến mất vì MinIO chậm (lỗi lộ muộn)

**Câu chuyện.** Giảng viên upload ảnh bìa khóa học. Bước "hoàn tất upload" chậm hoặc báo timeout. Họ đi làm việc khác. Nửa tiếng sau quay lại: ảnh không còn, khóa học mất thumbnail.

**Luồng liên quan (W4 và W7).**

```text
W4: client ─> gateway ─> media (xin "ý định upload") ─> client đẩy thẳng file lên MinIO
         ─> media (upload-complete: kiểm kích thước + SHA-256, copy tmp/ → thư mục ngày, xóa tmp/)
         ─> media READY ══> media-worker tạo thumbnail
W7: scheduler-worker ─> media (cleanup) ─> MinIO remove-object
```

**Cơ chế gây lỗi dự kiến.** Chèn trễ hoặc ngắt kết nối giữa `media` và MinIO trong lúc upload/hoàn tất. Proxy trước MinIO: chưa có, plan xếp vào tuần 13.

**Ground truth.** `fault_type=dependency_latency`, `root_cause_service=media`, `root_cause_component=media-minio`.

**Đường lan dự kiến, đối chiếu với code.** Catalogue mô tả "media `PENDING` kẹt, usage chưa gắn, `scheduler-worker` coi là không dùng và xóa". Code cho thấy chuỗi cụ thể như sau (chưa chạy thật):

```text
MinIO chậm
  └─> upload-complete chậm/timeout ở gateway         (đợt triệu chứng 1: ngay lập tức)
       └─> media còn PENDING
            └─> gắn usage bị từ chối (usage-attacher: media chưa READY)
                 └─> job dọn media (scheduler-worker → media cleanup):
                      media PENDING quá hạn upload + thời gian ân hạn
                      → chuyển FAILED (lý do UPLOAD_ABANDONED) và xóa object trên MinIO
                                                     (đợt triệu chứng 2: muộn nhiều phút)
```

Các mốc thời gian mặc định trong `media/src/config/env.schema.ts`: hạn upload `MEDIA_UPLOAD_EXPIRES_SECONDS = 900` (15 phút), ân hạn `MEDIA_CLEANUP_PENDING_GRACE_MINUTES = 15`. Nhánh "xóa media `READY` không còn usage" thì đợi `MEDIA_CLEANUP_DEFAULT_RETENTION_HOURS = 168` giờ (tối thiểu 1 giờ; regression đặt 0 để test). Job dọn chạy theo biểu thức CRON do admin tạo, không có lịch cố định trong code. Tham số cụ thể cho case: chưa chốt.

**Tín hiệu nhìn thấy được.**

- Span `media-minio *` chậm hoặc lỗi ở cả `media` và `media-worker`; `lms_dependency_*{dependency_identity="media-minio"}` tăng.
- Trace "Dọn media theo lịch" có số lần `media-minio remove-object` bất thường.

**Vì sao truy vết thủ công tốn công hơn.** Đây là case khó nhất trong bốn.

- Đợt 1 (upload chậm) thì dễ: span `media-minio` chậm nằm ngay trong trace.
- Đợt 2 (tệp biến mất) xảy ra **nhiều phút sau**, lúc MinIO đã khỏe lại. Trace của job dọn dẹp ở thời điểm đó **trông bình thường**: nó xóa thành công, đúng việc của nó. "Hung thủ" đã rời hiện trường từ lâu.
- `scheduler` và `scheduler-worker` **không cùng trace** (worker đọc việc từ database, không có trace context nối sang). Không có sợi chỉ nào nối đợt 2 về đợt 1.
- Lý do mất tệp (`UPLOAD_ABANDONED`) được ghi vào database của `media`; telemetry chỉ thấy các lần `remove-object` thành công, không thấy lý do.

**Còn thiếu.** Proxy trước MinIO; độ trễ thật giữa đợt 1 và đợt 2 chưa đo; nối trace `scheduler` → `scheduler-worker` chưa có. Thêm một vấn đề thiết kế phép chấm: evaluation-protocol-v1 mục 7.3 yêu cầu thời gian lỗi bật phải dài hơn độ trễ triệu chứng của chính case; với C4, nếu đợt 2 đến sau 30 phút thì run phải rất dài hoặc phải rút ngắn các mốc trên. Chưa chốt.

### 2.4. C6 — Cả hệ thống lỗi 504 sau một khoảng yên lặng vì `identity` ngừng

**Câu chuyện.** Đột nhiên không ai đăng nhập được (504). Người đang dùng dở thì vẫn bấm được bình thường thêm một lúc (khoảng một phút khi test với TTL 60 giây; với cấu hình mặc định có thể tới vài phút, chưa đo). Rồi **mọi trang** báo lỗi 504 cùng lúc, kể cả trang khóa học, upload, dù `course` và `media` vẫn khỏe.

**Cơ chế gây lỗi.** `docker pause` container `identity` (đóng băng tiến trình). Khi test, đặt `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=60` (mặc định 600) để rút ngắn khoảng yên lặng.

**Vì sao có khoảng yên lặng.** Theo ADR-004, gateway giữ một service token (thẻ ra vào) để gọi các service phía sau. Code `service-token.provider.ts`: token được làm mới **ở nền** khi qua 50% thời hạn; nếu làm mới lỗi thì **tạm dùng token cũ còn hạn** (stale-while-error), chỉ khi hết hạn hẳn mới báo lỗi. Thẻ của bạn còn hạn nên bảo vệ vẫn cho qua, dù phòng cấp thẻ đã đóng cửa. Hết hạn thẻ thì không ai qua được.

**Ground truth.** `fault_type=dependency_unavailable`, `root_cause_service=identity`, `root_cause_component=identity`.

**Đường lan (đã đo).**

```text
identity bị pause
  ├─> đăng nhập: gateway ─> identity  ⟶ 504 ngay
  └─> (token người dùng còn hạn: vẫn 200)
      … 70–74 giây sau (TTL 60 giây) …
      gateway không lấy được service token mới (gateway-identity-token lỗi)
        ⟶ MỌI route qua gateway 504; request không tới service đích
      worker cũng hỏng dần khi token <worker>-identity-token của chúng hết hạn
unpause ⟶ phục hồi
```

**Tín hiệu nhìn thấy được.**

- Span CLIENT lỗi `gateway-identity-token POST /internal/v1/auth/service-token` ngay trong span gốc của gateway; trace **không có** span của service đích.
- `lms_dependency_error_count_total{dependency_identity="gateway-identity-token"}` tăng.
- Log `dependency.failure` có `span_id` khớp đúng span lỗi.

**Phát hiện 17/11/2026: service bị pause mất lô span cuối.** Khi chạy `tracing-smoke`, mọi span của `identity` trong khoảng **2 giây trước lúc pause** không tới Tempo, dù log cùng thời điểm đã vào Loki (catalogue mục 2, quy ước 5). Cách giải thích hợp lý (chưa kiểm chứng trong tài liệu): span được gom thành lô rồi gửi định kỳ, container bị đóng băng trước khi kịp gửi lô cuối. Hệ quả:

- Không được dùng "span cuối cùng của `identity`" để đoán lúc lỗi bắt đầu; `fault_start` lấy từ nhật ký của injector.
- RCA engine phải chịu được việc service gốc **im lặng** (không có span nào), thay vì phát span lỗi.
- Smoke `logs-smoke` được sửa: thử tối đa 5 log gần nhất thay vì chỉ log mới nhất (PR #73).

**Vì sao truy vết thủ công tốn công hơn, và chỗ nó lại dễ.** Nói trung thực:

- **Chỗ dễ:** đăng nhập lỗi ngay chỉ thẳng vào `identity`. Sau khoảng yên lặng, span lỗi `gateway-identity-token` nằm ngay trong trace; theo cạnh xác thực sẽ tới `identity`. `base-manual-auto` (được đi theo cạnh xác thực) nhiều khả năng tìm đúng.
- **Chỗ tốn công:** triệu chứng lan rộng ra **mọi route** cùng lúc, nhiều dashboard cùng đỏ; service nhiều lỗi nhất là `gateway` (không phải ứng viên); `identity` lại **im lặng**, không có span lỗi nào của chính nó; và đợt lỗi rộng đến **sau** lúc lỗi bắt đầu 70–74 giây. Cách "service nào bất thường nhất là thủ phạm" (Max anomaly) sẽ chỉ sai vào `gateway`.

**Còn thiếu.** Khoảng yên lặng với TTL mặc định 600 giây chưa đo; giới hạn tốc độ cho `POST /internal/v1/auth/service-token` chưa làm (evaluation-protocol-v1 mục 8.4 ghi là giới hạn). C6 mới chạy ở mức smoke, chưa phải run dataset có workload và ground truth.

---

## 3. Ba case Target: C1, C5, C7

**Ý chính:** chỉ làm khi bốn case MVP đã xong và còn thời gian (plan v0.4 tuần 21, sau mốc M4). Một case Target chỉ được chấm khi chuỗi nhân quả đã chạy thật.

| Case | Nói gọn | Vì sao chưa vào MVP |
| --- | --- | --- |
| C1 | Batch thông báo cực lớn (seed 100.000 người nhận) làm `notification-worker` dồn việc; được cho là kéo theo `media-worker` chậm, upload hoàn tất bị timeout | Chuỗi lan là **giả thuyết**: mỗi worker có queue riêng, nên `media-worker` chỉ chậm theo khi broker hoặc PostgreSQL bị tranh chấp tài nguyên. Cần cạnh "tài nguyên dùng chung" (đã xuống Target) |
| C5 | `identity-postgres` chậm lúc `notification-worker` lấy danh sách người nhận, batch thành `PARTIAL_FAILED`, thiếu người nhận, log không có lỗi | Gốc là `identity`, trùng C6; thêm vào thì xếp hạng cố định ăn điểm dễ |
| C7 | Đổi khóa ký `IDENTITY_SIGNING_KEY_PEM` mà không giữ khóa cũ; hết cache JWKS thì nhiều service trả 401 cùng lúc | Gốc là `identity`, trùng C6; cơ chế đổi khóa chưa chạy |

---

## 4. Workload: mô phỏng người dùng thật

### 4.1. Vì sao "k6 bắn request đều" chưa đủ

**Ý chính:** người thật không gõ cửa đều đặn như máy đếm nhịp. Nếu tải nền phẳng, AI học sai "thế nào là bình thường" và phép thử không giống đời thật.

Góp ý giữa kỳ yêu cầu traffic gần hành vi người dùng thật (plan v0.3 mục 0, nay là plan v0.4 mục 0.2). Người thật có những điều tải đều không có:

- **Đi theo phiên và mục tiêu:** đăng nhập, xem khóa, học vài bài, làm quiz, thoát. Thao tác sau phụ thuộc thao tác trước.
- **Có lúc nghỉ:** đọc bài vài phút rồi mới bấm tiếp.
- **Phản ứng với lỗi:** thử lại, bỏ khi chờ quá lâu, đăng nhập lại khi bị 401. Các phản ứng này **đổi tải đúng lúc có sự cố**, ví dụ ở C6 người dùng đăng nhập lại liên tục dồn thêm request vào `gateway` và `identity`.
- **Đông vắng theo giờ:** sát hạn quiz thì cao điểm. Detector phải học rằng cao điểm như vậy là **bình thường**, không báo động giả.

### 4.2. Ba mức gợi ý và lựa chọn của nhóm

| Mức | Giảng viên gợi ý | Nhóm làm? | Lý do |
| --- | --- | --- | --- |
| 1 | Giả lập **chuỗi request** theo luồng nghiệp vụ | Có | Nền tảng, dễ làm, tái lập được |
| 2 | Mô phỏng hành vi: User Profile → Goal → Behavior Model → Next Action → System Response → Update User State → Next Action | Có | Đáp ứng đúng góp ý, vẫn tái lập được nhờ seed |
| 3 | AI agent (LLM) đóng vai người dùng | Chỉ dạng **offline**, Stretch | Chạy agent trực tiếp thì chậm (~8 s mỗi bước, bản v2 của bài UXAgent, `[L-UXAgent]` https://arxiv.org/abs/2504.09407), lệch người thật (agent 6,05 so với người 15,96 thao tác/phiên, `[L-AgentAB]` https://arxiv.org/abs/2504.09723) và không tái lập được (`[L-LLMNondet]` https://arxiv.org/abs/2408.04667). Dạng offline: LLM sinh persona và nội dung **một lần**, đóng băng thành file, k6 chỉ đọc |

**Cập nhật ADR-007 (17/11/2026): thêm mức 2+.** Sau nghiên cứu, nhóm thấy mức 2 vẫn là "giả lập hoàn toàn" (xác suất chuyển là số tự đặt). Vì vậy học viên chuyển sang **mức 2+**: phát lại **phiên thật** của người học từ log Moodle công khai Unistudium 2022 (1.234 người, 208.109 sự kiện, ghi tới giây, CC BY 4.0, `[L-Unistudium]` https://zenodo.org/records/13763175). Mức 2 chỉ còn cho giảng viên, admin và job lịch. Chi tiết dễ hiểu: [`research-defense/02-semi-real-data.md`](research-defense/02-semi-real-data.md); thiết kế: `workload-design-v1.md` mục 13 (PR #78).

### 4.3. Mức 1: chuỗi request theo luồng (plan tuần 13)

> **Đã cài** ở PR #76: `aiops-platform/load/run-k6.sh level-1` (image `grafana/k6:1.3.0`), mỗi hành trình một nhóm người dùng ảo cố định; run 2 phút cho 7/7 hành trình, 737 request, 0 lỗi ngoài mong đợi.

Mỗi kịch bản k6 đi trọn một hành trình W1–W7 trên dữ liệu seed: đăng ký/đăng nhập (W1), soạn khóa học (W2), ghi danh và học (W3), upload media (W4), gửi thông báo hàng loạt (W5), AI soạn bài (W6), dọn media (W7). Ý nghĩa từng workflow ở [hướng dẫn dựng stack và workflow](06-stack-and-workflows-guide.md).

Lưu ý dữ liệu (evaluation-protocol-v1 mục 5.5): media do seeder tạo **không có tệp thật** trong MinIO, nên luồng W4 không được dùng media seed trừ khi đã tạo tệp thật.

### 4.4. Mức 2: người dùng ảo có tính cách (plan tuần 13–14)

Mỗi người dùng ảo (virtual user của k6) **giữ trạng thái riêng**: profile, mục tiêu, token, tiến độ, độ kiên nhẫn, số lỗi đã gặp. Ở mỗi bước, nó chọn việc tiếp theo dựa trên trạng thái đó.

**User Profile (tính cách).** Plan v0.3 liệt kê:

| Vai | Kiểu | Hành vi gợi ý trong plan |
| --- | --- | --- |
| Sinh viên | Chăm chỉ | Học đều, hoàn thành bài trước hạn |
| Sinh viên | Nước rút trước hạn ("nước đến chân mới nhảy") | Dồn vào sát hạn quiz, tạo cao điểm |
| Sinh viên | Xem lướt rồi bỏ dở | Mở khóa học, xem vài trang, bỏ |
| Giảng viên | — | Soạn bài, upload, dùng AI soạn bài |
| Admin | — | Gửi thông báo hàng loạt |

Mỗi profile có **tỉ lệ trong quần thể, mức kiên nhẫn, thời gian có sẵn**. Con số cụ thể: chưa chốt.

**Goal (mục tiêu).** Ví dụ trong plan: hoàn thành bài trước hạn, ôn quiz, xem lướt khóa học.

**Behavior Model (mô hình hành vi).** Một **máy trạng thái** trên các thao tác W1–W7: mỗi trạng thái là một màn hình/thao tác, mỗi mũi tên có xác suất chuyển, và xác suất **phụ thuộc mục tiêu và trạng thái** của người dùng. Ví dụ minh họa dưới đây do ghi chú này vẽ, **không phải thiết kế đã chốt**, mọi xác suất là chữ `p` chưa có số:

```text
Sinh viên "nước rút", mục tiêu: làm quiz trước hạn (minh họa)

  [Đăng nhập W1] ──> [Xem khóa đã ghi danh W3] ──p──> [Học bài W3] ──p──> [Làm quiz W3] ──> [Nộp] ──> [Thoát]
        ▲                     │                            │                   │
        │                     └──p──> [Thoát sớm]          └──p──> [Nghỉ]      └── lỗi 5xx: thử lại có giãn cách
        │                                                                          hết kiên nhẫn: bỏ dở
        └──────────── gặp 401: đăng nhập lại ─────────────────────────────────────┘
```

**Thời gian nghỉ giữa thao tác.** Theo **phân phối log-normal** (plan v0.3). Hình dung: đa số lần nghỉ ngắn, thỉnh thoảng có lần nghỉ rất dài (đi pha cà phê). Tham số phân phối: chưa chốt.

**System Response → Update User State (phản ứng khi hệ thống trả lời).** Theo plan v0.3:

| Hệ thống trả | Người dùng ảo làm gì | Trạng thái cập nhật |
| --- | --- | --- |
| Thành công | Đi bước tiếp theo theo máy trạng thái | Tiến độ tăng |
| Lỗi 5xx | Thử lại, giãn cách tăng dần giữa các lần (backoff) | Số lỗi tăng, kiên nhẫn giảm |
| Chờ quá mức kiên nhẫn | Bỏ ngang phiên | Phiên kết thúc |
| 401 | Đăng nhập lại | Token mới |

Số lần thử lại, độ giãn cách, ngưỡng kiên nhẫn: chưa chốt.

**Nhịp tải trong ngày.** Số phiên bắt đầu theo một **đường cong trong ngày**, nén một ngày còn **30–60 phút** chạy, có **cao điểm trước hạn quiz** (plan v0.3). Hình dạng đường cong cụ thể: chưa chốt.

**Tái lập và nhật ký.** Bộ sinh số ngẫu nhiên có **seed**: cùng seed thì cùng chuỗi hành động. Mỗi run **ghi nhật ký thao tác thực tế** (người dùng ảo nào làm gì, lúc nào). Seed của test cuối không được dùng lại từ train/validation (evaluation-protocol-v1 mục 5.5).

**Nguồn tham số.** Plan yêu cầu một **bảng tham số kèm nguồn** (tài liệu, dữ liệu hành vi học trực tuyến công khai). Cụ thể dùng nguồn nào: chưa chốt. Rủi ro đã ghi ở plan mục 8: tham số không có nguồn hoặc phân phối sinh ra lệch mục tiêu → mọi tham số phải có nguồn, báo cáo độ khớp phân phối.

**Kiểm tra traffic có giống thật không (plan tuần 14).** So traffic sinh ra với phân phối mục tiêu theo bốn thứ: **tỉ lệ thao tác, độ dài phiên, thời gian nghỉ, đường cong tải**. Phía AI (B) review thêm: mô hình hành vi có đủ đa dạng và đủ nhiễu nền cho detector không.

### 4.5. Các profile workload dùng khi chạy thí nghiệm

Plan v0.3 tuần 14 bắt buộc hai profile "khỏe" (không có lỗi):

- **normal mixed traffic:** một ngày bình thường, trộn mọi luồng; cũng là tải nền chạy song song với mọi case để tạo nhiễu.
- **healthy high-load spike:** tải tăng vọt nhưng không có lỗi, để đo báo động giả.

evaluation-protocol-v1 mục 5.4 còn **đề xuất** ba profile đối chứng: batch thông báo lớn khỏe (cho C1), upload media cao điểm khỏe (cho C4), job AI khỏe với LLM stub nhanh (cho C3). Mục đích: detector không được học "batch lớn = bất thường". Ba profile này chưa chốt.

### 4.6. Những gì về workload chưa chốt

Plan v0.3 và ADR-006 mới chốt **khung**; các điểm sau là **đề xuất, chưa chốt**: tỉ lệ từng profile, xác suất chuyển trạng thái, tham số log-normal, số lần thử lại và giãn cách, ngưỡng kiên nhẫn, hình dạng đường cong ngày, số người dùng ảo, nguồn dữ liệu tham số, số run khỏe mỗi profile. Tất cả nằm trong "tài liệu thiết kế workload v1", bàn giao của tuần 13 trong plan.

---

## 5. Ghép workload và case để chứng minh AI có ích

**Ý chính:** mỗi run có lỗi = tải nền giống thật + một case bật/tắt có đáp án. Trên cùng run đó, RCA engine và `base-manual-auto` cùng chẩn đoán, rồi so bằng bốn thước đo của RQ6 (ADR-006 mục 3).

```text
reset + seed ──> workload (seed cố định) ──> bật fault ──> tắt fault ──> xuất telemetry + ground truth
                                                                              │
                                    ┌─────────────────────────────────────────┴──────────────┐
                                    ▼                                                        ▼
                              RCA engine                                            base-manual-auto
                                    └──────────────> so trên cùng run <──────────────────────┘
```

| Thước đo RQ6 | Đo gì | Workload góp phần thế nào |
| --- | --- | --- |
| Độ chính xác Top-K | Engine và baseline có đặt đúng service lên đầu không | Nhiễu nền làm "service bất thường nhất" không còn trùng thủ phạm |
| Thời gian | Từ lúc incident được khai báo tới khi có kết luận đúng | — |
| Số artifact phải mở | Bao nhiêu trace, panel, truy vấn log baseline thủ công phải mở | Nhiều trace bình thường xen lẫn làm việc lọc tốn công hơn |
| Độ ổn định dưới nhiễu | Kết quả khi nhiều triệu chứng cùng lúc và có tải nền | Retry, đăng nhập lại, bỏ dở tạo triệu chứng phụ đồng thời |

Kỳ vọng trung thực theo từng case: C2 baseline thủ công tìm đúng (đối chứng); C6 baseline có thể đúng nhưng phải qua nhiều triệu chứng; C3 và C4 là nơi AI có cơ hội hơn về chi phí. Nếu AI không vượt baseline, plan mục 8 yêu cầu báo cáo trung thực theo từng case. Chi tiết engine, baseline và cách chấm: [thiết kế AI/RCA](08-ai-rca-design.md).

---

## 6. Lịch tuần 13–15 và mốc M3

**Ý chính:** ba tuần này biến thiết kế ở file này thành thứ chạy được. Chỉ bắt đầu sau khi **Gate R** đạt ([đợt tái cấu trúc](03-refactor-v1-to-v2.md), mục 7).

| Tuần (plan) | A (Đức, platform) | B (Bách, AI/dữ liệu) | Bàn giao |
| --- | --- | --- | --- |
| 13 | Tài liệu thiết kế workload (profile, goal, máy trạng thái, phản ứng lỗi, nhịp tải, bảng tham số có nguồn); k6 mức 1; LLM stub chỉnh được độ trễ/lỗi; proxy chèn trễ trước MinIO và `course-postgres` | Lớp lấy telemetry theo run và cửa sổ thời gian (truy vấn trace tuần tự vì Tempo giới hạn bộ nhớ; xuất ngay sau run vì chỉ giữ 24 giờ); từ điển dữ liệu; kiểm tra chất lượng dữ liệu (đủ 11 runtime, cờ `telemetry_silent`) | Thiết kế workload v1, k6 mức 1, pipeline xuất dữ liệu, LLM stub và proxy |
| 14 | k6 mức 2 (người dùng ảo có trạng thái, seed, nhật ký thao tác); hai profile khỏe; báo cáo kiểm chứng traffic; fault manifest và bật/tắt cho C2, C3, C4, C6 | `RunGroundTruth` tối thiểu và script đối chiếu khoảng lỗi với telemetry; triệu chứng và đường lan dự kiến cho 4 case; feature pipeline v0 (cửa sổ 60 giây, bước 15 giây) | k6 mức 2, fault manifest 4 case, schema ground truth ổn định |
| 15 | Runner: reset-and-seed → workload → bật lỗi → ghi ground truth → xuất artifact; pilot mỗi case một run cùng run khỏe, sửa tới khi cả 4 chuỗi nhân quả chạy thật; thu tập train khỏe và tập validation | Kiểm nhãn và ground truth; chia train/validation/test theo run; feature pipeline v1 có kiểm tra chống lộ đề | 4 case tái lập được, dataset v0, runbook |

**Mốc M3 — Workload, fault và dataset v0** (cuối tuần 15 của plan): workload mô phỏng hành vi người dùng, 4 case MVP tái lập được, ground truth và dataset v0. **Gate M3:** hai thành viên đổi case cho nhau, mỗi người tự chạy, reset, xuất telemetry và xác nhận ground truth.

Lưu ý lịch: plan ghi "số tuần là thứ tự công việc". Theo lịch thật hôm nay đã là tuần 16, nên "tuần 13–15" của plan sẽ rơi vào sau tuần 16. Nếu thời gian còn lại không đủ, plan mục 9 cho phép nén lịch theo thứ tự, trong đó có **gộp tuần 13 và 14 của workload** (làm mức 1 và 2 trong một tuần, chỉ giữ hai profile khỏe bắt buộc) và **bỏ C3** nếu LLM stub chưa ổn. Không được cắt ground truth, chia dữ liệu chống lộ đề, và đối chứng với `base-manual-auto`.

---

## Tóm tắt

- Case = fault + chuỗi nhân quả + ground truth. Bảy case C1–C7; chỉ C6 đã chạy thật, các case khác mới đo tín hiệu (C1 còn là giả thuyết).
- Case MVP: C2, C3, C4, C6 (bốn nguyên nhân gốc `course`, `ai`, `media`, `identity`), mỗi case 5 lần lặp, tổng 20 run có lỗi. C1, C5, C7 là Target.
- C2 viết lại thành chèn trễ `course` → `course-postgres` vì export CSV thật đọc từng khối 500 dòng; C2 là case đối chứng dễ.
- C3: chủ sở hữu `ai` khác tiến trình `ai-worker`; triệu chứng cuối (`FAILED` hay `WORKER_INTERRUPTED`) cần pilot xác nhận.
- C4 khó nhất: đợt triệu chứng thứ hai (tệp biến mất) đến muộn, trace dọn dẹp trông bình thường, scheduler và worker không cùng trace.
- C6 đã đo: đăng nhập 504 ngay, mọi route 504 sau 70–74 giây (TTL 60 giây); `identity` im lặng và mất lô span khoảng 2 giây trước pause.
- Workload: nhóm làm mức 1 (chuỗi request W1–W7) và mức 2 (người dùng ảo có profile, mục tiêu, máy trạng thái, nghỉ theo log-normal, thử lại/bỏ dở/đăng nhập lại, đường cong ngày nén 30–60 phút, seed và nhật ký); không làm mức 3 vì không tái lập được và không tạo được tải.
- Nhiều tham số workload và fault còn "đề xuất, chưa chốt"; chưa có dòng code nào cho injector, k6, dataset, RCA engine.
- Giá trị của AI được đo bằng Top-K, thời gian, số artifact phải mở và độ ổn định dưới nhiễu, so với `base-manual-auto` trên cùng run.

## Câu hỏi tự kiểm tra

1. Vì sao C2 phải viết lại, và cơ chế mới là gì?
   <details><summary>Đáp án</summary>Bản cũ nói export CSV giữ kết nối DB lâu, nhưng code export đọc từng khối 500 dòng theo keyset để không giữ truy vấn dài. Cơ chế mới là proxy chèn trễ có kiểm soát giữa `course` và `course-postgres`.</details>

2. Vì sao gọi C2 là "case đối chứng dễ", và có hại gì không?
   <details><summary>Đáp án</summary>Span chậm `course-postgres` nằm ngay trong trace của `course`, nên baseline thủ công được kỳ vọng tìm đúng. Không hại: nó làm phép so sánh trung thực; AI chỉ có thể hơn về thời gian và số thứ phải mở.</details>

3. Ở C3, vì sao luật "kết luận service sở hữu span" có thể bị chấm trượt?
   <details><summary>Đáp án</summary>Span LLM chậm thuộc tiến trình `ai-worker`, còn đáp án `root_cause_service` là `ai` (chủ sở hữu). Trả `ai-worker` thì trượt Top-1 theo chấm chính; owner-level Top-K chỉ là số phụ đề xuất.</details>

4. Điều gì làm C4 khó truy vết thủ công nhất?
   <details><summary>Đáp án</summary>Tệp biến mất nhiều phút sau khi MinIO đã khỏe lại; trace của job dọn dẹp trông bình thường; `scheduler` và `scheduler-worker` không cùng trace; lý do `UPLOAD_ABANDONED` nằm trong database chứ không trong telemetry.</details>

5. Vì sao ở C6 các trang khác vẫn chạy được khoảng một phút sau khi `identity` bị pause?
   <details><summary>Đáp án</summary>Gateway còn service token cũ chưa hết hạn và được phép dùng tiếp khi làm mới lỗi (stale-while-error). Hết hạn token (TTL 60 giây khi test) thì mọi route 504; đo được sau 70–74 giây.</details>

6. Phát hiện ngày 17/11/2026 về `docker pause` ảnh hưởng gì tới C6?
   <details><summary>Đáp án</summary>Span của `identity` trong khoảng 2 giây trước pause không tới Tempo. Vì vậy không dùng span cuối của `identity` để đoán lúc lỗi bắt đầu (lấy từ injector), và RCA engine phải chịu được service gốc im lặng.</details>

7. Vì sao nhóm không làm mức 3 (AI agent đóng vai người dùng)?
   <details><summary>Đáp án</summary>Không tái lập được (cùng đầu vào LLM có thể hành xử khác) và không tạo được tải đủ lớn (plan v0.3 mục 0, nay là plan v0.4 mục 0.2).</details>

8. Kể bốn cách người dùng ảo mức 2 phản ứng với hệ thống.
   <details><summary>Đáp án</summary>Thành công thì đi bước tiếp; 5xx thì thử lại với giãn cách tăng dần; chờ quá mức kiên nhẫn thì bỏ ngang; 401 thì đăng nhập lại.</details>

9. Làm sao biết traffic sinh ra "giống thật"?
   <details><summary>Đáp án</summary>Mọi tham số phải có nguồn, và so traffic sinh ra với phân phối mục tiêu theo tỉ lệ thao tác, độ dài phiên, thời gian nghỉ, đường cong tải (báo cáo kiểm chứng traffic ở tuần 14).</details>
