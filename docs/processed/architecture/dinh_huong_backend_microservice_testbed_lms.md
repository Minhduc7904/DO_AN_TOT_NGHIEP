# Định hướng Backend Microservice Testbed LMS

> **Vai trò canonical:** Source of truth cho phạm vi backend testbed, service topology, workflow, dependency, observability, workload, fault injection và phân tầng MVP/Target/Stretch.
>
> **Implementation architecture:** [`backend_microservice_testbed_blueprint.md`](backend_microservice_testbed_blueprint.md)
>
> **Định hướng tổng thể:** [`../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md)
>
> **Kế hoạch WHEN/WHO:** [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md)

Tài liệu này trả lời **backend testbed cần có gì và vì sao**. Cây source code, service template, contract layout và convention instrumentation chi tiết chỉ được định nghĩa trong backend blueprint. Lịch triển khai và phân công chỉ được định nghĩa trong plan v0.2.

## 1. Vai trò của backend

Backend LMS là System Under Test (SUT) cho hệ thống observability, anomaly detection và root-cause candidate ranking. LMS không phải sản phẩm độc lập và không được mở rộng theo số lượng CRUD.

Backend phải tạo được:

- dependency đồng bộ và bất đồng bộ;
- database, cache, queue và storage dependency;
- workload bình thường, tải cao nhưng khỏe và các burst có chủ đích;
- fault propagation quan sát được;
- telemetry đa nguồn có correlation;
- ground truth và experiment có thể lặp lại.

Một feature chỉ nên được thêm khi nó tạo dependency/fault có giá trị, cải thiện observability hoặc hỗ trợ trực tiếp research question/evaluation.

## 2. Service topology canonical

### 2.1. MVP

MVP gồm 6 business service và 1 API Gateway:

```text
API Gateway
Auth
Course
Enrollment
Submission
Grading
Notification
```

```text
Gateway
├── Auth
├── Course
├── Enrollment -> Course
├── Submission -> Course + Enrollment + Storage
└── Grading -> Submission
                 |
                 └── grade.completed -> RabbitMQ -> Notification

Course -> Redis
Course -> PostgreSQL
```

Mỗi service có logical database riêng khi cần. Một PostgreSQL instance chung là đủ cho MVP:

```text
auth_db
course_db
enrollment_db
submission_db
grading_db
```

Không service nào query trực tiếp database của service khác.

### 2.2. Target

Target có thể thêm `Assignment`:

```text
Assignment -> Course
Submission -> Assignment + Enrollment + Storage
```

`Assignment` chỉ được thêm sau khi MVP topology và luồng experiment cốt lõi ổn định. Nếu không thêm, Submission vẫn nhận course/work-item metadata tối thiểu qua contract MVP.

### 2.3. Stretch

Stretch chỉ được xem xét khi anomaly/RCA MVP và evaluation floor đã đạt:

- Kubernetes hoặc Chaos Mesh;
- gRPC cho một dependency có mục tiêu nghiên cứu rõ;
- retry/circuit-breaker scenario;
- nhiều instance/version hoặc instance-level RCA;
- multi-fault incident;
- component-level RCA như metric chính.

Service mesh, multi-cluster, custom operator và production-grade security platform không thuộc phạm vi đồ án.

## 3. Vai trò service và dependency

### API Gateway

- route request;
- kiểm tra JWT cục bộ;
- chuẩn hóa error response;
- truyền trace context;
- tạo điểm vào thống nhất để quan sát symptom upstream.

### Auth

- login và phát JWT;
- role/claim tối thiểu;
- truy cập `auth_db`.

Auth chỉ nằm trên request path của login/refresh. Gateway không gọi Auth để introspect token trên từng request; vì vậy Auth không phải shared runtime dependency của mọi API sau login.

### Course

- create/get/list course ở mức tối thiểu;
- sở hữu `course_db`;
- sử dụng Redis cho cache;
- là dependency của Enrollment và Submission.

Course tạo failure mode cache và database có giá trị cho RCA.

### Enrollment

- enroll và kiểm tra enrollment;
- gọi Course qua HTTP contract;
- sở hữu `enrollment_db`.

### Submission

- tiếp nhận và truy vấn bài nộp;
- gọi Course và Enrollment trong MVP;
- gọi controllable storage mock;
- sở hữu `submission_db`.

Submission là trọng tâm của synchronous fault propagation. Target có thể thay call Course/work-item bằng Assignment.

### Grading

- tạo/cập nhật grade tối thiểu;
- gọi Submission;
- sở hữu `grading_db`;
- publish `grade.completed`.

### Notification

- consume `grade.completed`;
- giả lập gửi thông báo;
- tạo queue backlog/consumer slowdown scenario;
- không cần gửi email thật.

## 4. Workflow cốt lõi

```text
W1 Login
Client -> Gateway -> Auth -> auth_db -> JWT

W2 Browse Course
Client -> Gateway -> Course -> Redis/PostgreSQL

W3 Enroll Course
Client -> Gateway -> Enrollment -> Course
                            └-> enrollment_db

W4 Submit Course Work
Client -> Gateway -> Submission -> Course
                              ├-> Enrollment
                              ├-> Storage mock
                              └-> submission_db

W5 Grade and Notify
Client -> Gateway -> Grading -> Submission
                         ├-> grading_db
                         └-> grade.completed -> RabbitMQ -> Notification
```

Target thay nhánh `Submission -> Course` bằng `Submission -> Assignment -> Course` khi Assignment được triển khai.

## 5. Quyết định công nghệ

| Thành phần | Hướng triển khai |
| --- | --- |
| Backend testbed | TypeScript + NestJS |
| Analysis/anomaly/RCA | Python |
| Workload | k6 |
| Messaging | RabbitMQ |
| Database | PostgreSQL |
| Cache | Redis |
| Storage MVP | Controllable mock |
| Storage Target | MinIO |
| Runtime | Docker Compose |
| Observability | OpenTelemetry, Prometheus, Tempo, Loki, Grafana |
| Kubernetes | Stretch only |

Business services dùng một stack thống nhất. Analysis là modular monolith Python ở giai đoạn đầu; không cần microservice hóa pipeline phân tích.

## 6. Auth, giao tiếp và event

MVP dùng HTTP REST cho synchronous communication. Mọi outbound call phải có timeout; retry tắt mặc định để failure propagation dễ hiểu và chỉ thêm khi có scenario kiểm thử.

Tên event dùng lowercase dot notation. MVP chỉ chốt:

```text
grade.completed
```

Event contract phải version hóa và truyền trace context qua RabbitMQ. Event Target khác chỉ được thêm khi có consumer thật và giá trị experiment cụ thể.

## 7. Observability requirements

Observability là Definition of Done của service, không phải giai đoạn gắn monitoring sau khi code xong.

Mỗi boundary có liên quan phải cung cấp:

- inbound HTTP span;
- outbound HTTP span;
- PostgreSQL span;
- Redis span;
- storage dependency span;
- RabbitMQ publish/consume span;
- trace propagation qua HTTP và RabbitMQ;
- error status, HTTP status, exception/error type;
- dependency identity và timeout/error semantics;
- structured logs có trace ID và span ID;
- RED metrics;
- `service.name`, `service.version`, `service.instance.id`.

Timestamp canonical là UTC, ISO-8601. Baseline controlled experiment dùng 100% trace sampling; giảm sampling chỉ dùng cho robustness experiment sau này.

Runtime/configuration của Collector, Prometheus, Tempo, Loki và Grafana thuộc `infrastructure/observability/`. Shared application instrumentation thuộc `packages/observability/`; hai tầng này không thay thế nhau.

Chi tiết source-code convention và telemetry attribute nằm trong [`backend_microservice_testbed_blueprint.md`](backend_microservice_testbed_blueprint.md).

## 8. Workload requirements

Workload phải tự động bằng k6 và được tách khỏi fault injection. Các profile ưu tiên:

1. normal mixed traffic;
2. submission peak;
3. grading burst;
4. healthy high-load spike.

Healthy high-load spike dùng để kiểm tra detector có nhầm tăng tải hợp lệ thành incident hay không. Profile phải ghi seed, tỷ lệ workflow, rate/stage và duration để có thể lặp lại.

## 9. Fault injection requirements

MVP tập trung 5 controlled scenario:

| Scenario | Category | Root-cause service | Component evidence |
| --- | --- | --- | --- |
| Course / Redis latency | Cache | `course` | `course-redis` |
| Submission -> storage latency | Downstream dependency | `submission` | `submission-storage` |
| Submission service error | Service error | `submission` | `submission-service` |
| Notification consumer slowdown / RabbitMQ backlog | Async queue | `notification` | `notification-consumer` |
| Submission CPU pressure hoặc crash | Resource/availability | `submission` | `submission-instance` |

Mỗi fault phải có start/stop, target, intensity, cleanup và verification. Application-level/dependency-level injector được ưu tiên cho Docker Compose; mechanism mặc định tắt ngoài experiment.

Không mở fault matrix trên mọi service. Scenario chỉ được giữ khi symptom quan sát được, ground truth rõ và chạy lặp lại ổn định.

## 10. Experiment và ground truth

Mỗi run phải gắn được workload profile, seed, fault configuration, timing, repetition, code/config version và artifact. Bộ trường tối thiểu và vị trí module được định nghĩa trong backend blueprint.

RCA ground truth tách hai mức:

```text
root_cause_service
root_cause_component
```

Primary Top-K/MRR đánh giá trên candidate set **service-level**. Component/dependency là evidence bổ sung trong MVP; không trộn hai mức trong cùng metric chính.

MVP evaluation floor:

```text
5 scenarios × 3 repetitions = 15 controlled runs
```

Target có thể mở rộng khoảng 30–60+ run nếu automation và thời gian cho phép. Không coi 60–100 run là điều kiện thành công.

## 11. MVP, Target và tiêu chí scope freeze

### MVP bắt buộc

- 6 business service + Gateway theo topology canonical;
- PostgreSQL, Redis, RabbitMQ và storage mock;
- HTTP + một async workflow `grade.completed`;
- OpenTelemetry metrics/traces/structured logs có correlation;
- workload, 5 fault scenario, ground truth và reset tự động;
- Docker Compose chạy lại được từ runbook;
- service-level RCA evaluation được hỗ trợ bằng telemetry/manifest.

### Target

- Assignment service;
- MinIO;
- workload/fault intensity đa dạng hơn;
- 30–60+ controlled runs;
- missing telemetry/sampling robustness;
- component evidence phong phú hơn.

### Scope freeze

Freeze business feature khi MVP topology, observability và năm fault scenario đã tạo được experiment hợp lệ. Sau đó ưu tiên bug, data quality, reproducibility, anomaly/RCA và evaluation.

## 12. Definition of Done của backend testbed

Backend chỉ đạt DoD khi có thể tự động lặp chuỗi:

```text
deploy
-> seed
-> run workload
-> collect correlated telemetry
-> inject known fault
-> observe propagated symptoms
-> persist manifest + ground truth
-> reset
-> repeat
```

API chạy được nhưng thiếu telemetry, fault control hoặc artifact tái lập chưa đủ để coi testbed hoàn thành.

## 13. Nội dung ngoài tài liệu này

- Cấu trúc repository, service template, contract path, instrumentation convention và technical DoD: [`backend_microservice_testbed_blueprint.md`](backend_microservice_testbed_blueprint.md).
- WHY/WHAT, research questions, phương pháp RCA và triết lý đánh giá: [`../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md).
- Timeline 24 tuần, milestone, primary/collaborator và weekly DoD: [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md).
