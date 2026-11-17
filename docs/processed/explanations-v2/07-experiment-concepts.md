# Thuật ngữ thực nghiệm: từ telemetry tới campaign (bản v2)

> **File này giải thích gì:** các khái niệm dùng khi chạy thí nghiệm của đồ án (telemetry, workload, fault, ground truth, scenario và case, run, repetition, manifest, campaign và chia dữ liệu, window và feature), theo đúng thứ tự chúng xuất hiện, kèm ví dụ thật của testbed v2; mục 11 giải thích các khái niệm mới của ADR-007 (workload bán thực, hold-out, bộ bằng chứng E1–E8, đăng ký trước, baseline đã công bố SimpleRCA/BARO, benchmark RCAEval). Bản này thay cho `../weekly-explanations/experiment-concepts.md`, vốn viết cho testbed v1 trước refactor (ví dụ F1 Redis, 5 fault × 3 run).
>
> **Nguồn gốc (canonical):**
>
> - [ADR-006](../adr/adr-006-trim-project-scope-v1.md) (bộ case MVP, `R = 5`, manifest tối thiểu), [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) (workload bán thực, kiểm chứng độ thực, E1–E8, đăng ký trước)
> - [plan-v0.4](../plan/plan-v0.4-24-weeks.md) (tuần 13–15 và 19, mục 9 nén lịch; thay [plan-v0.3](../plan/plan-v0.3-24-weeks.md))
> - [workload-design-v1](../architecture/workload-design-v1.md) (PR #78, chưa merge), [telemetry-data-dictionary-v2](../architecture/telemetry-data-dictionary-v2.md) (PR #79, chưa merge), [realism-and-ai-contribution-strategy-v1](../direction/realism-and-ai-contribution-strategy-v1.md) (đề xuất gốc của ADR-007)
> - [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) (mục 3, 5, 6, 7, 9, 17)
> - [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md) (mục 8, 9.1, 12, 16)
> - [complex-case-catalogue-and-rca-result-v0](../architecture/complex-case-catalogue-and-rca-result-v0.md) (mục 1, 2, 3)
> - [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md) (mục 6.2, 7, 18)
> - [backend-microservice-testbed-blueprint-v2](../architecture/backend-microservice-testbed-blueprint-v2.md) (ví dụ `experiment_id`, `run_id`)
> - Code: [`tracing-smoke.mjs`](../../../lms/test/observability/tracing-smoke.mjs) (kịch bản C6 đã chạy), [`export-courses-csv.use-case.ts`](../../../lms/services/course/src/application/use-cases/courses/export-courses-csv.use-case.ts) (lý do viết lại C2)
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> Trạng thái tại: 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge)

Các khái niệm này dễ rối vì chúng **lồng vào nhau**. Ghi chú đi theo trình tự một thí nghiệm thật: có camera (telemetry) → có người dùng giả (workload) → cố tình gây lỗi (fault) → biết chắc đáp án (ground truth) → đóng gói thành đề (scenario, case) → làm bài nhiều lần (run, repetition) → lưu hồ sơ (manifest) → tổ chức kỳ thi (campaign, chia dữ liệu) → cắt dữ liệu thành bảng cho AI (window, feature).

Hai điều cần biết trước:

- **Một phần đã có, phần lớn vẫn là thiết kế.** Tuần 13 (PR #75–#79, chưa merge) đã có công cụ gây lỗi (toxiproxy, LLM stub), workload k6 mức 1, export telemetry ra file và kiểm chất lượng. Chưa có: workload mức 2/2+, fault manifest, runner, `RunGroundTruth`, dataset, RCA engine. Về case: C6 đã chạy đủ chuỗi nhân quả một lần ở mức kiểm tra nhanh (smoke test); C2, C3, C4 mới đo được tác động trực tiếp của lỗi (ví dụ trễ thêm bao nhiêu), chưa chạy thành một run có ground truth.
- **Ví dụ xuyên suốt là C6** (`identity` bị `docker pause`), vì đây là case có chuỗi nhân quả đã đo. C2 (chèn trễ `course` → `course-postgres`) dùng để đối chiếu.

## Cách hình dung chung: một kỳ thi

| Khái niệm | Tương đương trong kỳ thi |
| --- | --- |
| RCA engine (hệ thống AI của đồ án) | **Thí sinh** |
| Telemetry | **Hồ sơ hiện trường** mà thí sinh được xem |
| Fault | **Cách ra đề**: giấu một lỗi vào hệ thống |
| Case (C1–C7) | **Một dạng đề**, có lời giải mẫu |
| Ground truth (`RunGroundTruth`) | **Đáp án niêm phong** |
| Run | **Một lần làm bài** |
| Repetition | **Làm lại cùng dạng đề** với số liệu khác |
| Healthy run | **Bài không có lỗi**: kiểm tra thí sinh có báo động bậy không |
| Pilot | **Chạy thử đề** để chỉnh độ khó trước khi thi |
| Validation / test | **Thi thử / thi thật** |
| Freeze | **Niêm phong cách chấm** trước khi mở đề thật |
| Data leakage | **Lộ đề** |
| Campaign | **Cả kỳ thi chính thức** |
| Hold-out (ADR-007) | **Đề dự trữ niêm phong**: phần log thật giữ kín, chỉ dùng để kiểm tra "đề luyện" (traffic sinh ra) có giống đề thật không |
| Đăng ký trước (ADR-007) | **Nộp barem chấm cho hội đồng trước khi mở đề**: không sửa được sau khi thấy điểm |
| SimpleRCA, BARO | **Thí sinh đối chứng đã có tên tuổi**: baseline đã công bố, không phải do nhóm tự đặt |
| RCAEval (Target) | **Thi thử ở trường khác**: chạy engine trên bộ đề công khai không do nhóm ra |

---

## 1. Telemetry: camera gắn trong hệ thống

**Ý chính:** telemetry là dữ liệu hệ thống tự phát ra khi chạy. Ba loại metric, trace, log và cách chúng được nối bằng `trace_id` đã giải thích ở [khái niệm nền](02-basic-concepts.md). Ở đây chỉ xem chúng trông thế nào trong C6.

```text
Metric : lms_dependency_error_count_total{service_name="gateway",
         dependency_identity="gateway-identity-token"}            → tăng
Trace  : span CLIENT "gateway-identity-token POST /internal/v1/auth/service-token" lỗi;
         trace không có span của service đích (request không tới course)
Log    : dependency.failure, dependency_identity=gateway-identity-token,
         span_id trùng đúng span CLIENT lỗi
```

Ba chi tiết thực tế: dữ liệu tới kho **có độ trễ** (log khoảng 2 giây, trace 2,5 giây, counter 4–10 giây), nên ô ghép tín hiệu phải ít nhất 15 giây; kho **chỉ giữ 24 giờ**, nên phải export ngay sau run; container bị `docker pause` **mất lô span khoảng 2 giây cuối** của chính nó, nên bằng chứng trực tiếp về `identity` ở C6 là **sự im lặng**, không phải span lỗi.

## 2. Workload: người dùng giả lập

**Ý chính:** không có ai dùng hệ thống thì camera không quay được gì. Workload là traffic giả do k6 tạo, đi qua `gateway` theo các luồng nghiệp vụ W1–W7.

- Theo ADR-007, traffic là **dải bốn mức**: mức 1 chuỗi request cố định (đã có ở PR #76, dùng làm mốc so sánh); mức 2 người dùng ảo có hồ sơ, mục tiêu, trạng thái, tự chọn thao tác tiếp theo (chỉ cho giảng viên, admin, job lịch); **mức 2+** phát lại **phiên học viên thật** từ log Moodle; mức 3 dạng offline (LLM sinh nội dung một lần, Stretch). Traffic trộn phiên thật với mô phỏng như vậy gọi là **bán thực**. Chi tiết ở [case và workload](09-cases-and-workload.md) mục 4 và mục 11 dưới đây.
- **Profile khỏe bắt buộc** (plan tuần 14): `normal mixed traffic` (một ngày học thường) và `healthy high-load spike` (ngày cao điểm trước hạn quiz: tải cao nhưng không có lỗi), nay dựng trên workload bán thực. Evaluation protocol đề xuất thêm ba profile đối chứng (batch thông báo lớn, upload media cao điểm, job AI) nhưng chưa bắt buộc.
- **Mọi fault run đều có workload chạy song song** để tạo nhiễu nền, giống hệ thống thật đang có người dùng.

Hai loại "seed" dễ nhầm: **workload seed** là số khởi tạo phần ngẫu nhiên của k6 (cùng seed thì cùng chuỗi thao tác, chạy lại ra kết quả giống nhau); **dữ liệu seed** là các dòng nạp sẵn vào database bằng SQL (R-10, id bắt đầu `5eed`), chỉ tạo quy mô dữ liệu, không tạo trace, log hay command nào.

## 3. Fault injection: cố tình gây lỗi

**Ý chính:** nhóm chủ động làm hỏng một chỗ, đúng lúc mình chọn, để biết chắc thủ phạm. Fault phải mặc định tắt, bật/tắt được, tái lập được và **không sửa code nghiệp vụ**.

Fault của C6 (mã FG), ghi theo các trường của ground truth:

```text
fault_id          : FG
fault_type        : dependency_unavailable   (một phụ thuộc không dùng được)
fault_target      : identity
fault_target_kind : service
fault_parameters  : injection_mode = pause            (docker pause container identity)
                    IDENTITY_SERVICE_TOKEN_TTL_SECONDS = 60   (thời hạn token dịch vụ, gọi tắt TTL;
                                                               mặc định 600, rút ngắn khi test)
                    TTL cache JWKS (mặc định 5 phút)
fault_start       : lúc pause      ┐ lấy từ bộ điều khiển fault,
fault_end         : lúc unpause    ┘ không suy ra từ telemetry
```

Lỗi lan như sau (đã đo bằng `tracing-smoke`):

```text
pause identity ──► đăng nhập lỗi 504 ngay
               ──► request có token còn hạn vẫn trả 200       ← "khoảng yên lặng"
               ──► 70–74 giây sau (TTL 60 giây): token dịch vụ của gateway hết hạn,
                   không xin được token mới
               ──► MỌI route qua gateway lỗi 504, dù course, media vẫn khỏe
unpause        ──► hệ thống hồi phục
```

Khoảng yên lặng có vì cơ chế "khi lấy token mới bị lỗi thì tạm dùng token cũ còn hạn". Con số 70–74 giây là **một lần đo**, chưa phải giá trị chốt.

Fault của C2 (viết lại theo ADR-006): đặt một proxy trước `course-postgres` và chèn trễ có kiểm soát; `fault_type = dependency_latency`. Bản cũ ("export CSV giữ kết nối DB") bị bỏ vì không khớp code: export đọc từng khối 500 dòng (`EXPORT_CHUNK_SIZE = 500`) để không giữ truy vấn dài. Proxy đã có ở tuần 13 (toxiproxy, proxy `course-to-postgres`, PR #75): trễ 200 ms làm `GET /api/v1/courses` từ trung vị 2 ms lên 204 ms, gỡ ra thì về 3 ms. Chưa chạy thành một run có workload và ground truth.

Bộ điều khiển fault (`fault-control.mjs`) in **một dòng JSON có giờ UTC** cho mỗi lệnh bật/tắt. Đó chính là nguồn của `fault_start`, `fault_end` sau này.

**Lỗi trùng cao điểm tải (ADR-007):** mỗi case MVP có ít nhất một run test đặt fault đúng lúc tải bán thực lên đỉnh (ví dụ trễ DB đúng giờ học viên dồn vào làm quiz trước hạn). Khi đó tải cao hợp lệ lẫn với sự cố, nhiều triệu chứng cùng lúc: đúng chỗ ngưỡng cố định và cách "lần theo trace chậm nhất" dễ sai.

## 4. Ground truth: đáp án niêm phong

**Ý chính:** vì tự tay gây lỗi nên nhóm biết chắc đáp án. Đáp án của mỗi run nằm trong `RunGroundTruth`, một bản ghi **bất biến** (ghi xong không sửa) chép lại điều thực sự đã xảy ra. Ngoài đời không có đáp án này; đó là lý do đồ án phải dựng testbed.

ADR-006 chỉ yêu cầu **các trường bắt buộc** của `RunGroundTruth`; các tầng manifest khác làm khi còn thời gian. Theo plan tuần 14, Bách là người giữ ground truth: viết `RunGroundTruth` tối thiểu và script đối chiếu khoảng fault với telemetry.

| Nhóm trường | Trường bắt buộc | Ghi chú |
| --- | --- | --- |
| Định danh lần chạy | `ground_truth_schema_version`, `scenario_id`, `run_id`, `repeat_index`, `run_status`, `run_start`, `run_end` | `run_status` là `valid`, `invalid` hoặc `failed` |
| Workload | `workload_profile`, `workload_seed`, `workload_parameters`, `workload_start`, `workload_end` | Healthy run cũng phải có đủ |
| Fault | `fault_id`, `fault_type`, `fault_target`, `fault_target_kind`, `fault_intensity`, `fault_parameters`, `fault_start`, `fault_end` | Healthy run: `fault_type = none`, còn lại để trống |
| Đáp án RCA | `root_cause_service`, `root_cause_component`, `expected_symptom`, `expected_propagation_path`, `expected_evidence` | Healthy run: để trống hoặc ghi kỳ vọng "khỏe" |
| Tùy chọn cho lỗi xác thực | `expected_symptom_services`, `expected_symptom_lag` | Chỉ FG, FH. C6: triệu chứng ở `gateway`, độ trễ tính từ TTL |

Hai nhóm còn lại (kết quả bật/tắt/reset/kiểm tra, và nguồn gốc code như `code_commit`, `service_versions`) không có cột "bắt buộc" trong bảng của tài liệu, nhưng cần để quyết định `run_status` và để chạy lại được.

Đáp án của C6:

```text
root_cause_service        = identity     ← đáp án chính để chấm
root_cause_component      = identity     ← chi tiết hơn, chỉ làm bằng chứng
expected_propagation_path = identity → gateway-identity-token → gateway
expected_symptom_services = [gateway]
```

Ba quy tắc chống sai:

- **`fault_start` không suy từ bất thường đầu tiên**, càng không từ "span cuối cùng của `identity`" (đã mất khi pause).
- **Chống lộ đề:** detector, RCA engine và baseline thủ công **không được nhận** `fault_type`, `fault_target`, `root_cause_*`, `expected_*`, `scenario_id`, `case_id`; tên run hay tên fault không được nằm trong header, label hay payload.
- **Fault không gây ra triệu chứng thì run là `invalid`** (với C6: kiểm tra triệu chứng có xuất hiện trong khoảng trễ kỳ vọng), không bị tính nhầm là "AI trượt".

## 5. Scenario và case: dạng đề

**Ý chính:** fault là **cơ chế gây lỗi** (FA–FH). Case là **kịch bản + chuỗi nhân quả + đáp án** dùng để chấm (C1–C7). Scenario là "công thức" một lần chạy: workload nào, fault nào, bật/tắt lúc nào.

- `scenario_id` mang mã fault (ví dụ `FG`) hoặc mã scenario khỏe.
- `case_id` suy ra từ `scenario_id` (FG → C6), không cần trường mới.

Bốn case MVP theo ADR-006 (ba case Target C1, C5, C7 chỉ vào đánh giá khi chuỗi nhân quả đã chạy thật):

| Case | Cơ chế | `root_cause_service` | `root_cause_component` | Trạng thái |
| --- | --- | --- | --- | --- |
| C2 | Chèn trễ `course` → `course-postgres` (viết lại) | `course` | `course-postgres` | Có injector (PR #75), đã đo độ trễ thêm; chưa chạy thành run |
| C3 | LLM stub chậm hoặc lỗi ngắt quãng (FD) | `ai` | `ai-llm-provider` | Có LLM stub (PR #75); đo: trễ 2000±500 ms → job vẫn `COMPLETED`; lỗi 100% → `FAILED` `AI_PROVIDER_ERROR` |
| C4 | Chèn trễ hoặc ngắt MinIO (FA) | `media` | `media-minio` | Có proxy phía `media`/`media-worker` (PR #75); đo: trễ 300 ms → đọc nội dung chậm ~0,6 s; chuỗi `PENDING` → `UPLOAD_ABANDONED` chưa chạy |
| C6 | Pause `identity` (FG) | `identity` | `identity` | **Đã chạy** chuỗi nhân quả (smoke) |

Bốn case có bốn đáp án khác nhau, nên một cách xếp hạng "đoán bừa cố định" khó ăn điểm hơn. Mô tả chi tiết từng case ở [case và workload](09-cases-and-workload.md).

## 6. Run: một lần chạy thật

**Ý chính:** run là một lần thực thi scenario từ đầu đến cuối, sinh ra một bộ telemetry thật. Một fault run C6 trông như sau:

```text
 reset+seed   warm-up    khỏe (pre-fault)     FAULT ACTIVE (identity bị pause)                  recovery
 ────┼───────────┼───────────┼═════════╤═══════════════════════════════════╤═════════┼─────────────┼──► t
     │ dọn sạch, │ bỏ qua,   │ báo động│ login 504 ngay; request có token  │ token   │ unpause,    │
     │ nạp seed  │ không chấm│ ở đây   │ còn hạn vẫn 200 (khoảng yên lặng) │ hết hạn:│ quan sát    │
     │           │           │ = báo   │                                   │ mọi     │ hồi phục    │
     │           │           │ nhầm    │                                   │ route   │             │
     │           │           │         │◄──── 70–74 giây (TTL 60) ────────►│ 504     │             │
                             fault_start                                          fault_end
              k6 bắn traffic suốt quá trình (nhiễu nền)
```

Reset + seed giúp run này không bị run trước ảnh hưởng; warm-up bỏ qua vì số liệu lúc khởi động còn lộn xộn; báo động ở pha khỏe là **báo nhầm** (false positive). Healthy run không có pha fault. Thời lượng từng pha **chưa chốt**; pilot sẽ đo rồi niêm phong. Quy tắc quan trọng: thời gian fault active phải **dài hơn độ trễ triệu chứng của chính case đó** cộng window và số bước kéo dài; nếu không, triệu chứng chưa kịp xuất hiện và run bị tính trượt do thiết kế đề chứ không do AI.

## 7. Repetition và experiment

**Ý chính:** chạy cùng một dạng đề nhiều lần (mỗi lần một seed khác) để chứng minh kết quả tốt không do may mắn.

- `repeat_index`: lần lặp thứ mấy, từ 1 tới `R`. ADR-006 chọn **`R = 5`** cho mỗi case MVP.
- `experiment_id`: nhóm các run cùng một họ thí nghiệm. `run_id`: một lần chạy cụ thể, **không bao giờ dùng lại**; chạy lại là run mới.

Ví dụ định dạng trong backend blueprint v2 (minh họa, định dạng thật chưa chốt):

```text
experiment_id : exp-media-minio-latency
run_id        : exp-media-minio-latency-r03     ← lần chạy thứ 3 của họ này
```

Quan hệ: **1 case → 1 scenario → 1 experiment → 5 run**.

## 8. Manifest và artifact: hồ sơ của mỗi run

**Ý chính:** manifest là "lý lịch" giúp chạy lại ra đúng kết quả; artifact là các file run sinh ra.

Tài liệu v2 tách nhiều tầng hồ sơ: `RunGroundTruth` (điều thực sự xảy ra, kèm đáp án), `TelemetryArtifactManifest` (gói telemetry đã export), `TelemetryQualityReport` (phiếu kiểm tra chất lượng), `EvaluationInstanceManifest` (một lần chấm cụ thể). Ở MVP chỉ **`RunGroundTruth` với các trường bắt buộc** là phải có (ADR-006). Tuần 13 đã cài hai tầng: `manifest.json` (theo `TelemetryArtifactManifest`) và `quality-report.json` (theo `TelemetryQualityReport`), PR #77 và #79; `RunGroundTruth` làm ở tuần 14; tầng còn lại làm khi còn thời gian.

Ba loại artifact: **telemetry artifact** (metric, trace, log export ra, tức "đoạn phim camera"; từ tuần 13 là ba file Parquet trong `artifacts/<run_id>/`, xem [`05-observability.md`](05-observability.md) mục 10.5), **prediction artifact** (`RcaIncidentResult` cho mỗi incident, tức "bài làm"), **evaluation artifact** (điểm sau khi so với đáp án, tức "bảng điểm").

Vì đã lưu "đoạn phim", có thể **chấm một run theo nhiều cách mà không chạy lại testbed**: chỉ metric, metric + trace, metric + trace + log, có/không graph, hay baseline thủ công; và các bản bị **cắt bớt** của E3 (giữ 50% hoặc 10% trace, log mất `trace_id`, mất một nguồn). Giống cho nhiều thí sinh xem cùng một đoạn phim, hoặc cho một thí sinh xem bản bị cắt bớt.

## 9. Campaign và chia dữ liệu: kỳ thi chính thức

**Ý chính:** campaign là đợt chạy đầy đủ để lấy số liệu chính thức cho báo cáo. Với 4 case và `R = 5`: **4 × 5 = 20 fault run**.

| Tập | Gồm những run nào | Dùng để | Tương đương |
| --- | --- | --- | --- |
| **train** | Chỉ healthy run, mỗi profile ít nhất một run | Học "bình thường" trông thế nào: chuẩn hóa, trung vị/MAD, Isolation Forest | Học bài |
| **validation** | 4 fault run (`repeat_index = 1` của mỗi case) + healthy run (normal mixed, high-load spike) | Chọn ngưỡng, window, trọng số, luật của baseline thủ công | Thi thử |
| **test** | 16 fault run (`repeat_index = 2..5`, mỗi case ít nhất một run lỗi trùng cao điểm tải) + healthy run với seed và đoạn log Moodle **chưa dùng** | **Chỉ để chấm**, cấm chỉnh gì thêm | Thi thật |

Trước validation còn có **pilot**: mỗi case một run cùng run khỏe, để đo độ trễ lan truyền và chốt thời lượng, cường độ lỗi. Run pilot đã dùng để chỉnh thì không được tính vào điểm cuối. Số healthy run cho mỗi tập chưa chốt (tối thiểu "ít nhất một" mỗi profile).

Bốn quy tắc chống lộ đề:

- **Chia theo run, không theo ô thời gian:** các ô chồng nhau rất giống nhau, để ô 00:15 ở train và ô 00:30 ở test là đã thấy đề trước.
- **Fault run không dùng để học "bình thường"**, cũng không dùng để huấn luyện mô hình có nhãn (phần đó là Stretch).
- **Niêm phong và đăng ký trước khi thi thật** (plan tuần 19, ADR-007 mục 4): giả thuyết E1–E5, ngưỡng, trọng số, window, luật baseline, seed, cường độ fault, cách tính khoảng tin cậy được **commit vào repo trước** khi chạy run test; xem điểm test rồi quay lại chỉnh là vi phạm, mọi thay đổi bắt buộc phải thành phiên bản mới kèm lý do.
- **Gặp bug thật** thì tăng version và chạy lại **toàn bộ** phần bị ảnh hưởng, không chỉ case điểm xấu.

Trước refactor (v1) dùng 5 fault × 3 run = 15 fault run; v2 ít case hơn nhưng nhiều lần lặp hơn để thấy kết quả dao động trong từng case. Mỗi case chỉ có 4 run test nên báo cáo theo từng case. ADR-007 thêm: luôn kèm **khoảng tin cậy 95% bằng bootstrap** (lấy mẫu lại nhiều lần để ước lượng độ dao động) và **kiểm định ghép cặp McNemar** (so engine với baseline trên cùng các incident: bao nhiêu incident chỉ một bên đúng); mẫu nhỏ nên **không tuyên bố "có ý nghĩa thống kê"** khi không đạt. Biến thể cường độ/thời điểm để tăng lên 32–40 incident test là Target. Nếu trễ lịch, plan cho phép giảm `R` xuống 4 và ghi rõ trong báo cáo.

## 10. Từ telemetry đến bảng cho AI: window và feature

**Ý chính:** AI không đọc từng trace hay từng dòng log. Telemetry được cắt thành **ô thời gian 60 giây, trượt mỗi 15 giây** (giá trị khởi điểm, chốt sau pilot), giống mỗi 15 giây chụp một "ảnh tóm tắt" của một phút gần nhất. Mỗi cặp (service, ô) thành một dòng trong bảng; mỗi cột là một **feature**.

Bảng minh họa C6 (chỉ ghi xu hướng, **không phải số đo**):

| Ô thời gian | Service | `http_error_rate` | `dep_error_rate_max` | `telemetry_silent` |
| --- | --- | --- | --- | --- |
| Trước fault | `gateway` | thấp | thấp | không |
| Trước fault | `identity` | thấp | thấp | không |
| Ngay sau pause | `gateway` | tăng ở route đăng nhập | tăng ở cạnh tới `identity` | không |
| Ngay sau pause | `identity` | "đứng yên" (series cũ còn ~5 phút, không tăng) | "đứng yên" | **có** |
| Sau khi token hết hạn | `gateway` | **tăng trên mọi route** | **tăng ở `gateway-identity-token`** | không |

Ba điều cần nhớ:

- **"Không có dữ liệu" khác "bằng 0", và "có mẫu" chưa chắc "còn sống".** `identity` im lặng không có nghĩa là khỏe. Đo ở tuần 13: khi runtime ngừng, Prometheus vẫn có mẫu của nó thêm khoảng 5 phút với giá trị đứng yên, nên feature phải nhìn **mức tăng** của bộ đếm, không nhìn "có mẫu hay không". Cờ `telemetry_silent` đã cài trong kiểm chất lượng (PR #79), dựa vào bộ đếm CPU không tăng hơn 30 giây; đã thử với `scheduler`, chưa thử với `identity`. Worker không có API nghiệp vụ nên feature HTTP của worker là "không áp dụng", không phải 0; log của worker là `not_instrumented`.
- **Còn một bảng theo cạnh** (`EdgeWindowFeature`) cho mỗi cặp bên gọi → bên được gọi: số lời gọi, tỷ lệ lỗi, độ trễ, thời điểm lỗi đầu tiên. Cạnh `gateway-identity-token` là nơi C6 lộ ra rõ nhất.
- Đây mới là dữ liệu mà detector và RCA engine thật sự xử lý. Cách dùng bảng này ở [thiết kế phần AI/RCA](08-ai-rca-design.md).

---

## 11. Khái niệm mới từ ADR-007

**Ý chính:** ADR-007 (17/11/2026) thêm hai nhóm khái niệm: nhóm "dữ liệu có giống thật không" và nhóm "bằng chứng AI có ích". Giải thích kỹ hơn, kèm bài báo gốc: [`research-defense/`](research-defense/README.md).

### 11.1. Workload bán thực và log Moodle

- **Bán thực** = phần học viên lấy từ **hành vi thật** (phát lại phiên trong log), phần còn lại mô phỏng. "Phát lại" nghĩa là giữ nguyên thứ tự thao tác và thời gian nghỉ giữa các thao tác của một người thật trong một phiên, chỉ đổi tài khoản thật sang tài khoản seed.
- **Nguồn:** log Moodle Unistudium 2022 của Đại học Perugia (Franzoni, Biondi, Milani; `[L-Unistudium]`, https://zenodo.org/records/13763175, giấy phép CC BY 4.0): 1 234 người dùng, 208 109 sự kiện, 45 loại sự kiện chuẩn của Moodle, 4 khóa, 91 ngày, thời gian tới từng giây. Moodle là một LMS thật nên sự kiện của nó (xem khóa, xem bài, làm quiz, nộp tệp) ánh xạ được sang endpoint của testbed; ước tính sơ bộ khoảng 90,6% số dòng ánh xạ được. Log không commit vào repo; repo có script tải và kiểm sha256.
- **Nén lịch:** chỉ nén **lịch bắt đầu phiên** (một ngày còn 48 phút), không nén thời gian nghỉ bên trong phiên. Thời điểm bắt đầu phiên theo Poisson có tốc độ đổi theo giờ (Paxson & Floyd 1995, `[L-PaxsonFloyd]`, https://www.icir.org/vern/papers/poisson.TON.pdf). Phần cần sinh thêm dùng ma trận chuyển **học từ log**, theo cách của WESSBAS (Vögele et al. 2018, `[L-WESSBAS]`, https://pmc.ncbi.nlm.nih.gov/articles/PMC5910480/).
- Vì sao không dùng OULAD để phát lại: OULAD chỉ có tổng click mỗi ngày (Kuzilek et al. 2017, `[L-OULAD]`, https://pmc.ncbi.nlm.nih.gov/articles/PMC5704676/); nó vẫn được dùng để kiểm tra vĩ mô và làm nguồn tham số cho mức 2.

### 11.2. Hold-out và ba nguồn tải

- **Hold-out:** chia log thành phần **xây** (dùng để dựng workload) và phần **giữ lại** (không bao giờ dùng để chỉnh tham số). Giống ôn thi bằng đề cũ nhưng giữ riêng một bộ đề để tự kiểm tra cuối cùng.
- **So ba nguồn tải** bằng cùng một bộ đo: mức 1 (tốc độ đều, kiểu benchmark cũ), mức 2 thuần giả định, và bán thực. Chỉ kết luận "giống thật" khi bán thực **gần hold-out nhất**.
- **Đo gì:** số thao tác mỗi phiên, độ dài phiên, thời gian nghỉ, tỉ lệ loại thao tác, hình dạng theo giờ, tỉ số đỉnh/trung bình, độ "dồn cục" (burst).
- **Hai thước đo khoảng cách** (chỉ cần hiểu ý): **KS D** là khoảng cách lớn nhất giữa hai đường "tỉ lệ cộng dồn" (0 = trùng khít); **JSD** (Jensen–Shannon) đo hai bảng tỉ lệ (ví dụ tỉ lệ loại thao tác) khác nhau bao nhiêu (0 = giống hệt). Ngưỡng **chốt trước khi đo**: JSD < 0,05; KS D < 0,1; trung vị lệch < ±10%. Không đạt thì báo đúng số đo, không đổi ngưỡng.

### 11.3. Bộ bằng chứng E1–E8

| # | Bằng chứng | Hỏi gì | Mức |
| --- | --- | --- | --- |
| E1 | Phát hiện dưới tải bán thực: detector học máy so với ngưỡng cố định | Ngưỡng cố định có báo động giả lúc cao điểm khỏe không? Detector phát hiện sớm hơn không? | MVP |
| E2 | Bảng chính: engine so với random, xếp hạng hằng, ngưỡng tĩnh, `base-manual-auto`, SimpleRCA, BARO | Engine có chỉ đúng thủ phạm hơn các mốc không, theo từng case? | MVP |
| E3 | Quan sát suy giảm: giữ 50% và 10% trace, log mất `trace_id`, mất một nguồn (thay RQ4 cũ chỉ "bỏ 50% trace") | Khi camera bị thiếu, ai giữ được độ chính xác? | MVP |
| E4 | Chi phí chẩn đoán: số trace/panel/truy vấn log `base-manual-auto` phải mở, thời gian | "Hỗ trợ" có thật sự giảm công sức không? | MVP |
| E5 | Ablation: bỏ từng nguồn dữ liệu, bỏ graph, bỏ thời gian, thay detector bằng z-score | Thành phần nào thật sự đóng góp? | MVP |
| E6 | Chạy engine trên benchmark công khai RCAEval RE2 (Online Boutique, Train Ticket) | Engine có chỉ khớp với lỗi do chính nhóm ra đề không? | Target |
| E7 | Thử nghiệm người: mỗi người 4 incident, nửa dùng Grafana thủ công, nửa có báo cáo engine | Người thật có nhanh hơn, đúng hơn không? | Target |
| E8 | Case study C6: chuỗi bằng chứng của engine cạnh đường truy vết thủ công | Kết quả có giải thích được không? | MVP |

### 11.4. Baseline đã công bố và benchmark công khai

- **SimpleRCA** (Fang et al. 2025, `[L-Fang2025]`, https://arxiv.org/abs/2510.04711): luật rất đơn giản, đếm cảnh báo theo service (metric vượt 3-sigma hoặc P95, trace chậm gấp 3 lần mức thường, log có từ khóa lỗi), service nhiều cảnh báo nhất xếp đầu. Nó thắng các phương pháp mới nhất trên 7/11 bộ dữ liệu (Top@1).
- **BARO** (Pham et al., FSE 2024, `[L-BARO]`, https://arxiv.org/abs/2405.09330): tìm thời điểm dữ liệu đổi trạng thái rồi xếp hạng bằng phép kiểm đơn giản; chạy khoảng 0,01 giây mỗi case mà vẫn cạnh tranh (Pham et al., ASE 2024, `[L-Pham2024ASE]`, https://arxiv.org/abs/2408.13729).
- **RCAEval** (Pham et al., WWW 2025 Companion, `[L-RCAEval]`, https://arxiv.org/abs/2412.17015, mã nguồn https://github.com/phamquiluan/RCAEval): bộ đề công khai 735 case trên ba hệ thống mẫu; phần RE2 có đủ metric, log, trace. Dùng để **kiểm tra khả năng tổng quát**, không phải để xếp hạng; trước tiên tái lập số của BARO để chắc pipeline đọc dữ liệu đúng.

### 11.5. Thử nghiệm người (E7)

**Within-subject** = mỗi người làm **cả hai** điều kiện (có và không có báo cáo engine), đổi thứ tự giữa các người để cân bằng; nhờ vậy so được ngay trên cùng một người, cần ít người hơn. Đo thời gian, đúng/sai, số thứ đã mở, mức tải công việc (NASA-TLX rút gọn, `[L-NASA-TLX]`, https://en.wikipedia.org/wiki/NASA-TLX) và độ dễ dùng (SUS, `[L-SUS]`, https://measuringu.com/sus/). Mẫu tham khảo: LogAssist (IEEE TSE 2022 (online 2021), `[L-LogAssist]`, https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf), 19 người, thời gian giảm 42,49% nhưng chỉ 2/6 task có ý nghĩa thống kê vì mẫu nhỏ. Đồ án nhắm 6–10 người nếu tìm được, không thì 2–3 người chỉ minh họa định tính; chốt người tham gia trước tuần 15 của plan.

---

## Ghép tất cả lại

```text
Case C6 (dạng đề) = fault FG (pause identity, TTL 60) + workload bán thực (mức 2+ / mức 2) + thời điểm bật/tắt
        │
        ▼  chạy 5 lần (repeat 1..5) → 5 run, mỗi run một run_id và workload seed riêng
        │
  Mỗi run: reset+seed → warm-up → khỏe → FAULT → recovery   (k6 chạy suốt, OTel thu telemetry)
        │
        ├─► RunGroundTruth (đáp án niêm phong: root_cause_service = identity)
        └─► Telemetry artifact (export ngay, vì kho chỉ giữ 24 giờ)
                 │
                 ▼  cắt window 60s/15s → feature → detector → incident → xếp hạng nghi phạm
        RcaIncidentResult ("nghi phạm: 1. identity, ...")
                 │
                 ▼  mở đáp án, so sánh
        Evaluation artifact (Top-1 đúng hay sai, phát hiện sau bao nhiêu giây, ...)

Làm như vậy cho C2, C3, C4, C6 (20 fault run) + healthy run,
chia train / validation / test theo run → đăng ký trước → Campaign → số liệu E1–E8 cho báo cáo
```

## Tóm tắt

- Thứ tự cần nhớ: telemetry → workload → fault → ground truth → scenario/case → run → repetition → manifest → campaign → window/feature.
- Fault là cơ chế gây lỗi (FA–FH); case là kịch bản kèm đáp án (C1–C7). MVP có 4 case C2, C3, C4, C6 với 4 đáp án khác nhau; C6 đã chạy đủ chuỗi nhân quả (smoke), C2/C3/C4 đã có công cụ gây lỗi và số đo tác động trực tiếp (tuần 13), chưa chạy thành run có ground truth.
- `RunGroundTruth` là đáp án niêm phong, bất biến; MVP chỉ cần các trường bắt buộc. Bách giữ phần ground truth theo plan.
- `fault_start` lấy từ bộ điều khiển fault (dòng JSON có giờ UTC của `fault-control.mjs`), không suy từ telemetry; mọi trường đáp án bị cấm làm đầu vào của AI.
- C6 có khoảng yên lặng 70–74 giây (TTL 60) giữa lúc gây lỗi và lúc triệu chứng lan rộng; thời gian fault active phải dài hơn khoảng này.
- `R = 5`: 4 run validation (`repeat_index = 1`) và 16 run test (`repeat_index = 2..5`), cộng healthy run; train chỉ gồm healthy run.
- Chia theo run, niêm phong trước khi thi thật, không chỉnh sau khi xem điểm test.
- Window 60 giây bước 15 giây là giá trị khởi điểm; "không có dữ liệu" phải được đánh dấu riêng, không điền 0; runtime ngừng vẫn có mẫu "đứng yên" ~5 phút nên phải nhìn mức tăng của bộ đếm.
- ADR-007: workload bán thực (phiên học viên thật từ log Moodle), kiểm chứng bằng hold-out so ba nguồn tải với ngưỡng chốt trước; bằng chứng E1–E8 (MVP: E1–E5, E8; Target: E6 RCAEval, E7 thử nghiệm người); baseline đã công bố SimpleRCA, BARO; đăng ký trước ở tuần 19; luôn kèm khoảng tin cậy bootstrap.

## Câu hỏi tự kiểm tra

1. Fault và case khác nhau thế nào? Cho ví dụ với C6.

<details><summary>Đáp án</summary>
Fault là cơ chế gây lỗi bật/tắt được (FG: pause <code>identity</code>). Case là kịch bản gồm cơ chế, chuỗi nhân quả và đáp án dùng để chấm (C6: pause <code>identity</code> → gateway lỗi 504 hàng loạt sau khoảng yên lặng, đáp án <code>identity</code>).
</details>

2. Vì sao không lấy thời điểm span cuối cùng của `identity` làm `fault_start` cho C6?

<details><summary>Đáp án</summary>
Vì container bị pause mất lô span khoảng 2 giây cuối của chính nó. Hơn nữa <code>fault_start</code> luôn lấy từ bộ điều khiển fault, không bao giờ suy từ telemetry.
</details>

3. Với `R = 5` và 4 case MVP, có bao nhiêu fault run ở validation và ở test?

<details><summary>Đáp án</summary>
20 fault run: 4 ở validation (<code>repeat_index = 1</code> của mỗi case), 16 ở test (<code>repeat_index = 2..5</code>).
</details>

4. Tập train gồm những run nào, và vì sao không có fault run?

<details><summary>Đáp án</summary>
Chỉ healthy run. Train dùng để học "bình thường" trông thế nào (chuẩn hóa, trung vị/MAD, Isolation Forest); đưa dữ liệu lúc có lỗi vào sẽ làm sai khái niệm "bình thường".
</details>

5. Vì sao phải chia dữ liệu theo run chứ không theo ô thời gian?

<details><summary>Đáp án</summary>
Các ô 60 giây trượt 15 giây chồng lên nhau nên rất giống nhau. Nếu ô của cùng run nằm ở cả train và test thì AI đã "thấy đề trước" (lộ đề).
</details>

6. Nếu thời gian fault active của C6 ngắn hơn khoảng yên lặng thì chuyện gì xảy ra?

<details><summary>Đáp án</summary>
Triệu chứng chưa kịp lan ra mọi route trong khoảng được chấm, nên run bị tính trượt do thiết kế đề chứ không do AI. Vì vậy pilot phải đo độ trễ và chốt thời lượng fault đủ dài.
</details>

7. Vì sao lưu telemetry artifact lại quan trọng cho E3 (thay RQ4 cũ)?

<details><summary>Đáp án</summary>
Vì có thể tạo các bản bị cắt bớt (giữ 50% hoặc 10% trace, log mất <code>trace_id</code>, mất một nguồn) từ chính đoạn telemetry đó rồi chấm lại, so sánh cặp trên cùng run và cùng đáp án mà không phải chạy lại testbed.
</details>

8. Hold-out là gì, và vì sao không được dùng nó để chỉnh tham số workload?

<details><summary>Đáp án</summary>
Là phần log Moodle thật được giữ riêng, chỉ dùng để so với traffic sinh ra. Nếu dùng nó để chỉnh tham số thì traffic "giống hold-out" là do đã nhìn đáp án, không còn chứng minh được traffic giống người thật.
</details>

9. Vì sao phải so ba nguồn tải (mức 1, mức 2 thuần, bán thực) chứ không chỉ đo bán thực?

<details><summary>Đáp án</summary>
Một con số đứng một mình không nói được "gần" hay "xa". Khi cả ba cùng được đo bằng một bộ chỉ số và so với hold-out, kết luận "giống thật" chỉ đứng được nếu bán thực gần hold-out nhất, tức là việc dùng log thật thật sự tạo khác biệt.
</details>

10. Đăng ký trước chống được nghi ngờ nào?

<details><summary>Đáp án</summary>
Nghi ngờ "tự ra đề tự chấm": giả thuyết, cấu hình engine và baseline, ngưỡng, cách tính được commit trước khi chạy run test, nên không thể chỉnh sau khi thấy kết quả để engine thắng.
</details>
