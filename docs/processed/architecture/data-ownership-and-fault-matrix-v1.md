# Data ownership, dependency strategy và fault matrix MVP v1

> **Task:** `task-03_define-data-ownership-and-fault-matrix`
>
> **Trạng thái:** **Final cross-check với W4-T4** — ownership/dependency boundary và fault semantics đã được đồng bộ với telemetry/ground-truth schema v0; artifact sẵn sàng review/merge theo workflow task.
>
> **Vị trí canonical dự kiến:** `docs/processed/architecture/data-ownership-and-fault-matrix-v1.md`
>
> **Mục đích:** chốt ownership của PostgreSQL/Redis/RabbitMQ/Storage Mock, quy tắc truy cập dependency và fault matrix MVP sao cho mỗi fault controllable, reproducible, observable, có service-level ground truth rõ và có thể ánh xạ sang telemetry/RCA/evaluation mà không mở rộng scope LMS.

---

# 1. Source of truth và ranh giới artifact

Artifact này phải nhất quán với:

1. `service-catalogue-and-topology-v1.md` — service/dependency identity và edge catalogue.
2. `http-and-event-contracts-v1.md` — published HTTP/event boundary, timeout/error semantics và `grade.completed`.
3. `backend_microservice_testbed_blueprint.md` — architecture, workload/fault/experiment boundary và năm fault canonical.
4. `analysis-anomaly-rca-blueprint.md` — service-level RCA, feature/evidence và dynamic graph.
5. `telemetry-and-ground-truth-schema-v0.md` — `RunGroundTruth`, telemetry artifact lineage, quality/missingness và ranh giới W4-T4/W4-T5.
6. `../direction/project-scope-v1.md` — MVP/Target/Stretch đã freeze.
7. `../direction/research-questions-and-metrics-v1.md` — RQ1–RQ5, detection/RCA metric và robustness requirement.

W4-T3 chốt **ownership, dependency strategy và fault semantics**; W4-T4 đã canonicalize immutable execution/control/fault truth, telemetry schema, lineage và quality semantics. Artifact này dùng đúng vocabulary T4, không định nghĩa cạnh tranh schema telemetry/ground truth.

## 1.1. Không thuộc W4-T3

- Không tạo PostgreSQL table/column/index cụ thể.
- Không chốt Redis key format/TTL cụ thể nếu chưa cần cho scaffold.
- Không chốt RabbitMQ exchange/queue name, retry count hoặc DLQ policy.
- Không triển khai fault injector, control endpoint, Chaos Mesh hoặc fault platform.
- Không viết OpenTelemetry instrumentation/Collector config.
- Không định nghĩa coverage/missingness schema chi tiết thay cho W4-T4.
- Không thêm multi-fault, crash/restart scenario hoặc component-level RCA primary.
- Không thêm business service/dependency ngoài topology MVP đã freeze.

---

# 2. Nguyên tắc data ownership v1

## 2.1. Quy tắc tổng quát

1. **Một business datum có đúng một service owner.** Service khác chỉ truy cập qua published HTTP/event contract.
2. **Không cross-service database access.** Dùng chung một PostgreSQL instance vật lý không đồng nghĩa dùng chung logical database/schema.
3. **Không shared ORM entity/repository/controller xuyên service.** Shared package chỉ chứa technical primitive/contract cần thiết.
4. **Cache không trở thành shared database.** Redis MVP chỉ phục vụ semantic cache của Course.
5. **Event phải đủ dữ liệu cho consumer theo contract.** Notification không query `grading_db` hoặc `submission_db` để bù payload thiếu.
6. **Storage Mock là external dependency controllable.** Submission sở hữu business metadata/object reference; không biến Storage Mock thành business owner của Submission.
7. **Dependency identity phải ổn định** theo service topology để telemetry/fault/evidence cùng dùng một vocabulary.
8. Ground-truth label như `root_cause_service`, `fault_type`, `fault_start` thuộc experiment/control plane; không được biến thành business state hoặc feature leakage trong application payload.

---

# 3. Ownership matrix MVP

## 3.1. PostgreSQL logical database ownership

Một PostgreSQL instance có thể chứa nhiều logical database trong Docker Compose, nhưng quyền truy cập phải tách theo owner.

| Service | Logical DB canonical | Dữ liệu sở hữu ở mức MVP | Service khác được đọc DB trực tiếp? | Boundary hợp lệ cho service khác |
| --- | --- | --- | :---: | --- |
| `auth` | `auth_db` | credential/auth identity, refresh/auth state tối thiểu | **Không** | Auth HTTP contract qua Gateway ở W1 |
| `course` | `course_db` | Course canonical record | **Không** | `GET /api/v1/courses/{course_id}` và Course HTTP contract |
| `enrollment` | `enrollment_db` | quan hệ enrollment và trạng thái tối thiểu | **Không** | `POST /api/v1/enrollments`, `GET /api/v1/enrollments/check` |
| `submission` | `submission_db` | Submission metadata, object reference, trạng thái tối thiểu | **Không** | Submission HTTP contract |
| `grading` | `grading_db` | Grade record và trạng thái publish cần thiết ở mức implementation | **Không** | Grading HTTP contract + `grade.completed` |
| `notification` | Không bắt buộc DB trong MVP | consumer xử lý notification giả lập | — | nhận `grade.completed`; không đọc DB service khác |
| `gateway` | Không có business DB | không sở hữu business state | — | route/trust boundary |

### PostgreSQL access strategy

- Mỗi service dùng **credential/config riêng** chỉ trỏ tới logical DB của mình.
- Không cấp credential của service A quyền đọc/ghi logical DB của service B.
- Migration thuộc service owner; migration của một service không sửa schema của service khác.
- Foreign key xuyên logical DB/service boundary **không dùng**.
- Cross-service referential integrity được kiểm tra qua published contract/workflow, không qua SQL join xuyên service.
- Exact table/index/column thuộc implementation tuần sau; ownership ở bảng trên là invariant kiến trúc.

## 3.2. Redis ownership

| Dependency identity | Logical owner | Mục đích MVP | Consumer trực tiếp hợp lệ | Consumer không hợp lệ |
| --- | --- | --- | --- | --- |
| `course-redis` | `course` | cache dữ liệu Course để tạo cache/database dependency observable | `course` | Gateway, Enrollment, Submission, Grading, Notification |

Quy tắc:

- Course chịu trách nhiệm semantic của key/value và invalidation.
- Service khác cần dữ liệu Course phải gọi Course HTTP contract; không đọc Redis trực tiếp.
- Redis là cache, `course_db` vẫn là source of truth business cho Course.
- Exact key convention, TTL và cache-aside detail chỉ freeze khi implement; không được làm thay đổi ownership.
- Fault F1 có thể tác động dependency adapter/Redis path nhưng không thay đổi business record trong `course_db`.

## 3.3. RabbitMQ ownership/responsibility

RabbitMQ là shared infrastructure transport, không phải shared business database.

| Phần | Owner/responsibility | Quy tắc |
| --- | --- | --- |
| Event semantic `grade.completed` | `grading` là producer/contract owner theo contract v1 | Grading phát event đúng schema/version |
| Publish path | `grading` | dependency identity `grading-rabbitmq` |
| Consumer behavior | `notification` | Notification parse/process event và ack theo semantics implementation |
| Consumer-side dependency evidence | `notification` | dependency identity `notification-rabbitmq` |
| Broker runtime | platform/Compose | không trở thành business owner của grade/notification data |

Quy tắc:

- Notification không đọc `grading_db`/`submission_db` để bổ sung dữ liệu event.
- Event identity/correlation đi theo contract `grade.completed`; transport trace context dùng RabbitMQ headers/properties.
- Exchange/queue binding name, retry count và DLQ chưa freeze ở W4-T3.
- Retry/DLQ không được cấu hình theo cách che mất F4 hoặc ack giả success.
- F4 root cause ở **service-level `notification`**, RabbitMQ backlog/queue evidence là triệu chứng/component evidence của async path, không đổi primary RCA candidate thành broker.

## 3.4. Storage Mock ownership

| Thành phần | Ownership/responsibility |
| --- | --- |
| Submission business record | `submission` / `submission_db` |
| `object_key` hoặc object reference gắn với Submission | `submission` |
| Object bytes/mock object state | Storage Mock runtime |
| Contract lưu/đọc object | Storage Mock published dependency contract; Submission là consumer |
| Fault control cho storage latency/error | experiment/fault control plane tác động Storage Mock; không nằm trong business payload |

Quy tắc:

- Chỉ Submission gọi Storage Mock trong MVP business flow.
- Service khác không đọc Storage Mock để bypass Submission.
- Storage Mock phải chạy như **external dependency riêng**, không phải in-process fake adapter trong Submission.
- Storage Mock cần hỗ trợ deterministic latency/error control và reset rõ để F2 có ground truth chính xác.
- MinIO thuộc Target; không thay Storage Mock trong MVP chỉ để tăng realism.

---

# 4. Dependency strategy v1

## 4.1. Boundary và access path canonical

| Dependency | Access path | Owner chịu trách nhiệm adapter/client | Identity dùng cho evidence |
| --- | --- | --- | --- |
| Auth PostgreSQL | Auth -> PostgreSQL | `auth` | `auth-postgres` |
| Course Redis | Course -> Redis | `course` | `course-redis` |
| Course PostgreSQL | Course -> PostgreSQL | `course` | `course-postgres` |
| Enrollment PostgreSQL | Enrollment -> PostgreSQL | `enrollment` | `enrollment-postgres` |
| Submission PostgreSQL | Submission -> PostgreSQL | `submission` | `submission-postgres` |
| Submission Storage Mock | Submission -> Storage Mock | `submission` | `submission-storage` |
| Grading PostgreSQL | Grading -> PostgreSQL | `grading` | `grading-postgres` |
| RabbitMQ publish | Grading -> RabbitMQ | `grading` | `grading-rabbitmq` |
| RabbitMQ consume/process | RabbitMQ -> Notification | `notification` | `notification-rabbitmq` |

Service-to-service HTTP vẫn dùng published contract đã chốt ở task-02; không truy cập source/database của callee.

## 4.2. Timeout/retry và faultability

- Mọi outbound HTTP/dependency call cần timeout config rõ khi implement.
- Retry **OFF mặc định trong MVP**, trừ khi có scenario/ADR có chủ đích.
- Timeout/error phải observable; không swallow lỗi dependency thành success.
- Fault hook phải nằm ở dependency/application/resource boundary rõ, mặc định tắt và không làm thay đổi business rule khi inactive.
- Exact timeout milliseconds được freeze trước experiment campaign; fault intensity phụ thuộc timeout phải freeze sau pilot tương ứng.

## 4.3. Data consistency ở boundary

- Workflow synchronous chấp nhận eventual failure giữa các service; không tạo distributed transaction chỉ để giữ ACID xuyên service.
- Submission chỉ persist trạng thái phù hợp sau khi dependency checks/storage operation cần thiết đạt điều kiện implementation; fault injector không được tạo side effect mơ hồ chỉ để tạo lỗi.
- Event consumer phải có semantics xử lý/ack rõ; duplicate handling có thể dựa trên `event_id` theo contract nhưng không cần production-grade exactly-once.
- Reset giữa fault runs phải đưa testbed về baseline hợp lệ trước run tiếp theo; run không reset sạch phải bị đánh dấu invalid/failed, không âm thầm dùng cho evaluation.

---

# 5. Quy tắc thiết kế fault MVP

Năm fault scenario dưới đây là canonical MVP và giữ nguyên category từ blueprint.

## 5.1. Invariant chung

Mỗi fault phải thỏa:

```text
một fault chính trong một controlled run
+ target/owner rõ
+ activation có start/end UTC rõ
+ parameter/intensity truy vết được
+ workload/seed truy vết được
+ service-level root cause cố định
+ component/dependency evidence riêng khi có
+ symptom quan sát được
+ reset/verification trước run kế tiếp
```

Quy tắc bắt buộc:

1. Fault mechanism mặc định **OFF**.
2. Activation/deactivation phải do experiment/fault control plane điều khiển, không do business request tự quyết định.
3. Không sửa business data để giả lập lỗi khi có thể inject ở dependency/application/resource boundary.
4. Không nhét `fault_type`, `root_cause_service` hoặc truth label vào business HTTP/event payload.
5. Baseline và fault run dùng workload profile/seed theo evaluation protocol; `load/` không tự inject fault.
6. Mỗi fault có `root_cause_service` để tính Top-1/Top-3/MRR service-level; `root_cause_component` chỉ là evidence bổ sung trong MVP.
7. Fault start/end phải lấy từ control plane/runner, không suy ngược từ lúc detector phát hiện.
8. Nếu hook activation/reset thất bại hoặc state sau reset không đạt verification, run phải được đánh dấu invalid/failed.
9. Intensity cụ thể được pilot rồi freeze trước final test campaign; không tune intensity trên final test để làm model đẹp hơn.

## 5.2. Ground-truth semantics canonical

Mỗi fault run dùng cùng `RunGroundTruth` immutable của W4-T4; đây là execution/control/fault truth, không phải experiment/evaluation manifest và không sở hữu telemetry artifact pointer.

```text
ground_truth_schema_version

# execution identity
scenario_id
run_id
repeat_index
run_status
run_start
run_end

# workload/execution
workload_profile
workload_seed
workload_parameters
workload_start
workload_end

# fault truth
fault_id
fault_type
fault_target
fault_target_kind
fault_intensity
fault_parameters
fault_start
fault_end

# RCA truth and expected propagation
root_cause_service
root_cause_component
expected_symptom
expected_propagation_path
expected_evidence

# control/reset/verification
activation_result
activation_details
deactivation_result
deactivation_details
reset_start
reset_end
reset_result
verification_result
verification_checks

# execution provenance
code_commit
service_versions
environment_profile
environment_config_version
```

`run_status` chỉ phản ánh execution validity: `valid | invalid | failed`. Activation/deactivation/reset/verification failure có thể làm execution `invalid` hoặc `failed`; telemetry coverage, missingness và data quality được đánh giá riêng trên từng artifact qua `TelemetryQualityReport` và không mutate `RunGroundTruth`. Vì vậy baseline execution có thể giữ `run_status=valid` trong khi một derived trace-drop/missing-modality artifact có `overall_status=partial` hoặc `fail` theo quality rule.

Campaign/experiment identity, split, modality/full-degraded selection, selected telemetry artifact, feature/detector/RCA/evaluation configuration hoặc output thuộc experiment/evaluation manifest W4-T5. Một fault matrix chỉ yêu cầu telemetry evidence được audit qua `RunGroundTruth` + `TelemetryArtifactManifest` + `TelemetryQualityReport` theo từng `artifact_id`.

---

# 6. Fault matrix MVP — summary

| ID | Scenario / category | Root-cause service | Component evidence / target | Injector / hook | Workload context chính | Expected symptom / propagation | Reset / verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **F1** | Course / Redis latency — Cache | `course` | `course-redis` | dependency-latency injector tại Redis adapter/path của Course | normal mixed, ưu tiên W2/W3/W4 read path; cache được pre-warm | Redis dependency latency tăng -> Course latency tăng -> symptom tại Gateway và caller như Enrollment/Submission tùy flow | disable latency; verify Redis path latency + Course p95 về baseline, health/readiness OK |
| **F2** | Submission -> Storage latency — Downstream dependency | `submission` | `submission-storage` | deterministic latency control tại external Storage Mock | submission peak hoặc W4-focused | Storage PUT chậm/quá timeout -> Submission timeout/error + latency -> Gateway symptom; storage dependency span là evidence chính | clear Storage Mock fault; verify PUT latency bình thường, no stuck state, Submission flow success |
| **F3** | Submission service error — Service error | `submission` | `submission-service` | application fault hook tại create-submission path, trước irreversible side effect | W4-focused / submission peak | Submission trả controlled internal error -> Gateway error; downstream calls sau hook không thực hiện nếu hook đặt trước side effect | disable hook; verify create submission success và không còn injected error |
| **F4** | Notification consumer slowdown / RabbitMQ backlog — Async queue | `notification` | `notification-consumer` | deterministic processing-delay hook trong Notification consumer trước ack | W5 grading burst, publish rate đủ tạo backlog khi slowed | consumer processing latency/lag tăng, queue depth/backlog tăng; Grading HTTP/publish có thể vẫn khỏe | disable delay; drain/clear backlog theo protocol; verify queue/lag về baseline và consumer throughput hồi phục |
| **F5** | Submission CPU pressure — Resource | `submission` | `submission-instance` | resource/CPU injector colocated với Submission runtime; không crash/restart | submission peak hoặc mixed W4+W5 | Submission CPU/event-loop/latency tăng -> request timeout/error có thể tăng -> Gateway và Grading caller có symptom | stop CPU injector; verify CPU/event-loop/latency về baseline, readiness OK, no restart required |

Mỗi dòng dùng cùng shape T4: fault identity/target/kind, service-level root cause, component evidence, workload, actual injection interval/parameters, `expected_symptom`, `expected_propagation_path`, `expected_evidence`, activation/deactivation, reset/verification và execution provenance. `expected_symptom` mô tả outcome semantic; `expected_propagation_path` là path service/edge/dependency có thứ tự để audit propagation; `expected_evidence` là expectation observable qua metrics/traces/logs/control. Cả ba là truth/control metadata, không phải detection/RCA feature.

| Fault | `expected_propagation_path` canonical (phụ thuộc workload) |
| --- | --- |
| F1 | `course-redis -> course -> gateway`; W3/W4 có thể lần lượt qua `enrollment` hoặc `submission` trước Gateway |
| F2 | `submission-storage -> submission -> gateway` |
| F3 | `submission -> gateway` |
| F4 | `grading -> RabbitMQ -> notification`; Grading/Gateway HTTP vẫn có thể healthy |
| F5 | `submission -> gateway`; workload W5 có thể quan sát thêm `submission -> grading` |

---

# 7. Fault scenario chi tiết

## F1 — Course / Redis latency

### Mục tiêu

Tạo fault cache dependency có controlled latency nhưng vẫn giữ `course` là service-level root cause theo evaluation convention hiện tại.

### Target và hook

```text
fault_id: F1
fault_type: dependency_latency
fault_target: course-redis
fault_target_kind: dependency
root_cause_service: course
root_cause_component: course-redis
```

Hook:

- fault injector nằm ở **Redis dependency boundary của Course**, trong adapter/injector layer dành cho experiment;
- delay được áp deterministic cho operation Redis được chọn;
- delay phải nằm trong dependency span/timing quan sát được;
- hook không sửa cache value và không làm thay đổi Course business semantics khi inactive.

Không inject bằng cách sửa `course_db` hoặc cho service khác truy cập Redis.

### Workload context

- Profile: `normal-mixed-v1` hoặc profile tương đương được T5/evaluation protocol freeze.
- Bắt buộc tạo traffic đủ qua Course Redis path.
- Cache nên được pre-warm/verification trước run để fault thực sự tác động cache boundary thay vì biến thành DB-miss scenario.
- Có thể bao gồm W2 trực tiếp và W3/W4 để quan sát propagation qua `enrollment -> course` hoặc `submission -> course`.

### Fault parameters cần ground truth

Tối thiểu:

```text
operation_scope
injected_delay_ms
activation_mode = interval
fault_start
fault_end
```

Intensity số cụ thể chưa freeze. Sau pilot, chọn mức đủ làm Course latency khác baseline rõ nhưng ưu tiên **latency-dominant** thay vì biến toàn bộ scenario thành Redis availability failure; giá trị phải được freeze trước final campaign trong execution/fault config.

### Expected symptom / propagation

Primary:

- duration của dependency `course-redis` tăng trong fault interval;
- Course request duration/p95 tăng;
- trace path có span Course -> Redis chậm tương ứng.

Propagation tùy workload:

```text
W2: course -> gateway
W3: course -> enrollment -> gateway
W4: course -> submission -> gateway
```

Nếu timeout config bị vượt ở intensity đã freeze, timeout/error phải được ghi rõ trong scenario config; không để cùng scenario lúc là latency-only, lúc là timeout vì config trôi.

### Evidence expected

- **Metrics:** Course RED latency; Redis dependency duration/rate/error nếu có; upstream service latency.
- **Traces:** slow `course -> Redis` dependency span; caller/callee path cho W2/W3/W4.
- **Logs:** operational slow-dependency/timeout log nếu implementation có threshold hợp lệ; không tạo log chứa truth label chỉ để giúp model.
- **Ground truth:** fault interval, delay parameter, `course`, `course-redis`.

### Reset / verification

1. Disable Redis latency injector.
2. Verify injector state = OFF.
3. Verify Redis operation latency và Course request p95 trở về baseline tolerance do protocol quy định.
4. Verify Course health/readiness và representative W2 request success.
5. Nếu cache state bị thay đổi ngoài dự kiến, re-warm trước run kế tiếp.

---

## F2 — Submission -> Storage Mock latency

### Mục tiêu

Tạo downstream external-dependency fault rõ ràng tại W4, có correlation từ Storage Mock -> Submission -> Gateway và có timeout/error semantics ổn định.

### Target và hook

```text
fault_id: F2
fault_type: dependency_latency
fault_target: submission-storage
fault_target_kind: dependency
root_cause_service: submission
root_cause_component: submission-storage
```

Hook canonical ở **external Storage Mock**, không phải random sleep trong business use case của Submission.

Storage Mock phải hỗ trợ control plane riêng cho experiment để:

- bật deterministic delay cho `PUT` và/hoặc operation được chọn;
- ghi nhận activation/deactivation time;
- reset về default behavior;
- business caller không được điều khiển fault qua payload bình thường.

### Workload context

- W4 `POST /api/v1/submissions` là flow chính.
- Profile ưu tiên `submission peak` hoặc W4-focused profile với seed/rate/duration cố định.
- Data setup phải có Course + Enrollment hợp lệ để request đi tới storage boundary thay vì fail sớm ở validation.

### Fault parameters cần ground truth

```text
operation = PUT
injected_delay_ms
submission_storage_timeout_ms   # runtime/execution configuration reference
activation_mode = interval
fault_start
fault_end
```

`submission_storage_timeout_ms` là runtime/execution configuration, không phải field T4 hoặc experiment/evaluation configuration. Exact timeout được pilot, implementation/protocol freeze trước final campaign; execution phải lưu đủ fault parameter và provenance để tái lập. Định hướng final scenario là chọn `injected_delay_ms` lớn hơn storage timeout với margin ổn định để tạo `DEPENDENCY_TIMEOUT` có chủ đích, nhưng W4-T3 không chốt numeric millisecond.

### Expected symptom / propagation

```text
Storage Mock delayed
  -> Submission storage dependency timeout/latency
  -> Submission request error/latency
  -> Gateway error/latency
  -> Client sees stable error envelope
```

Khi timeout xảy ra, contract phải map thành stable `DEPENDENCY_TIMEOUT`/HTTP 504 theo task-02.

### Evidence expected

- **Metrics:** storage dependency duration/timeout/error; Submission RED error/latency; Gateway affected metrics.
- **Traces:** `submission -> submission-storage` span chậm/timeout; propagated request trace tới Gateway.
- **Logs:** structured dependency timeout/error ở Submission với dependency identity, timeout/error type, latency và trace context.
- **Ground truth:** exact interval, delay/timeout config, `submission`, `submission-storage`.

### Reset / verification

1. Clear Storage Mock latency configuration.
2. Verify control state = default/OFF.
3. Execute representative object PUT/read smoke check.
4. Execute representative W4 submission and verify success.
5. Verify no lingering delayed request/state ảnh hưởng run kế tiếp.

---

## F3 — Submission service error

### Mục tiêu

Tạo application/service fault riêng biệt với dependency latency/resource pressure để có category service error rõ và ground truth không mơ hồ.

### Target và hook

```text
fault_id: F3
fault_type: service_error
fault_target: submission-service
fault_target_kind: service
root_cause_service: submission
root_cause_component: submission-service
```

Hook:

- controlled application fault hook trong Submission create path;
- activation theo experiment state + interval, không theo random ad-hoc logic;
- inject error **trước irreversible side effect** của request target để reset đơn giản và tránh dirty business state;
- trả error qua common error contract; không dump raw exception/stack trace ra client.

Canonical targeted operation:

```text
POST /api/v1/submissions
```

### Workload context

- W4-focused hoặc `submission peak`.
- Course/Enrollment setup hợp lệ để lỗi đến từ Submission hook, không từ validation dependency.

### Fault parameters cần ground truth

```text
operation = POST /api/v1/submissions
injected_error_code = INTERNAL_ERROR   # logical semantic; exact injector exception private
injected_error_rate = <FROM_VERSIONED_EXECUTION_FAULT_CONFIG>
fault_start
fault_end
```

100% targeted-request failure trong active interval là candidate/default ưu tiên vì deterministic và ground truth rõ, nhưng chỉ freeze `1.0` sau pilot nếu phù hợp. Nếu chọn rate nhỏ hơn `1.0`, execution/fault config phải có deterministic seed và giữ cố định giữa final repetitions; final rate không được tune theo kết quả model.

### Expected symptom / propagation

- Submission error rate tăng ngay sau fault start.
- Gateway nhận propagated 5xx/error envelope.
- Request bị faulted không tiếp tục side effect sau hook point.
- Course/Enrollment/Storage dependency không được gán là root cause chỉ vì nằm trong W4 topology.

### Evidence expected

- **Metrics:** Submission 5xx/error rate; Gateway corresponding error rate.
- **Traces:** Submission server span error; Gateway -> Submission client span error.
- **Logs:** structured application error tại Submission có trace/span correlation, nhưng không chứa `root_cause_service` truth label.
- **Ground truth:** operation, injected error semantic/rate, interval, `submission`.

### Reset / verification

1. Disable service-error hook.
2. Verify hook state OFF.
3. Run representative W4 submission success path.
4. Verify no fault-state persisted vào business data.
5. Verify Submission error rate trở về baseline tolerance.

---

## F4 — Notification consumer slowdown / RabbitMQ backlog

### Mục tiêu

Tạo async fault mà root cause nằm ở Notification, trong khi Grading producer/business HTTP có thể vẫn hoạt động; scenario này tạo giá trị rõ cho async telemetry, graph và temporal RCA.

### Target và hook

```text
fault_id: F4
fault_type: consumer_slowdown
fault_target: notification-consumer
fault_target_kind: consumer
root_cause_service: notification
root_cause_component: notification-consumer
```

Hook:

- deterministic processing delay trong Notification consumer **sau message receive/extract context và trước completion/ack**;
- không ack message ngay rồi mới sleep, vì như vậy broker backlog sẽ không phản ánh slowdown thực;
- không làm Grading producer chậm một cách trực tiếp;
- broker queue/exchange exact name chưa freeze, nhưng logical event luôn là `grade.completed`.

### Workload context

- W5 `grading burst` là profile ưu tiên.
- Publish rate trong active interval phải lớn hơn effective consumer service rate dưới fault để backlog/lag tăng quan sát được.
- Data setup phải có Submission hợp lệ cho grading path.

### Fault parameters cần ground truth

```text
processing_delay_ms
message_scope = grade.completed
activation_mode = interval
fault_start
fault_end
workload_publish_rate / profile reference
```

Exact delay/rate được pilot để bảo đảm backlog tăng ổn định nhưng testbed không rơi vào crash/resource exhaustion ngoài scope.

### Expected symptom / propagation

Primary async evidence:

- Notification consumer processing duration/lag tăng;
- queue depth/backlog hoặc unacked/ready messages tăng theo broker metric khả dụng;
- `grading -> RabbitMQ` publish có thể vẫn healthy;
- Notification process completion rate giảm trong active interval.

Đây là scenario mà HTTP response của Grading có thể không lỗi. Không ép Gateway phải có symptom để một fault được xem là hợp lệ.

Dynamic service-level edge vẫn là:

```text
grading -> notification
```

RabbitMQ/component evidence hỗ trợ giải thích, nhưng primary root-cause candidate là `notification`.

### Evidence expected

- **Metrics:** queue depth/lag/consumer throughput; Notification processing duration; publish/consume rates.
- **Traces:** RabbitMQ publish -> consume/process path có propagated context khi telemetry đầy đủ; process span chậm tại Notification.
- **Logs:** slow consumer/processing warning hoặc processing error nếu natural instrumentation tạo ra; không synthesize truth label vào log feature.
- **Ground truth:** consumer delay, interval, workload rate/profile, `notification`, `notification-consumer`.

### Reset / verification

1. Disable consumer delay.
2. Verify consumer hook OFF.
3. Theo protocol, cho consumer drain backlog hoặc reset queue state bằng cách reproducible trước next run.
4. Verify queue depth/lag trở về baseline threshold.
5. Verify `grade.completed` representative message được consume/process thành công và consumer throughput hồi phục.
6. Nếu backlog không drain được trong giới hạn protocol, mark run/reset failed thay vì bắt đầu run kế tiếp.

---

## F5 — Submission CPU pressure

### Mục tiêu

Tạo resource fault tại Submission nhưng service vẫn sống, để quan sát resource signal + service latency/error propagation mà không biến scenario thành crash/restart.

### Target và hook

```text
fault_id: F5
fault_type: cpu_pressure
fault_target: submission-instance
fault_target_kind: resource
root_cause_service: submission
root_cause_component: submission-instance
```

Hook semantic:

- dedicated resource/CPU injector colocated với Submission runtime/container;
- tiêu thụ CPU có kiểm soát trong active interval;
- **không kill/restart** service;
- implementation có thể là fault worker/process/tool trong `faults/injectors/`, nhưng phải tách khỏi business rule và mặc định tắt.

Exact mechanism được chọn ở implementation nếu nó đáp ứng cùng observable semantics; thay mechanism không được đổi root-cause label mà không cập nhật artifact/ADR.

### Workload context

- `submission peak` hoặc mixed W4 + W5 để cả direct `gateway -> submission` và `grading -> submission` có cơ hội quan sát propagation.
- Rate phải đủ tạo request contention nhưng healthy control cùng profile không được tự nó gây incident tương đương.

### Fault parameters cần ground truth

Tối thiểu một bộ parameter reproducible như:

```text
injector_mode
worker_count / duty_cycle / target_cpu parameter
fault_start
fault_end
```

Không coi observed CPU% là ground-truth activation parameter duy nhất vì observed value phụ thuộc host contention. `RunGroundTruth` giữ configured intensity/fault parameters cần tái lập execution; observed CPU là telemetry evidence riêng.

### Expected symptom / propagation

- Submission CPU utilization tăng rõ trong active interval.
- Event-loop/runtime signal nếu instrument được tăng theo pressure.
- Submission request duration/p95 tăng; timeout/error có thể tăng ở intensity đã freeze.
- Direct W4 path có thể propagate tới Gateway.
- W5 có thể tạo symptom tại Grading khi `grading -> submission` chậm.
- Service vẫn health/readiness alive theo criterion của scenario; nếu crash/restart thì run không còn đúng F5 canonical.

### Evidence expected

- **Metrics:** Submission CPU, runtime/event-loop signal nếu available, RED latency/error; affected caller metrics.
- **Traces:** slow spans qua `gateway -> submission` và/hoặc `grading -> submission`; dependency spans bên dưới giúp phân biệt resource fault với Storage/Course/Enrollment fault.
- **Logs:** timeout/error logs phát sinh tự nhiên dưới resource pressure nếu có; không yêu cầu log synthetic chứa fault identity.
- **Ground truth:** injector config, interval, `submission`, `submission-instance`.

### Reset / verification

1. Stop CPU injector.
2. Verify injector process/worker không còn hoạt động.
3. Verify Submission CPU/runtime metric về baseline tolerance.
4. Verify readiness/health vẫn OK và không có restart ngoài dự kiến.
5. Run representative W4 request; nếu dùng W5 mixed, verify Grading -> Submission path bình thường.

---

# 8. Fault-to-topology/RCA mapping

| Fault | Service-level candidate đúng | Component evidence | Edge/node phải giúp giải thích | Upstream/affected service có thể thấy symptom |
| --- | --- | --- | --- | --- |
| F1 | `course` | `course-redis` | `e14 course -> Redis`; `e03/e07/e08` tùy workflow | `gateway`, `enrollment`, `submission` |
| F2 | `submission` | `submission-storage` | `e10 submission -> Storage Mock`, `e05 gateway -> submission` | `gateway` |
| F3 | `submission` | `submission-service` | node `submission`, `e05 gateway -> submission` | `gateway` |
| F4 | `notification` | `notification-consumer`; broker evidence | `e12 grading -> notification`, `e19/e20` messaging evidence | async path; `grading` có thể vẫn healthy |
| F5 | `submission` | `submission-instance` | node `submission`, `e05` và `e11` nếu workload W5 | `gateway`, `grading` |

Quy tắc evaluation:

- Primary RCA candidate set là **service-level** theo protocol W4-T5/AI blueprint.
- `root_cause_component` không được dùng để tính primary Top-1/Top-3/MRR của MVP.
- Gateway không tự động trở thành root-cause candidate chỉ vì có symptom upstream.
- RabbitMQ/Redis/Storage/PostgreSQL có thể là component/dependency evidence; không trộn với service candidate trong cùng primary ranking metric.
- Fault matrix phải tạo case propagation đủ để RQ2/RQ3 có ý nghĩa, nhưng không bắt buộc mọi fault phải gây symptom ở mọi upstream service.

---

# 9. Evidence requirement đồng bộ với W4-T4

Với schema W4-T4 đã canonicalize, từ mỗi run fault phải kiểm tra tối thiểu:

| Requirement | F1 | F2 | F3 | F4 | F5 |
| --- | :---: | :---: | :---: | :---: | :---: |
| Service identity | ✓ | ✓ | ✓ | ✓ | ✓ |
| Component/dependency identity | ✓ | ✓ | ✓ | ✓ | ✓ |
| UTC fault start/end | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workload profile + seed | ✓ | ✓ | ✓ | ✓ | ✓ |
| Configured fault intensity/parameters | ✓ | ✓ | ✓ | ✓ | ✓ |
| Service RED evidence | ✓ | ✓ | ✓ | Notification/process equivalent | ✓ |
| Dependency/edge evidence | Redis | Storage | gateway->submission | RabbitMQ publish/consume | caller->submission + resource |
| Trace correlation khi modality available | ✓ | ✓ | ✓ | ✓ | ✓ |
| Structured log correlation khi request/message context có log | ✓/optional symptom | ✓ | ✓ | ✓/optional symptom | ✓/optional symptom |
| Coverage/missingness được biểu diễn rõ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reset/verification metadata | ✓ | ✓ | ✓ | ✓ | ✓ |

`optional symptom` nghĩa là không được tạo log artificial chỉ để tăng chất lượng RCA. Log feature phải đến từ operational logging hợp lý của hệ thống.

Một `run_id` có thể có nhiều raw, normalized hoặc derived telemetry artifact. `TelemetryArtifactManifest` giữ `artifact_id` bất biến; derived/degraded artifact phải trỏ `source_artifact_id` và lưu transformation config/seed/parameters. Mỗi artifact có `TelemetryQualityReport` riêng. Full và degraded artifact có thể dùng cùng immutable `RunGroundTruth`; ground truth không sở hữu artifact pointer.

RQ4 dùng strict paired comparison sau:

```text
same execution
same run_id
same immutable RunGroundTruth
same baseline telemetry lineage

full artifact A
degraded artifact B -> source_artifact_id = A
transformation config/seed recorded
own TelemetryQualityReport
```

Degradation không mutate `RunGroundTruth`, `run_status` hoặc baseline artifact; fault matrix không tạo ground truth riêng cho degraded condition.

---

# 10. Ground-truth leakage guard

**Ground-truth/control metadata MUST NOT be consumed as detection/RCA features unless một oracle upper-bound experiment được thiết kế có chủ đích, version hóa và khai báo riêng trong W4-T5 experiment/evaluation manifest.** Observable evidence cho detector/RCA phải đến từ telemetry thực tế.

- `fault_id`, `fault_type`, `fault_target`, `fault_target_kind`, `fault_intensity`, `fault_parameters`, `fault_start`, `fault_end`, `root_cause_service`, `root_cause_component`, `expected_symptom`, `expected_propagation_path`, `expected_evidence`, activation/deactivation và reset/verification truth là **truth/control metadata**.
- Các field trên không được nhét vào request/event business payload rồi vô tình trở thành trace/log/model feature.
- `run_id` là execution/artifact/evaluation correlation identity, không phải business HTTP/event field, không thay W3C Trace Context và không dùng làm Prometheus label. Với F4, W3C Trace Context trong RabbitMQ headers/properties vẫn là runtime correlation chính; `event_id` chỉ là fallback correlation/dedup identity khi async trace thiếu hoặc degraded.
- Fault control endpoint/config không được expose như public business API qua Gateway.
- Telemetry có thể phản ánh **hậu quả tự nhiên** của fault (latency, error, queue depth, CPU, timeout log), không được emit trực tiếp “F2 active/root cause=submission” vào feature stream.

---

# 11. Reset/isolation protocol requirement

Trước mỗi controlled run:

1. tất cả fault injector = OFF;
2. health/readiness của service liên quan đạt;
3. dependency smoke check đạt;
4. workload data prerequisite hợp lệ;
5. state đặc thù scenario được chuẩn bị reproducible, ví dụ F1 cache pre-warm;
6. F4 queue/backlog ở baseline condition;
7. không còn CPU injector/process từ F5;
8. runner ghi nhận pre-run verification result.

Sau fault interval/run:

1. deactivate injector;
2. ghi actual deactivation/result;
3. chạy scenario-specific reset;
4. verify system trở về baseline tolerance;
5. nếu verification fail, đánh dấu run invalid/failed và không dùng âm thầm trong final evaluation.

Exact tolerance/time window thuộc evaluation protocol W4-T5.

---

# 12. Điểm đã freeze và ranh giới W4-T3/T4/T5

## 12.1. Đã freeze trong W4-T3

- PostgreSQL logical DB owner theo service; không cross-service DB access.
- Redis semantic owner = Course.
- RabbitMQ producer/consumer responsibility = Grading/Notification; broker không là business owner.
- Storage Mock là external controllable dependency; Submission sở hữu business reference.
- Dependency identity giữ đúng topology v1.
- Năm fault canonical F1–F5 và service-level root cause tương ứng.
- Fault category, logical target, hook boundary, workload intent, expected propagation/evidence và reset semantics.
- Single-fault controlled run, clear start/end, deterministic config, no truth-label leakage.

## 12.2. W4-T4 đã canonicalize

- `RunGroundTruth` immutable, execution validity và fault/control/reset/verification truth;
- normalized telemetry schema cho metrics/traces/logs, correlation và missingness;
- `TelemetryArtifactManifest`, immutable artifact lineage và artifact-specific `TelemetryQualityReport`;
- W3C Trace Context là runtime correlation chính; F4 dùng `event_id` fallback khi async trace thiếu/degraded;
- guard chống ground-truth leakage và mapping observable telemetry sang service/edge feature.

## 12.3. W4-T5/implementation phải freeze sau pilot

- exact workload rate/stage/duration và matched healthy controls;
- exact timeout milliseconds;
- exact fault intensity (`delay_ms`, processing delay, CPU injector config, v.v.);
- baseline tolerance dùng cho reset verification;
- repetitions/split/protocol chi tiết ngoài floor đã có;
- Redis key/TTL, RabbitMQ exchange/queue name và implementation detail không làm thay đổi semantic contract.

Execution/fault parameter cần tái lập chính execution được lưu trong `RunGroundTruth.fault_parameters`, `fault_intensity`, workload/execution provenance hoặc versioned execution configuration phù hợp. Campaign identity, split, modality/analysis variant, selected telemetry artifact và feature/detector/RCA/evaluation configuration/output thuộc experiment/evaluation manifest W4-T5. Telemetry transformation config thuộc `TelemetryArtifactManifest`; không nhét mọi config vào ground truth.

---

# 13. Cross-check tương thích W4-T3/W4-T4/W4-T5

W4-T3, W4-T4 và W4-T5 dùng cùng invariant sau:

```text
F1 -> root service course       -> component course-redis
F2 -> root service submission   -> component submission-storage
F3 -> root service submission   -> component submission-service
F4 -> root service notification -> component notification-consumer
F5 -> root service submission   -> component submission-instance
```

W4-T3 sở hữu data ownership, dependency access strategy, fault category/target/kind, service-level root cause, component evidence, hook/injector boundary, workload intent, expected symptom/propagation/evidence, reset semantics và fault-side requirements để tạo execution truth hợp lệ. W4-T4 sở hữu `RunGroundTruth`, normalized telemetry schema, `TelemetryArtifactManifest`, `TelemetryQualityReport` cùng correlation/missingness/lineage semantics. W4-T5 sở hữu experiment/evaluation manifest, campaign identity, split, modality/analysis variant, selected telemetry artifacts, feature/detector/RCA/evaluation configuration/output và experiment-specific provenance.

Mỗi F1–F5 phải chứng minh đồng thời:

1. **fault nào được kích hoạt, ở đâu, khi nào, bằng config nào**;
2. **service nào là label RCA chính thức**;
3. **component/dependency nào cung cấp evidence**;
4. **symptom xuất hiện ở service/edge nào và theo thứ tự thời gian nào**;
5. **modality nào có/thiếu dữ liệu**;
6. **run đã reset/verify hợp lệ hay chưa**;
7. **mọi evidence có thể truy ngược về cùng run/artifact mà không dùng truth label làm model feature**;
8. **full/degraded variant cùng `run_id` và immutable ground truth, nhưng có lineage/quality theo từng artifact**.

Không có special-case truth schema cho một fault riêng. W4-T5 chỉ tham chiếu truth/artifact bất biến, không mutate ngược W4-T4; W4-T3 không thay đổi topology hay F1–F5 chỉ để vừa với schema telemetry.

---

# 14. DoD checkpoint — W4-T3 final cross-check

| DoD W4-T3 | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Ownership cho PostgreSQL logical DB, Redis, RabbitMQ, Storage Mock; không cross-service DB access | **Đạt** | Mục 2–4 |
| ≥5 scenario gồm target, injector/hook, workload, ground truth, symptom/propagation, reset/verification | **Đạt** | Mục 5–7 |
| Mỗi fault map được tới service-level RCA và không vượt MVP | **Đạt** | Mục 6–8 |
| Cross-check `RunGroundTruth`, quality/lineage, RQ4 và guard chống leakage với W4-T4 | **Đạt** | Mục 5.2, 9–10, 12–13 |
| Artifact sẵn sàng cho review PR theo workflow | **Đạt** | Không còn vocabulary/schema stale; verdict GitHub được ghi nhận ngoài artifact |

Artifact này là **W4-T3 final đã cross-check với W4-T4 final**, sẵn sàng review/merge theo workflow task mà không thay đổi task metadata trong artifact này.
