# Định hướng triển khai Backend Microservice làm Testbed cho đề tài Anomaly Detection & Root Cause Analysis

> **Vai trò của tài liệu:** Xác định phạm vi, kiến trúc và hướng triển khai phần backend microservice để phần này trở thành **testbed phục vụ trực tiếp** cho đề tài chính: phát hiện bất thường và hỗ trợ xác định nguyên nhân sự cố trong hệ thống microservice.
>
> **Domain đề xuất:** Learning Management System (LMS) thu gọn.
>
> **Nguyên tắc cốt lõi:** Backend không được phát triển như một sản phẩm LMS độc lập. Mọi service, database, cache, queue, workflow và fault scenario phải giúp tạo dependency, telemetry, lỗi có kiểm soát hoặc ground truth cho phần AI/RCA.

---

# 1. Mục tiêu của Backend Testbed

Phần backend đóng vai trò là **System Under Test (SUT)** cho hệ thống observability, anomaly detection và root cause analysis.

Backend cần đạt các mục tiêu:

1. Có đủ nhiều service và dependency để tạo bài toán microservice có ý nghĩa.
2. Có cả giao tiếp đồng bộ và bất đồng bộ.
3. Có database, cache và message queue để tạo nhiều loại failure.
4. Có thể instrument bằng OpenTelemetry để sinh metrics, traces và logs.
5. Có thể chủ động inject fault và biết chính xác root cause.
6. Có workload tự động để lặp lại experiment.
7. Có thể triển khai, reset và tái lập môi trường một cách ổn định.

Một feature LMS không phục vụ các mục tiêu trên nên được loại khỏi MVP.

---

# 2. Định vị LMS trong đề tài

LMS chỉ là **miền nghiệp vụ** để tạo một microservice testbed dễ hiểu và đủ giàu dependency.

Đề tài **không** nhằm xây dựng một LMS hoàn chỉnh cạnh tranh với các nền tảng thực tế.

Cách phát biểu phù hợp:

> Xây dựng một backend microservice theo domain LMS làm môi trường thử nghiệm có kiểm soát cho hệ thống phát hiện bất thường và root cause analysis.

Không nên phát biểu:

> Xây dựng một LMS hoàn chỉnh kết hợp AI.

Lý do chọn LMS:

- domain dễ mô hình hóa;
- có workflow xuyên nhiều service;
- có thể dùng cả HTTP/gRPC và message queue;
- có database, cache, object storage;
- dễ tạo load;
- dễ tạo fault và xác định ground truth.

---

# 3. Nguyên tắc kiểm soát scope

Với mỗi feature, nhóm cần hỏi:

> **Feature này có giúp tạo dependency, telemetry hoặc failure scenario đáng giá cho bài toán anomaly detection/RCA không?**

## Nên làm

- Login/Auth.
- Course.
- Enrollment.
- Assignment.
- Submission.
- Grading.
- Notification.
- PostgreSQL.
- Redis.
- RabbitMQ.
- Object storage giả lập hoặc MinIO.
- API Gateway.
- Load generator.
- Fault injection.
- OpenTelemetry.

## Không nên ưu tiên

- forum;
- chat realtime;
- video streaming;
- payment;
- recommendation;
- AI tutor;
- LLM grading;
- mobile app;
- advanced analytics;
- complex course editor.

Những phần trên làm tăng scope nhưng không cải thiện nhiều giá trị nghiên cứu của anomaly detection/RCA.

---

# 4. Quy mô service

## MVP

Khoảng 5–6 business service nếu tiến độ chậm.

## Target

Khoảng 7–8 business service.

Không nên cố đạt 15–20 service tự phát triển vì chi phí code, test, deploy, instrumentation và debug sẽ lấn át phần AI.

---

# 5. Kiến trúc service đề xuất

```text
                     +------------------+
                     |   API Gateway    |
                     +---------+--------+
                               |
     +-------------------------+---------------------------+
     |               |               |                    |
     v               v               v                    v
+---------+     +-----------+   +------------+      +-------------+
|  Auth   |     |  Course   |   | Enrollment |      | Assignment  |
+----+----+     +-----+-----+   +------+-----+      +------+------+
     |                |                |                   |
     v                +-----> Redis    v                   v
 PostgreSQL               PostgreSQL PostgreSQL         PostgreSQL
                                      |                   |
                                      +------> Course <---+
                                                          |
                                                          v
                                                   +--------------+
                                                   |  Submission  |
                                                   +------+-------+
                                                          |
                            +-----------------------------+------------------+
                            |                             |                  |
                            v                             v                  v
                       PostgreSQL                  Assignment         Object Storage
                            |
                            v
                     +-------------+
                     |   Grading   |
                     +------+------+
                            |
                +-----------+-----------+
                |                       |
                v                       v
           PostgreSQL                RabbitMQ
                                        |
                                        v
                               Notification Service
```

Kiến trúc trên chỉ là target. Trong MVP có thể giản lược nhưng phải giữ được dependency graph đủ phong phú.

---

# 6. Vai trò từng service

## 6.1. API Gateway

### Chức năng

- route request;
- xác thực request ở mức gateway;
- truyền trace context;
- chuẩn hóa error response.

### Giá trị với đề tài

- điểm vào thống nhất;
- root span của nhiều workflow;
- upstream symptom rõ khi downstream lỗi;
- phù hợp đo request rate/error/latency.

Không cần xây policy engine phức tạp.

---

## 6.2. Auth Service

### Chức năng tối thiểu

- login;
- verify token;
- role student/teacher;
- current user.

### Fault có thể tạo

- Auth DB latency;
- CPU saturation;
- token validation delay;
- service crash.

### Giá trị

Auth có thể trở thành shared dependency, khiến nhiều API cùng bị ảnh hưởng.

---

## 6.3. Course Service

### Chức năng

- create course;
- get course;
- list courses;
- update metadata cơ bản.

### Hạ tầng

- PostgreSQL;
- Redis cache cho course detail/list.

### Fault

- Redis slowdown;
- cache unavailable;
- DB latency;
- service memory/CPU pressure.

### Giá trị

Tạo được cache-specific fault và shared dependency cho Enrollment/Assignment.

---

## 6.4. Enrollment Service

### Chức năng

- enroll student;
- check enrollment;
- list enrolled courses.

### Dependency

```text
Enrollment -> Course Service
Enrollment -> Enrollment DB
```

### Fault

- DB pool exhaustion;
- Course timeout;
- high concurrent enroll requests.

---

## 6.5. Assignment Service

### Chức năng

- create assignment;
- get assignment;
- list assignments.

### Dependency

```text
Assignment -> Course Service
Assignment -> Assignment DB
```

### Fault

- database slowdown;
- CPU saturation;
- downstream timeout.

---

## 6.6. Submission Service

Đây nên là service quan trọng nhất trong synchronous workflow.

### Chức năng

- submit assignment;
- get submission;
- list submission;
- lưu metadata artifact.

### Dependency

```text
Submission
  ├──> Assignment Service
  ├──> Enrollment Service
  └──> Object Storage
```

### Giá trị

Có fan-out và call chain dài, rất phù hợp distributed tracing.

### Fault

- object storage latency;
- Assignment timeout;
- DB slowdown;
- CPU pressure;
- service error.

---

## 6.7. Grading Service

### Chức năng

- create/update grade;
- get grade;
- publish `grade.completed`.

### Dependency

```text
Grading -> Submission
Grading -> PostgreSQL
Grading -> RabbitMQ
```

### Giá trị

Nối synchronous processing với asynchronous workflow.

---

## 6.8. Notification Service

### Chức năng

Consume event và giả lập gửi notification.

Không cần gửi email thật.

### Fault

- consumer slowdown;
- worker crash;
- retry storm;
- queue backlog.

### Giá trị

Cho phép đánh giá sự cố bất đồng bộ, khác hoàn toàn HTTP timeout.

---

# 7. Workflow nghiệp vụ chính

Backend chỉ cần một số workflow đủ giàu dependency.

## W1 – Login

```text
Client -> Gateway -> Auth -> DB
```

## W2 – Browse Course

```text
Client -> Gateway -> Course -> Redis/PostgreSQL
```

## W3 – Enroll Course

```text
Client -> Gateway -> Enrollment -> Course
                            |
                            +-> Enrollment DB
```

## W4 – Submit Assignment

```text
Client
  -> Gateway
  -> Submission
       ├-> Assignment -> Course
       ├-> Enrollment
       └-> Object Storage
```

## W5 – Grade and Notify

```text
Teacher
  -> Gateway
  -> Grading
  -> DB
  -> RabbitMQ
  -> Notification
```

Năm workflow này là đủ để tạo:

- single dependency;
- shared dependency;
- fan-out;
- database/cache dependency;
- async queue;
- failure propagation.

---

# 8. Database strategy

Không cần một PostgreSQL instance cho từng service.

Có thể dùng:

```text
1 PostgreSQL server
+ nhiều logical database/schema
```

Ví dụ:

```text
auth_db
course_db
enrollment_db
assignment_db
submission_db
grading_db
```

Nguyên tắc bắt buộc:

> Service không query trực tiếp database/schema của service khác.

Service-to-service communication phải qua API hoặc event.

Điều này giữ đúng ranh giới microservice nhưng tiết kiệm tài nguyên.

---

# 9. Redis

Redis chỉ cần dùng ở Course Service.

Ví dụ:

```text
GET /courses/{id}
```

cache theo course ID.

Failure scenario:

- Redis latency;
- Redis unavailable;
- cache miss storm;
- cold cache.

Không cần đưa Redis vào mọi service.

---

# 10. RabbitMQ

RabbitMQ phù hợp scope hơn Kafka vì nhẹ và dễ vận hành.

MVP chỉ cần event:

```text
grade.completed
```

Target có thể thêm:

```text
submission.received
course.enrolled
```

Dùng RabbitMQ để tạo:

- queue backlog;
- consumer slowdown;
- retry;
- async propagation.

---

# 11. Object Storage

Có thể dùng:

```text
MinIO
```

hoặc một storage mock/service nhỏ.

Mục đích không phải xây hệ thống quản lý file phức tạp, mà để tạo external dependency cho Submission Service.

Nếu thiếu thời gian, có thể dùng storage mock có controllable latency/error.

---

# 12. Giao tiếp giữa service

## Synchronous

MVP:

```text
HTTP REST
```

Target nếu muốn:

```text
REST + 1–2 gRPC dependency
```

Không cần dùng nhiều protocol nếu làm tăng đáng kể độ phức tạp.

## Asynchronous

```text
RabbitMQ
```

---

# 13. Stack backend

Nhóm nên dùng một stack thống nhất cho business services.

Có thể chọn:

- Java/Spring Boot;
- Go;
- Node.js/NestJS.

AI/analysis platform có thể dùng Python riêng.

Không nên cố làm polyglot microservices chỉ để giống production nếu điều đó làm tăng chi phí vận hành.

---

# 14. API tối thiểu

Ví dụ:

```text
POST /api/v1/auth/login

GET  /api/v1/courses
GET  /api/v1/courses/{id}

POST /api/v1/enrollments
GET  /api/v1/enrollments/me

POST /api/v1/assignments
GET  /api/v1/assignments/{id}

POST /api/v1/submissions
GET  /api/v1/submissions/{id}

POST /api/v1/grades
GET  /api/v1/grades/{submissionId}
```

Không cần API quá rộng.

---

# 15. Error schema

Nên chuẩn hóa lỗi:

```json
{
  "code": "DEPENDENCY_TIMEOUT",
  "message": "Assignment service timeout",
  "traceId": "..."
}
```

Việc này giúp:

- log parsing;
- trace correlation;
- evidence extraction;
- demo incident.

---

# 16. Observability là requirement ngay từ đầu

Không xây xong backend rồi mới “gắn monitoring”.

Một service chỉ được coi là hoàn thành khi:

- inbound request có span;
- outbound call có client span;
- trace context được propagate;
- error được ghi vào span/log;
- có RED metrics;
- logs có trace ID;
- `service.name` chuẩn.

---

# 17. Telemetry tối thiểu

## Metrics

Mỗi service:

```text
request_count
request_error_count
request_duration
CPU
memory
```

Derived:

```text
request_rate
error_rate
p50/p95/p99 latency
```

Nếu framework hỗ trợ:

```text
GC
thread pool
event loop lag
connection pool
```

## Trace

Phải nhìn thấy full business flow.

Ví dụ:

```text
POST /submissions
  -> gateway
     -> submission
        -> assignment
           -> course
        -> enrollment
        -> object-storage
```

## Logs

Structured JSON, ưu tiên:

- dependency timeout;
- retry;
- DB error;
- queue event;
- service error.

Ví dụ:

```json
{
  "level": "ERROR",
  "service": "submission-service",
  "trace_id": "...",
  "event": "dependency_timeout",
  "dependency": "assignment-service",
  "latency_ms": 1532
}
```

---

# 18. OpenTelemetry topology

```text
Business Services
      |
      | OTLP
      v
OpenTelemetry Collector
      |
      +--> Prometheus
      +--> Tempo
      +--> Loki
```

Grafana có thể dùng để xem raw telemetry.

Phần AI/RCA sẽ đọc telemetry thông qua adapter/query layer riêng.

---

# 19. Fault Injection là bắt buộc

Fault injection không phải stretch goal.

Nếu không có fault có kiểm soát, nhóm rất khó có ground truth để đánh giá RCA.

Mỗi fault phải có:

```text
start
stop
target
type
intensity
```

---

# 20. Fault injection hai cấp

## Application-level

Chỉ bật ở test environment.

Ví dụ:

```text
FAULT_DELAY_MS
FAULT_ERROR_RATE
FAULT_CPU_STRESS
FAULT_DB_DELAY
```

hoặc internal fault endpoint.

## Infrastructure-level

Sau khi môi trường ổn định có thể dùng:

- Linux `tc/netem`;
- stress tool;
- Chaos Mesh nếu chuyển sang Kubernetes.

Khuyến nghị:

> Application-level fault trước, infrastructure-level fault sau.

---

# 21. Fault types MVP

Ít nhất 5 loại:

1. CPU saturation.
2. Network/dependency delay.
3. Service error injection.
4. Database latency.
5. Service crash.

Target có thể thêm:

6. Redis slowdown.
7. DB connection exhaustion.
8. RabbitMQ consumer slowdown/backlog.

---

# 22. Fault scenario map

| Component | Fault | Expected symptom | Giá trị cho RCA |
|---|---|---|---|
| Auth DB | latency | login và API phụ thuộc Auth chậm | shared dependency |
| Redis | latency/down | Course chậm | cache dependency |
| Enrollment DB | pool exhaustion | enroll lỗi/chậm | DB fault |
| Submission | CPU stress | p95 tăng, upstream timeout | service resource |
| Object Storage | network delay | submit chậm | external dependency |
| Grading | service error | grade request lỗi | service failure |
| RabbitMQ | broker/queue issue | event delayed | async infra |
| Notification | consumer slowdown | queue depth tăng | async root cause |

---

# 23. Ground Truth

Mỗi experiment phải lưu metadata:

```json
{
  "experiment_id": "exp-001",
  "fault_type": "network_delay",
  "target_service": "submission-service",
  "target_dependency": "object-storage",
  "start_time": "...",
  "end_time": "...",
  "intensity": "500ms",
  "workload_profile": "submission-heavy"
}
```

Đây là input bắt buộc cho phần đánh giá AI.

---

# 24. Workload generator

Không đánh giá bằng cách click UI thủ công.

Phải có automated load, ví dụ:

```text
k6
```

hoặc tool tương đương.

---

# 25. Workload profiles

## P1 – Normal Mixed

```text
40% browse course
20% login
15% enroll
15% submit
10% grade
```

## P2 – Read Heavy

Dùng để stress cache/Course.

## P3 – Submission Peak

Mô phỏng deadline nộp bài.

## P4 – Grading Burst

Mô phỏng chấm hàng loạt.

## P5 – Healthy Traffic Spike

Tăng traffic nhưng **không inject fault**.

P5 rất quan trọng để kiểm tra model có nhầm workload tăng với system failure không.

---

# 26. SLO giả lập

Có thể đặt internal SLO tham khảo:

```text
error rate < 2%
p95 latency < threshold theo workflow
```

Ví dụ:

```text
GET course p95 < 300ms
Submit assignment p95 < 800ms
```

Các giá trị cuối cùng phải benchmark trên máy thật.

SLO dùng để:

- xác định symptom;
- tính incident severity;
- hỗ trợ evaluation.

---

# 27. Backend không cần AI nghiệp vụ

Không cần:

- AI tutor;
- AI recommendation;
- LLM chatbot;
- automatic grading bằng LLM.

AI chính của đề tài là **operational intelligence** phục vụ developer/SRE.

Kiến trúc đúng:

```text
LMS business services
       |
       | telemetry
       v
Observability
       |
       v
AI anomaly/RCA platform
```

Không nhúng RCA model vào business request path.

---

# 28. Mối quan hệ giữa Backend và AI

Backend cung cấp:

```text
service topology
workload
faults
metrics
traces
logs
ground truth
```

AI sử dụng:

```text
telemetry
  ↓
feature engineering
  ↓
anomaly detection
  ↓
incident detection
  ↓
dependency analysis
  ↓
root cause ranking
```

Do đó hai phần không phải hai sản phẩm độc lập.

---

# 29. Kiến trúc tổng thể

```text
+--------------------------------------------------+
|            Client / Load Generator               |
+-------------------------+------------------------+
                          |
                          v
+--------------------------------------------------+
|                  LMS Microservices               |
| Gateway, Auth, Course, Enrollment, Assignment,  |
| Submission, Grading, Notification               |
+-------------------------+------------------------+
          |               |              |
          v               v              v
      PostgreSQL         Redis         RabbitMQ
          |
          +------------------------------+
                                         |
                                         v
                              OpenTelemetry Collector
                                         |
                          +--------------+--------------+
                          |              |              |
                          v              v              v
                     Prometheus        Tempo           Loki
                          |              |              |
                          +--------------+--------------+
                                         |
                                         v
                             AI / RCA Analysis Platform
```

---

# 30. Deployment strategy

## Phase 1 – Docker Compose

Bắt đầu bằng Compose vì:

- nhanh;
- debug dễ;
- reproducible;
- đủ để xây MVP.

Mục tiêu:

```text
docker compose up
```

khởi động được toàn testbed.

## Phase 2 – Kubernetes

Chỉ chuyển khi:

- service ổn định;
- instrumentation ổn;
- workload chạy được;
- fault automation chạy được;
- AI MVP đã có dữ liệu.

Kubernetes dùng để tăng realism và hỗ trợ Chaos Mesh, không phải đóng góp chính.

---

# 31. Kubernetes scope

Nếu triển khai:

```text
Deployment
Service
ConfigMap
Secret
Ingress/Gateway
resource requests/limits
```

Không cần:

- multi-cluster;
- custom operator;
- service mesh;
- advanced autoscaling;
- GitOps platform.

---

# 32. Frontend LMS

Frontend LMS không phải requirement trọng tâm.

Có thể có UI rất mỏng:

- login;
- course list;
- enroll;
- submit;
- grade.

Nếu thiếu thời gian:

> Swagger/OpenAPI + automated workload là đủ cho testbed.

Dashboard quan trọng hơn là **incident/RCA dashboard**.

---

# 33. Testing

## Unit

- business logic;
- fault config;
- helper.

## Integration

- PostgreSQL;
- Redis;
- RabbitMQ.

## Contract

- service-to-service API.

## End-to-end

- login;
- enroll;
- submit;
- grade-notify.

## Fault test

```text
inject fault
-> expected telemetry symptom appears
```

---

# 34. Timeout và retry

Mọi outbound call phải có timeout.

MVP nên giới hạn retry để fault propagation dễ hiểu.

Target có thể thêm retry ở 1–2 dependency để tạo scenario:

```text
downstream slow
-> retry
-> traffic amplification
```

Circuit breaker không cần ở MVP.

---

# 35. Naming và metadata

Tên service cố định, ví dụ:

```text
lms-gateway
auth-service
course-service
enrollment-service
assignment-service
submission-service
grading-service
notification-service
```

OpenTelemetry cần có:

```text
service.name
service.version
service.instance.id
```

Nếu Kubernetes có thể thêm:

```text
k8s.pod.name
k8s.namespace.name
```

---

# 36. Resource limits

Để CPU/memory fault có ý nghĩa, container cần resource limits hợp lý.

Không chốt con số cứng ngay từ đầu.

Phải benchmark trên máy thật.

---

# 37. Synthetic Data

Chỉ dùng dữ liệu giả:

```text
students
teachers
courses
assignments
```

Không cần dữ liệu sinh viên thật.

Không log:

- password;
- token;
- PII không cần thiết.

---

# 38. Repository gợi ý

```text
project/
|
+-- services/
|   +-- gateway/
|   +-- auth/
|   +-- course/
|   +-- enrollment/
|   +-- assignment/
|   +-- submission/
|   +-- grading/
|   +-- notification/
|
+-- infrastructure/
|   +-- compose/
|   +-- postgres/
|   +-- redis/
|   +-- rabbitmq/
|   +-- otel/
|   +-- prometheus/
|   +-- tempo/
|   +-- loki/
|
+-- load/
+-- faults/
+-- experiments/
+-- analysis/
+-- dashboard/
+-- docs/
```

---

# 39. Definition of Done cho một service

Một service chỉ xem là hoàn thành khi:

- API chạy;
- persistence chạy;
- error handling;
- health endpoint;
- OpenTelemetry trace;
- metrics;
- structured logs;
- trace propagation;
- test;
- Docker image;
- fault hook nếu là fault target.

---

# 40. Definition of Done cho toàn testbed

Testbed đạt yêu cầu khi có thể thực hiện chuỗi:

```text
deploy
  ↓
seed data
  ↓
run workload
  ↓
collect metrics/traces/logs
  ↓
inject fault
  ↓
observe propagated symptoms
  ↓
store ground truth
  ↓
reset
  ↓
repeat experiment
```

Nếu chưa tái lập được chuỗi này, backend chưa hoàn thành vai trò testbed.

---

# 41. Roadmap backend trong đồ án 24 tuần

Backend phải đủ ổn tương đối sớm để AI có dữ liệu thật.

## Tuần 1–2

- chốt service boundary;
- chốt workflow;
- chốt fault map;
- chốt telemetry requirement.

## Tuần 3–4

- Gateway/Auth/Course;
- PostgreSQL;
- Redis;
- Compose skeleton.

## Tuần 5–6

- Enrollment/Assignment/Submission;
- service-to-service calls;
- trace propagation.

## Tuần 7–8

- Grading/Notification;
- RabbitMQ;
- end-to-end workflows.

## Tuần 5–8 song song

- OpenTelemetry;
- Prometheus;
- Tempo;
- Loki.

## Tuần 7–9

- load generator;
- fault hooks;
- experiment metadata;
- automated reset.

## Từ tuần 9–10

Backend chuyển sang:

- maintenance;
- bug fixing;
- hỗ trợ experiment;
- thêm fault có giá trị.

Không tiếp tục mở rộng LMS feature nếu AI/RCA chưa ổn.

---

# 42. Phân chia công việc

## Thành viên Backend-primary

Primary:

- service architecture;
- API;
- DB/cache/queue;
- OpenTelemetry instrumentation;
- deployment;
- load generation;
- fault injection.

Secondary:

- experiment runner;
- telemetry adapter.

## Thành viên AI-primary

Primary:

- telemetry processing;
- feature engineering;
- anomaly detection;
- RCA;
- evaluation.

Secondary:

- telemetry schema;
- fault design;
- ground truth;
- integration.

Hai người phải cùng thiết kế:

```text
fault scenario
telemetry requirement
experiment protocol
```

vì đây là giao điểm của hai phần.

---

# 43. MVP Backend

MVP nên có:

```text
Gateway
Auth
Course
Enrollment
Assignment
Submission
Grading
Notification
```

Có thể giảm một service nếu cần.

Infrastructure:

```text
PostgreSQL
Redis
RabbitMQ
optional MinIO/storage mock
```

Workflow:

```text
login
browse
enroll
submit
grade + notify
```

Observability:

```text
metrics
traces
logs
```

Fault:

```text
CPU
network delay
service error
DB latency
crash
```

Load:

```text
automated
```

---

# 44. Target Backend

Sau MVP:

- Kubernetes;
- MinIO;
- Redis fault;
- DB pool exhaustion;
- queue backlog;
- gRPC ở một dependency;
- workload profile phong phú;
- retry behavior.

---

# 45. Stretch Goals

Chỉ làm nếu AI/RCA core đã hoàn thành:

- circuit breaker;
- service mesh;
- multi-instance service;
- version regression;
- canary deployment;
- instance-level RCA;
- multi-fault scenarios.

---

# 46. Những thứ phải cắt đầu tiên nếu thiếu thời gian

1. LMS UI.
2. MinIO, thay bằng storage mock.
3. gRPC.
4. Kubernetes.
5. Advanced auth.
6. Circuit breaker/service mesh.

Không được cắt:

- telemetry;
- distributed tracing;
- load generator;
- fault injection;
- ground truth;
- dependency graph đủ phong phú.

---

# 47. Scope Freeze

Khi đã có:

```text
7–8 service
PostgreSQL
Redis
RabbitMQ
5 workflow
5 fault type
OpenTelemetry
automated workload
```

thì freeze business feature.

Sau đó chỉ sửa:

- bug;
- instrumentation;
- experiment support.

---

# 48. Câu trả lời khi giảng viên hỏi “Tại sao LMS?”

> LMS không phải đóng góp chính của đồ án mà là miền nghiệp vụ được chọn để xây dựng một microservice testbed có kiểm soát. Domain này tạo ra nhiều workflow có dependency, database, cache và message queue, từ đó sinh telemetry và failure propagation đủ phong phú để đánh giá hệ thống phát hiện bất thường và root cause analysis.

---

# 49. Câu trả lời khi hỏi “Tại sao phải tự xây backend?”

> Việc tự xây backend giúp nhóm kiểm soát toàn bộ source code và kiến trúc, chủ động instrumentation, workload generation và fault injection. Quan trọng nhất, nhóm biết chính xác fault được inject ở service/dependency nào và thời điểm nào, nhờ đó có ground truth để đánh giá định lượng mô hình anomaly detection và RCA.

---

# 50. Câu trả lời khi hỏi “LMS có AI gì?”

> AI không phải feature nghiệp vụ cho sinh viên. AI nằm ở lớp vận hành hệ thống, sử dụng metrics, distributed traces và logs của backend microservice để phát hiện bất thường và hỗ trợ developer/SRE khoanh vùng nguyên nhân sự cố.

---

# 51. Câu trả lời khi hỏi “Hai phần có tách rời không?”

> Không. Backend được thiết kế từ đầu để tạo dependency, workload, telemetry và fault scenarios mà phần AI cần. Phần AI lại được đánh giá trực tiếp trên các incident phát sinh từ backend này. Backend tạo dữ liệu và ground truth; AI phân tích và chẩn đoán chính backend đó.

---

# 52. Tiêu chí thêm hoặc loại feature

## Thêm nếu feature giúp:

- tạo dependency mới có ý nghĩa;
- tạo async behavior;
- tạo DB/cache/queue bottleneck;
- tạo fault mới;
- tạo trace phong phú;
- hỗ trợ research question;
- tăng giá trị experiment.

## Loại nếu feature:

- chỉ làm LMS nhiều chức năng hơn;
- không tạo telemetry đáng giá;
- không tạo fault mới;
- không hỗ trợ ground truth;
- không hỗ trợ evaluation.

---

# 53. Kiến trúc MVP nên chốt

```text
Client / k6
    |
    v
API Gateway
    |
    +----> Auth ----------> PostgreSQL
    |
    +----> Course --------> PostgreSQL
    |          |
    |          +---------> Redis
    |
    +----> Enrollment ---> PostgreSQL
    |          |
    |          +---------> Course
    |
    +----> Assignment ---> PostgreSQL
    |          |
    |          +---------> Course
    |
    +----> Submission ---> PostgreSQL
    |          |
    |          +---------> Assignment
    |          +---------> Enrollment
    |          +---------> Storage
    |
    +----> Grading ------> PostgreSQL
               |
               +---------> Submission
               |
               +---------> RabbitMQ
                                |
                                v
                         Notification
```

Tất cả service:

```text
OpenTelemetry
    |
    v
Collector
    |
    +--> Prometheus
    +--> Tempo
    +--> Loki
```

Đây là scope đủ giàu để nghiên cứu nhưng vẫn kiểm soát được.

---

# 54. Checklist triển khai

## Architecture

- [ ] Chốt service boundary.
- [ ] Chốt dependency graph.
- [ ] Chốt database ownership.
- [ ] Chốt async event.
- [ ] Chốt fault map.

## Business

- [ ] Login.
- [ ] Course browse.
- [ ] Enrollment.
- [ ] Assignment.
- [ ] Submission.
- [ ] Grading.
- [ ] Notification.

## Infrastructure

- [ ] PostgreSQL.
- [ ] Redis.
- [ ] RabbitMQ.
- [ ] Docker Compose.

## Observability

- [ ] OpenTelemetry.
- [ ] Prometheus.
- [ ] Tempo.
- [ ] Loki.
- [ ] Trace context propagation.
- [ ] Trace-log correlation.

## Experiment

- [ ] Load generator.
- [ ] Experiment metadata.
- [ ] CPU fault.
- [ ] Network/dependency delay.
- [ ] Service error.
- [ ] DB latency.
- [ ] Crash.
- [ ] Automated reset.

## Validation

- [ ] Fault tạo đúng symptom.
- [ ] Trace thấy propagation.
- [ ] Metrics thấy anomaly.
- [ ] Logs có evidence.
- [ ] Ground truth lưu được.
- [ ] Có thể lặp experiment.

---

# 55. Kết luận

Phần backend nên được xem là một **microservice experimentation platform mang domain LMS**, không phải một LMS hoàn chỉnh.

Giá trị của backend nằm ở việc tạo ra:

```text
realistic topology
+
synchronous dependencies
+
asynchronous dependencies
+
database/cache/queue
+
controlled workload
+
controlled faults
+
observability telemetry
+
known ground truth
```

Từ đó phần AI có thể thực hiện:

```text
anomaly detection
+
incident detection
+
root-cause candidate ranking
+
evidence extraction
+
quantitative evaluation
```

Quan hệ giữa hai phần phải luôn giữ rõ:

```text
Backend tạo ra failure có kiểm soát
             ↓
Telemetry ghi nhận failure và propagation
             ↓
AI phát hiện và xếp hạng root cause
             ↓
Ground truth dùng để đo xem AI đúng đến đâu
```

Đây là cách để toàn bộ đồ án đi theo **một hướng kỹ thuật thống nhất**, đồng thời vẫn thể hiện rõ năng lực backend/software engineering của nhóm.

---

# 56. Câu mô tả ngắn có thể đưa vào tài liệu đề tài

> Nhóm xây dựng một backend microservice theo miền nghiệp vụ LMS ở phạm vi thu gọn, gồm các service đại diện cho xác thực, khóa học, đăng ký học, bài tập, nộp bài, chấm điểm và thông báo. Hệ thống có cả giao tiếp đồng bộ và bất đồng bộ, sử dụng database, cache và message queue, đồng thời được instrument bằng OpenTelemetry. Backend đóng vai trò là môi trường thử nghiệm có kiểm soát để nhóm tạo workload, inject fault tại service hoặc dependency, thu thập metrics/traces/logs và cung cấp ground truth phục vụ đánh giá hệ thống phát hiện bất thường và root cause analysis.

---

# 57. Quy tắc kiểm soát scope cuối cùng

Trong suốt quá trình triển khai, với mỗi thay đổi hãy hỏi:

> **“Thay đổi này làm testbed tốt hơn cho anomaly detection/RCA, hay chỉ làm LMS nhiều chức năng hơn?”**

Nếu chủ yếu là vế thứ hai, nên trì hoãn hoặc loại bỏ.
