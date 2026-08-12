# Khung định hướng tổng thể đồ án tốt nghiệp
## Xây dựng Microservice Testbed và hệ thống phát hiện bất thường, hỗ trợ phân tích nguyên nhân sự cố bằng dữ liệu observability và AI/ML

> **Phiên bản:** 1.0 – Bản hợp nhất Backend Microservice + Observability + AI/RCA  
> **Quy mô nhóm:** 2 thành viên  
> **Thời lượng:** 24 tuần  
> **Định hướng:** Software Engineering / Backend / Distributed Systems / Observability / AIOps / Machine Learning  
> **Domain testbed:** Learning Management System (LMS) thu gọn  
> **Đối tượng sử dụng hệ thống AI:** Developer / SRE / người vận hành hệ thống  
> **Nguyên tắc:** LMS không phải sản phẩm độc lập; backend microservice được xây dựng có chủ đích để làm môi trường thử nghiệm, tạo telemetry, fault propagation và ground truth cho hệ thống anomaly detection/RCA.

---

# 0. Cách sử dụng tài liệu

Đây là **living document** dùng làm xương sống kỹ thuật cho toàn bộ đồ án. Tài liệu không phải đề cương đăng ký ngắn gọn và cũng không phải báo cáo cuối cùng. Trong quá trình thực hiện, nhóm có thể điều chỉnh:

- số lượng service;
- lựa chọn backend framework;
- fault scenarios;
- anomaly detector;
- cách fusion telemetry;
- công thức root-cause ranking;
- technology stack;
- deployment platform;
- benchmark.

Tuy nhiên, nhóm nên giữ ổn định **bài toán cốt lõi**:

> Xây dựng một microservice testbed có kiểm soát, quan sát hệ thống bằng metrics/traces/logs, sử dụng AI/ML và phân tích dependency để phát hiện incident và xếp hạng các root-cause candidates, sau đó đánh giá bằng fault injection có ground truth.

Mọi thay đổi lớn nên được ghi lại bằng Architecture Decision Record (ADR).

---

# 1. Tóm tắt đề tài

## 1.1. Bài toán

Trong kiến trúc microservice, một request thường đi qua nhiều service, database, cache và message queue. Khi một dependency gặp sự cố, lỗi có thể lan truyền:

```text
Root cause
   ↓
Service trực tiếp bị ảnh hưởng
   ↓
Service upstream
   ↓
API Gateway
   ↓
Người dùng nhìn thấy timeout/error
```

Developer thường phải kiểm tra nhiều nguồn:

```text
metrics
logs
distributed traces
deployment/runtime state
```

để trả lời hai câu hỏi:

1. **Khi nào hệ thống bắt đầu có hành vi bất thường?**
2. **Thành phần nào có khả năng là nguyên nhân ban đầu, thay vì chỉ là nơi biểu hiện triệu chứng?**

## 1.2. Giải pháp tổng thể của nhóm

Nhóm xây hai khối gắn chặt với nhau.

### Khối A – LMS Microservice Testbed

Một backend LMS thu gọn gồm các service như:

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

kết hợp:

```text
PostgreSQL
Redis
RabbitMQ
Object Storage / Storage Mock
```

Testbed được instrument bằng OpenTelemetry và hỗ trợ automated workload + fault injection.

### Khối B – Incident Diagnosis Platform

Hệ thống phân tích:

```text
metrics + traces + logs
          ↓
feature engineering
          ↓
anomaly detection
          ↓
incident detection
          ↓
dynamic dependency graph
          ↓
temporal/propagation analysis
          ↓
root-cause candidate ranking
          ↓
evidence + timeline + dashboard
```

## 1.3. Điểm thống nhất của toàn đề tài

Backend và AI **không phải hai đề tài con**.

```text
Backend tạo ra hành vi và failure có kiểm soát
                      ↓
OpenTelemetry ghi lại hệ quả trên hệ thống
                      ↓
AI/RCA phân tích telemetry đó
                      ↓
Ground truth từ fault injection dùng để đánh giá AI
```

Nếu bỏ backend testbed, nhóm mất môi trường thực nghiệm có kiểm soát.  
Nếu bỏ AI/RCA, backend chỉ còn là một LMS microservice thông thường.

---

# 2. Định vị đề tài

## 2.1. Đây không phải đề tài “LMS có AI”

AI không phục vụ trực tiếp student/teacher như:

- chatbot;
- AI tutor;
- recommendation;
- automatic grading;
- content generation.

AI phục vụ **developer/SRE** và giải quyết bài toán vận hành hệ thống.

Tên miền LMS chỉ là bối cảnh nghiệp vụ.

## 2.2. Đây cũng không chỉ là monitoring

Monitoring truyền thống có thể cho biết:

```text
submission/service X đang latency cao
CPU đang cao
error rate vượt threshold
```

Đề tài tiến thêm một bước:

```text
Có incident hay chưa?
Anomaly bắt đầu từ đâu?
Service nào chỉ là symptom?
Dependency nào đáng nghi?
Top-3 root-cause candidates là gì?
Bằng chứng nào hỗ trợ ranking?
```

## 2.3. Đây là bài toán AIOps thu nhỏ

Đề tài kết hợp:

- distributed systems;
- observability;
- backend engineering;
- time-series/tabular ML;
- anomaly detection;
- graph analysis;
- statistical reasoning;
- experiment design;
- fault injection.

---

# 3. Định hướng theo state of the art nhưng giữ khả thi

Phần này phân biệt rõ **xu hướng nghiên cứu hiện tại** và **phương pháp thực tế nhóm dự kiến triển khai**.

## 3.1. Multi-source telemetry

Eadro (ICSE 2023) cho thấy lợi ích của việc kết hợp traces, logs và KPI/metrics thay vì chỉ dùng một nguồn telemetry. Công trình này đồng thời xem anomaly detection và root-cause localization như hai nhiệm vụ có quan hệ chặt chẽ.

**Áp dụng cho đồ án:** Target sử dụng metrics + traces + structured logs. MVP có thể ưu tiên metrics + traces trước nhưng schema phải sẵn sàng cho logs.

## 3.2. Detection và RCA không nên tách hoàn toàn

BARO (FSE 2024) chỉ ra rằng sai số ở bước xác định thời điểm anomaly có thể ảnh hưởng mạnh tới RCA và đề xuất pipeline tích hợp change-point detection với robust statistical testing.

**Áp dụng:** Incident phải lưu `estimated_start_time`; RCA so sánh pre-incident và incident windows, không chỉ nhìn một snapshot.

## 3.3. Causal discovery có giá trị nhưng có giới hạn

Một đánh giá quy mô lớn về causal inference-based RCA (ASE 2024) cho thấy không có phương pháp nào vượt trội trong mọi tình huống; hiệu quả, runtime và độ nhạy tham số là các trade-off thực tế, đặc biệt khi số lượng metric lớn.

**Áp dụng:** Không đặt full causal discovery trên toàn bộ telemetry làm core. Trace-derived dependency graph đóng vai trò structural prior; causal analysis top-N chỉ là extension.

## 3.4. Benchmark và reproducibility là bắt buộc

RCAEval (WWW 2025) công bố benchmark gồm 9 dataset, 735 failure cases và 15 reproducible baselines bao phủ metric-based, trace-based và multi-source RCA.

**Áp dụng:** Đồ án phải có ground truth, Top-K, MRR, baseline và repeated experiments. Không đánh giá bằng vài case demo.

## 3.5. Benchmark realism vẫn là vấn đề mở

Các nghiên cứu đánh giá gần đây nhấn mạnh rằng thứ hạng trên benchmark không đồng nghĩa chắc chắn với hiệu quả trong hệ thống thực tế; fault propagation, missing telemetry, topology và scale có thể thay đổi kết quả đáng kể.

**Áp dụng:** Dataset tự sinh trên backend của nhóm là nguồn đánh giá chính; external benchmark chỉ là lớp kiểm chứng bổ sung.

## 3.6. Hướng 2026: blind spots và fine-grained RCA

TORAI (FSE 2026) hướng tới unsupervised multi-source RCA trong trường hợp service call graph có blind spots, kết hợp anomaly severity, clustering, causal analysis và statistical hypothesis testing để đi từ root-cause service tới indicator chi tiết.

AnoMod (MSR 2026) mở rộng phạm vi dataset với nhiều modality và nhiều loại anomaly hơn: performance-level, service-level, database-level và code-level.

**Áp dụng:** Đồ án nên coi:
- missing trace;
- missing modality;
- indicator-level evidence;
- robustness

là các hướng đánh giá quan trọng, nhưng không cần tái hiện đầy đủ TORAI/AnoMod.

## 3.7. Phương châm kỹ thuật

> **SOTA-inspired, engineering-feasible, quantitatively evaluated.**

Nhóm không cần chứng minh một neural architecture mới. Đóng góp phù hợp hơn là:

- xây testbed có kiểm soát;
- thiết kế multi-source feature pipeline;
- chọn và so sánh anomaly detector;
- thiết kế graph/temporal RCA ranker;
- chứng minh từng thành phần có ích qua ablation;
- đánh giá robustness/runtime.

---

# 4. Tên đề tài gợi ý

## Phương án khuyến nghị

**Xây dựng hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố trong kiến trúc microservice dựa trên dữ liệu observability và học máy**

Tên này đủ rộng để bao gồm backend testbed nhưng không biến LMS thành trọng tâm.

## Phương án nhấn mạnh RCA

**Phát hiện bất thường và xếp hạng nguyên nhân sự cố trong hệ thống microservice dựa trên telemetry đa nguồn và đồ thị phụ thuộc dịch vụ**

## Phương án nhấn mạnh sản phẩm

**Xây dựng nền tảng AIOps hỗ trợ phát hiện và chẩn đoán sự cố cho hệ thống microservice**

Trong báo cáo có thể mô tả:

> Nhóm xây dựng một LMS microservice thu gọn làm môi trường thử nghiệm cho giải pháp.

Không nhất thiết đưa “LMS” vào tên đề tài chính.

---

# 5. Phát biểu bài toán

Cho hệ thống microservice có tập service:

```text
S = {s1, s2, ..., sn}
```

Trong một cửa sổ thời gian `W`, hệ thống thu thập:

```text
M(W) = metrics
T(W) = distributed traces
L(W) = logs
```

Cần giải quyết:

## Task 1 – Anomaly Detection

Ước lượng:

```text
AnomalyScore(service, window)
```

và xác định khi nào hành vi khác đáng kể so với baseline bình thường.

## Task 2 – Incident Detection

Nhóm các anomaly liên quan về thời gian/topology thành một incident thay vì tạo hàng loạt alert riêng lẻ.

## Task 3 – Root Cause Candidate Ranking

Với incident `I`, trả về:

```text
[
  {entity: X, score: 0.91},
  {entity: Y, score: 0.66},
  {entity: Z, score: 0.31}
]
```

## Task 4 – Evidence

Giải thích candidate bằng:

- metric thay đổi mạnh;
- dependency edge latency/error;
- abnormal span;
- log template burst;
- thời điểm anomaly;
- propagation path.

## Task 5 – Evaluation

So prediction với root cause đã biết từ fault injection.

---

# 6. Mục tiêu

## 6.1. Mục tiêu tổng quát

Xây dựng và đánh giá một hệ thống hoàn chỉnh có khả năng tự động thu thập observability telemetry từ microservice backend, phát hiện incident và hỗ trợ developer/SRE khoanh vùng nguyên nhân sự cố.

## 6.2. Mục tiêu kỹ thuật

1. Xây LMS microservice testbed đủ giàu dependency.
2. Instrument metrics/traces/logs bằng OpenTelemetry.
3. Tự động sinh workload.
4. Tự động inject fault và ghi ground truth.
5. Xây feature engineering pipeline.
6. Cài đặt ít nhất một statistical baseline và một ML anomaly detector.
7. Xây dynamic dependency graph từ trace.
8. Xây root-cause candidate ranking.
9. Trả evidence và incident timeline.
10. Xây API/dashboard.
11. Chạy benchmark có lặp, baseline và ablation.

---

# 7. Câu hỏi nghiên cứu

## RQ1

**Multi-source telemetry có cải thiện anomaly detection và RCA so với metrics-only không?**

So sánh:

```text
M
M + T
M + T + L
```

## RQ2

**Dependency graph từ distributed traces có cải thiện root-cause ranking so với chỉ rank theo anomaly severity không?**

## RQ3

**Temporal precedence có giúp phân biệt root cause với propagated symptoms không?**

## RQ4

**Hệ thống suy giảm thế nào khi trace bị sampling hoặc một modality bị thiếu?**

## RQ5

**Trade-off giữa accuracy, runtime, complexity và interpretability của các phương pháp là gì?**

## RQ6 – tùy chọn

**Các fault category khác nhau (resource, DB, network, cache, async queue) ảnh hưởng thế nào đến khả năng detection/RCA?**

---

# 8. Phạm vi

## Trong phạm vi

- LMS backend 5–8 business services;
- HTTP REST, optional gRPC;
- RabbitMQ async event;
- PostgreSQL;
- Redis;
- optional MinIO/storage mock;
- OpenTelemetry;
- metrics/traces/logs;
- automated workload;
- controlled fault injection;
- service-level RCA;
- dependency-level evidence;
- online/near-real-time detection;
- API + dashboard;
- quantitative experiment.

## Không phải core

- full LMS frontend;
- AI tutor/recommendation/grading;
- multi-agent;
- LLM root-cause reasoning;
- automatic remediation;
- self-healing;
- full eBPF;
- service mesh;
- multi-cluster Kubernetes;
- code-level bug localization;
- multi-fault incident trong MVP.

---

# 9. Kiến trúc tổng thể

```text
                        USER / K6
                           |
                           v
+------------------------------------------------------------+
|                  LMS MICROSERVICE TESTBED                   |
|                                                            |
| Gateway -> Auth                                            |
|        -> Course -> Redis                                  |
|        -> Enrollment -> Course                             |
|        -> Assignment -> Course                             |
|        -> Submission -> Assignment/Enrollment/Storage      |
|        -> Grading -> Submission -> RabbitMQ -> Notification|
|                                                            |
|                 PostgreSQL logical DBs                     |
+-----------------------------+------------------------------+
                              |
                     OpenTelemetry SDK
                              |
                              v
                  OpenTelemetry Collector
                   /          |           \
                  v           v            v
             Prometheus      Tempo         Loki
                  \           |            /
                   \          |           /
                    +---------+----------+
                              |
                              v
+------------------------------------------------------------+
|                 INCIDENT DIAGNOSIS PLATFORM                 |
|                                                            |
| Telemetry Adapter                                          |
|      -> Windowing / Feature Engine                         |
|      -> Anomaly Detector                                   |
|      -> Incident Engine                                    |
|      -> Dependency Graph                                   |
|      -> RCA Ranker                                         |
|      -> Evidence Extractor                                 |
|      -> Evaluation Engine                                  |
+-----------------------------+------------------------------+
                              |
                              v
                    API / Incident Dashboard
```

---

# 10. Nguyên tắc tích hợp Backend ↔ AI

## 10.1. AI chạy out-of-band

Không để business service gọi trực tiếp model RCA.

Sai:

```text
Submission -> AI RCA -> response
```

Đúng:

```text
Submission -> telemetry -> Collector -> Analysis Platform
```

## 10.2. Backend phải được thiết kế cho experiment

Backend không chỉ “chạy được”. Nó phải:

- instrument được;
- fault được;
- reset được;
- tạo workload được;
- reproduce được.

## 10.3. Scope business đóng băng sớm

Khi đạt đủ topology/fault diversity, không thêm LMS feature mới chỉ vì sản phẩm chưa “đẹp”.

---

# PHẦN B – BACKEND MICROSERVICE TESTBED

Phần dưới đây là đặc tả chi tiết cho backend testbed. Đây là một phần của đề tài thống nhất, không phải dự án LMS độc lập.


## B1. Mục tiêu của Backend Testbed

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

## B2. Định vị LMS trong đề tài

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

## B3. Nguyên tắc kiểm soát scope

Với mỗi feature, nhóm cần hỏi:

> **Feature này có giúp tạo dependency, telemetry hoặc failure scenario đáng giá cho bài toán anomaly detection/RCA không?**

### Nên làm

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

### Không nên ưu tiên

- forum;
- chat realtime;
- video streaming;
- submission;
- recommendation;
- AI tutor;
- LLM grading;
- mobile app;
- advanced analytics;
- complex course editor.

Những phần trên làm tăng scope nhưng không cải thiện nhiều giá trị nghiên cứu của anomaly detection/RCA.

---

## B4. Quy mô service

### MVP

Khoảng 5–6 business service nếu tiến độ chậm.

### Target

Khoảng 7–8 business service.

Không nên cố đạt 15–20 service tự phát triển vì chi phí code, test, deploy, instrumentation và debug sẽ lấn át phần AI.

---

## B5. Kiến trúc service đề xuất

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

## B6. Vai trò từng service

### 6.1. API Gateway

#### Chức năng

- route request;
- xác thực request ở mức gateway;
- truyền trace context;
- chuẩn hóa error response.

#### Giá trị với đề tài

- điểm vào thống nhất;
- root span của nhiều workflow;
- upstream symptom rõ khi downstream lỗi;
- phù hợp đo request rate/error/latency.

Không cần xây policy engine phức tạp.

---

### 6.2. Auth Service

#### Chức năng tối thiểu

- login;
- verify token;
- role student/teacher;
- current user.

#### Fault có thể tạo

- Auth DB latency;
- CPU saturation;
- token validation delay;
- service crash.

#### Giá trị

Auth có thể trở thành shared dependency, khiến nhiều API cùng bị ảnh hưởng.

---

### 6.3. Course Service

#### Chức năng

- create course;
- get course;
- list courses;
- update metadata cơ bản.

#### Hạ tầng

- PostgreSQL;
- Redis cache cho course detail/list.

#### Fault

- Redis slowdown;
- cache unavailable;
- DB latency;
- service memory/CPU pressure.

#### Giá trị

Tạo được cache-specific fault và shared dependency cho Enrollment/Assignment.

---

### 6.4. Enrollment Service

#### Chức năng

- enroll student;
- check enrollment;
- list enrolled courses.

#### Dependency

```text
Enrollment -> Course Service
Enrollment -> Enrollment DB
```

#### Fault

- DB pool exhaustion;
- Course timeout;
- high concurrent enroll requests.

---

### 6.5. Assignment Service

#### Chức năng

- create assignment;
- get assignment;
- list assignments.

#### Dependency

```text
Assignment -> Course Service
Assignment -> Assignment DB
```

#### Fault

- database slowdown;
- CPU saturation;
- downstream timeout.

---

### 6.6. Submission Service

Đây nên là service quan trọng nhất trong synchronous workflow.

#### Chức năng

- submit assignment;
- get submission;
- list submission;
- lưu metadata artifact.

#### Dependency

```text
Submission
  ├──> Assignment Service
  ├──> Enrollment Service
  └──> Object Storage
```

#### Giá trị

Có fan-out và call chain dài, rất phù hợp distributed tracing.

#### Fault

- object storage latency;
- Assignment timeout;
- DB slowdown;
- CPU pressure;
- service error.

---

### 6.7. Grading Service

#### Chức năng

- create/update grade;
- get grade;
- publish `grade.completed`.

#### Dependency

```text
Grading -> Submission
Grading -> PostgreSQL
Grading -> RabbitMQ
```

#### Giá trị

Nối synchronous processing với asynchronous workflow.

---

### 6.8. Notification Service

#### Chức năng

Consume event và giả lập gửi notification.

Không cần gửi email thật.

#### Fault

- consumer slowdown;
- worker crash;
- retry storm;
- queue backlog.

#### Giá trị

Cho phép đánh giá sự cố bất đồng bộ, khác hoàn toàn HTTP timeout.

---

## B7. Workflow nghiệp vụ chính

Backend chỉ cần một số workflow đủ giàu dependency.

### W1 – Login

```text
Client -> Gateway -> Auth -> DB
```

### W2 – Browse Course

```text
Client -> Gateway -> Course -> Redis/PostgreSQL
```

### W3 – Enroll Course

```text
Client -> Gateway -> Enrollment -> Course
                            |
                            +-> Enrollment DB
```

### W4 – Submit Assignment

```text
Client
  -> Gateway
  -> Submission
       ├-> Assignment -> Course
       ├-> Enrollment
       └-> Object Storage
```

### W5 – Grade and Notify

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

## B8. Database strategy

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

## B9. Redis

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

## B10. RabbitMQ

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

## B11. Object Storage

Có thể dùng:

```text
MinIO
```

hoặc một storage mock/service nhỏ.

Mục đích không phải xây hệ thống quản lý file phức tạp, mà để tạo external dependency cho Submission Service.

Nếu thiếu thời gian, có thể dùng storage mock có controllable latency/error.

---

## B12. Giao tiếp giữa service

### Synchronous

MVP:

```text
HTTP REST
```

Target nếu muốn:

```text
REST + 1–2 gRPC dependency
```

Không cần dùng nhiều protocol nếu làm tăng đáng kể độ phức tạp.

### Asynchronous

```text
RabbitMQ
```

---

## B13. Stack backend

Nhóm nên dùng một stack thống nhất cho business services.

Có thể chọn:

- Java/Spring Boot;
- Go;
- Node.js/NestJS.

AI/analysis platform có thể dùng Python riêng.

Không nên cố làm polyglot microservices chỉ để giống production nếu điều đó làm tăng chi phí vận hành.

---

## B14. API tối thiểu

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

## B15. Error schema

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

## B16. Observability là requirement ngay từ đầu

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

## B17. Telemetry tối thiểu

### Metrics

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

### Trace

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

### Logs

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

## B18. OpenTelemetry topology

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

## B19. Fault Injection là bắt buộc

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

## B20. Fault injection hai cấp

### Application-level

Chỉ bật ở test environment.

Ví dụ:

```text
FAULT_DELAY_MS
FAULT_ERROR_RATE
FAULT_CPU_STRESS
FAULT_DB_DELAY
```

hoặc internal fault endpoint.

### Infrastructure-level

Sau khi môi trường ổn định có thể dùng:

- Linux `tc/netem`;
- stress tool;
- Chaos Mesh nếu chuyển sang Kubernetes.

Khuyến nghị:

> Application-level fault trước, infrastructure-level fault sau.

---

## B21. Fault types MVP

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

## B22. Fault scenario map

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

## B23. Ground Truth

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

## B24. Workload generator

Không đánh giá bằng cách click UI thủ công.

Phải có automated load, ví dụ:

```text
k6
```

hoặc tool tương đương.

---

## B25. Workload profiles

### P1 – Normal Mixed

```text
40% browse course
20% login
15% enroll
15% submit
10% grade
```

### P2 – Read Heavy

Dùng để stress cache/Course.

### P3 – Submission Peak

Mô phỏng deadline nộp bài.

### P4 – Grading Burst

Mô phỏng chấm hàng loạt.

### P5 – Healthy Traffic Spike

Tăng traffic nhưng **không inject fault**.

P5 rất quan trọng để kiểm tra model có nhầm workload tăng với system failure không.

---

## B26. SLO giả lập

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

## B27. Backend không cần AI nghiệp vụ

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

## B28. Mối quan hệ giữa Backend và AI

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

## B29. Kiến trúc tổng thể

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

## B30. Deployment strategy

### Phase 1 – Docker Compose

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

### Phase 2 – Kubernetes

Chỉ chuyển khi:

- service ổn định;
- instrumentation ổn;
- workload chạy được;
- fault automation chạy được;
- AI MVP đã có dữ liệu.

Kubernetes dùng để tăng realism và hỗ trợ Chaos Mesh, không phải đóng góp chính.

---

## B31. Kubernetes scope

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

## B32. Frontend LMS

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

## B33. Testing

### Unit

- business logic;
- fault config;
- helper.

### Integration

- PostgreSQL;
- Redis;
- RabbitMQ.

### Contract

- service-to-service API.

### End-to-end

- login;
- enroll;
- submit;
- grade-notify.

### Fault test

```text
inject fault
-> expected telemetry symptom appears
```

---

## B34. Timeout và retry

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

## B35. Naming và metadata

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

## B36. Resource limits

Để CPU/memory fault có ý nghĩa, container cần resource limits hợp lý.

Không chốt con số cứng ngay từ đầu.

Phải benchmark trên máy thật.

---

## B37. Synthetic Data

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

## B38. Repository gợi ý

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

## B39. Definition of Done cho một service

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

## B40. Definition of Done cho toàn testbed

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

## B41. Roadmap backend trong đồ án 24 tuần

Backend phải đủ ổn tương đối sớm để AI có dữ liệu thật.

### Tuần 1–2

- chốt service boundary;
- chốt workflow;
- chốt fault map;
- chốt telemetry requirement.

### Tuần 3–4

- Gateway/Auth/Course;
- PostgreSQL;
- Redis;
- Compose skeleton.

### Tuần 5–6

- Enrollment/Assignment/Submission;
- service-to-service calls;
- trace propagation.

### Tuần 7–8

- Grading/Notification;
- RabbitMQ;
- end-to-end workflows.

### Tuần 5–8 song song

- OpenTelemetry;
- Prometheus;
- Tempo;
- Loki.

### Tuần 7–9

- load generator;
- fault hooks;
- experiment metadata;
- automated reset.

### Từ tuần 9–10

Backend chuyển sang:

- maintenance;
- bug fixing;
- hỗ trợ experiment;
- thêm fault có giá trị.

Không tiếp tục mở rộng LMS feature nếu AI/RCA chưa ổn.

---

## B42. Phân chia công việc

### Thành viên Backend-primary

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

### Thành viên AI-primary

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

## B43. MVP Backend

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

## B44. Target Backend

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

## B45. Stretch Goals

Chỉ làm nếu AI/RCA core đã hoàn thành:

- circuit breaker;
- service mesh;
- multi-instance service;
- version regression;
- canary deployment;
- instance-level RCA;
- multi-fault scenarios.

---

## B46. Những thứ phải cắt đầu tiên nếu thiếu thời gian

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

## B47. Scope Freeze

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

## B48. Câu trả lời khi giảng viên hỏi “Tại sao LMS?”

> LMS không phải đóng góp chính của đồ án mà là miền nghiệp vụ được chọn để xây dựng một microservice testbed có kiểm soát. Domain này tạo ra nhiều workflow có dependency, database, cache và message queue, từ đó sinh telemetry và failure propagation đủ phong phú để đánh giá hệ thống phát hiện bất thường và root cause analysis.

---

## B49. Câu trả lời khi hỏi “Tại sao phải tự xây backend?”

> Việc tự xây backend giúp nhóm kiểm soát toàn bộ source code và kiến trúc, chủ động instrumentation, workload generation và fault injection. Quan trọng nhất, nhóm biết chính xác fault được inject ở service/dependency nào và thời điểm nào, nhờ đó có ground truth để đánh giá định lượng mô hình anomaly detection và RCA.

---

## B50. Câu trả lời khi hỏi “LMS có AI gì?”

> AI không phải feature nghiệp vụ cho sinh viên. AI nằm ở lớp vận hành hệ thống, sử dụng metrics, distributed traces và logs của backend microservice để phát hiện bất thường và hỗ trợ developer/SRE khoanh vùng nguyên nhân sự cố.

---

## B51. Câu trả lời khi hỏi “Hai phần có tách rời không?”

> Không. Backend được thiết kế từ đầu để tạo dependency, workload, telemetry và fault scenarios mà phần AI cần. Phần AI lại được đánh giá trực tiếp trên các incident phát sinh từ backend này. Backend tạo dữ liệu và ground truth; AI phân tích và chẩn đoán chính backend đó.

---

## B52. Tiêu chí thêm hoặc loại feature

### Thêm nếu feature giúp:

- tạo dependency mới có ý nghĩa;
- tạo async behavior;
- tạo DB/cache/queue bottleneck;
- tạo fault mới;
- tạo trace phong phú;
- hỗ trợ research question;
- tăng giá trị experiment.

### Loại nếu feature:

- chỉ làm LMS nhiều chức năng hơn;
- không tạo telemetry đáng giá;
- không tạo fault mới;
- không hỗ trợ ground truth;
- không hỗ trợ evaluation.

---

## B53. Kiến trúc MVP nên chốt

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

## B54. Checklist triển khai

### Architecture

- [ ] Chốt service boundary.
- [ ] Chốt dependency graph.
- [ ] Chốt database ownership.
- [ ] Chốt async event.
- [ ] Chốt fault map.

### Business

- [ ] Login.
- [ ] Course browse.
- [ ] Enrollment.
- [ ] Assignment.
- [ ] Submission.
- [ ] Grading.
- [ ] Notification.

### Infrastructure

- [ ] PostgreSQL.
- [ ] Redis.
- [ ] RabbitMQ.
- [ ] Docker Compose.

### Observability

- [ ] OpenTelemetry.
- [ ] Prometheus.
- [ ] Tempo.
- [ ] Loki.
- [ ] Trace context propagation.
- [ ] Trace-log correlation.

### Experiment

- [ ] Load generator.
- [ ] Experiment metadata.
- [ ] CPU fault.
- [ ] Network/dependency delay.
- [ ] Service error.
- [ ] DB latency.
- [ ] Crash.
- [ ] Automated reset.

### Validation

- [ ] Fault tạo đúng symptom.
- [ ] Trace thấy propagation.
- [ ] Metrics thấy anomaly.
- [ ] Logs có evidence.
- [ ] Ground truth lưu được.
- [ ] Có thể lặp experiment.

---

## B55. Kết luận

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

## B56. Câu mô tả ngắn có thể đưa vào tài liệu đề tài

> Nhóm xây dựng một backend microservice theo miền nghiệp vụ LMS ở phạm vi thu gọn, gồm các service đại diện cho xác thực, khóa học, đăng ký học, bài tập, nộp bài, chấm điểm và thông báo. Hệ thống có cả giao tiếp đồng bộ và bất đồng bộ, sử dụng database, cache và message queue, đồng thời được instrument bằng OpenTelemetry. Backend đóng vai trò là môi trường thử nghiệm có kiểm soát để nhóm tạo workload, inject fault tại service hoặc dependency, thu thập metrics/traces/logs và cung cấp ground truth phục vụ đánh giá hệ thống phát hiện bất thường và root cause analysis.

---

## B57. Quy tắc kiểm soát scope cuối cùng

Trong suốt quá trình triển khai, với mỗi thay đổi hãy hỏi:

> **“Thay đổi này làm testbed tốt hơn cho anomaly detection/RCA, hay chỉ làm LMS nhiều chức năng hơn?”**

Nếu chủ yếu là vế thứ hai, nên trì hoãn hoặc loại bỏ.

---

# PHẦN C – OBSERVABILITY, DỮ LIỆU VÀ AI/RCA

Phần C kế thừa khung AI/RCA trước đó nhưng được đặt lại trong bối cảnh **LMS microservice testbed tự xây**. testbed microservice của nhóm chỉ còn là nguồn tham khảo/secondary validation nếu cần, không phải testbed chính.

## C13. Thiết kế observability và telemetry

### 13.1. Chuẩn identity

Tất cả telemetry phải có tối thiểu:

```text
service.name
service.instance.id
service.version
deployment.environment.name
```

Nếu Kubernetes:

```text
k8s.namespace.name
k8s.pod.name
k8s.container.name
```

Không nên dùng pod name làm khái niệm service.

### 13.2. Metrics cần thu

#### RED metrics

Cho mỗi service:

- Rate;
- Errors;
- Duration.

Ví dụ:

```text
request_rate
error_rate
latency_p50
latency_p95
latency_p99
```

#### Resource metrics

```text
cpu_usage
memory_usage
network_rx
network_tx
disk_io
thread_count
gc_pause
```

#### Dependency metrics

```text
client_request_rate
client_error_rate
client_latency
db_latency
db_error
```

#### App-specific metrics

Ví dụ Submission:

```text
submission_success_total
submission_failure_total
submission_processing_duration
```

### 13.3. Trace features

Mỗi edge:

```text
caller -> callee
```

tính theo window:

```text
call_count
error_ratio
duration_mean
duration_p95
duration_p99
timeout_count
```

Mỗi service:

```text
span_count
span_error_ratio
span_duration_p95
critical_path_frequency
```

### 13.4. Log features

Không đưa raw log string trực tiếp vào model ở MVP.

Chuyển thành feature:

```text
error_log_rate
warn_log_rate
unique_template_count
new_template_count
template_X_frequency
exception_count
timeout_keyword_count
```

Lý do:

- ít dimension hơn;
- dễ giải thích;
- inference nhanh;
- giảm phụ thuộc NLP model.

### 13.5. Cardinality

Không dùng:

```text
user_id
trace_id
request_id
```

làm Prometheus label vì cardinality cực cao.

Trace ID chỉ dùng để correlation trong trace/log storage.

---

## C14. Mô hình dữ liệu phân tích

### 14.1. Time window

Chọn window ban đầu:

```text
window_size = 60 seconds
step = 15 seconds
```

Có overlap:

```text
00:00 - 01:00
00:15 - 01:15
00:30 - 01:30
...
```

Sau pilot có thể thử:

- 30 s;
- 60 s;
- 120 s.

### 14.2. ServiceWindowFeature

```text
ServiceWindowFeature
- timestamp_start
- timestamp_end
- service_name
- request_rate
- error_rate
- latency_p95
- cpu
- memory
- log_error_rate
- new_log_template_count
- trace_error_rate
- downstream_latency
- ...
```

### 14.3. EdgeWindowFeature

```text
EdgeWindowFeature
- caller
- callee
- start
- end
- calls
- error_rate
- latency_p95
- timeout_rate
```

### 14.4. Incident

```text
Incident
- id
- detected_at
- estimated_start
- estimated_end
- severity
- affected_services
- status
- algorithm_version
```

### 14.5. RCACandidate

```text
RCACandidate
- incident_id
- entity
- rank
- score
- anomaly_score
- temporal_score
- graph_score
- evidence_score
```

### 14.6. Evidence

```text
Evidence
- type
- entity
- metric_or_template
- baseline_value
- incident_value
- change_ratio
- statistical_score
- trace_ids[]
```

---

## C15. Mô hình sự cố và fault injection

Muốn đánh giá RCA thì phải biết ground truth.

### 15.1. Fault taxonomy

#### F1 – CPU saturation

```text
service CPU -> 90-100%
```

#### F2 – Memory pressure / leak

```text
memory increases over time
GC increases
latency eventually increases
```

#### F3 – Network latency

```text
submission -> database +300 ms
```

#### F4 – Packet loss

```text
checkout -> inventory packet loss 10%
```

#### F5 – Service error injection

```text
submission returns HTTP/gRPC errors
```

#### F6 – Service crash/restart

```text
pod/container killed
```

#### F7 – Database latency

```text
slow query / artificial sleep / connection pressure
```

#### F8 – Database connection exhaustion

```text
connection pool unavailable
```

#### F9 – Cache slowdown/failure

```text
Redis latency
```

#### F10 – Queue backlog

```text
consumer slowdown
```

#### F11 – Application-level artificial bug

Ví dụ:

```text
specific endpoint sleeps 1 second
```

### 15.2. Phạm vi fault cho MVP

Không cần 11 loại.

MVP:

1. CPU saturation.
2. Network delay.
3. Service error.
4. DB latency.
5. Service crash.

Target:

6–8 loại.

### 15.3. Fault intensity

Mỗi fault nên có ít nhất:

```text
low
high
```

Ví dụ network delay:

```text
low  = +100 ms
high = +500 ms
```

Điều này giúp đánh giá sensitivity.

### 15.4. Fault injection tool

Nếu Kubernetes:

- Chaos Mesh.

Nếu Docker Compose:

- custom fault endpoint;
- Linux `tc/netem`;
- CPU stress container;
- service feature flags.

Khuyến nghị:

```text
Docker Compose during early development
Kubernetes + Chaos Mesh for final experiment if stable
```

Không nên bắt đầu bằng Kubernetes nếu nhóm chưa quen.

---

## C16. Chiến lược xây dựng dataset

Đây là một trong những phần quan trọng nhất.

### 16.1. Dataset A – Healthy baseline

Chạy workload bình thường:

```text
30–60 min/run
```

với nhiều traffic profile:

```text
constant
diurnal-like
burst
```

Mục đích:

- học distribution bình thường;
- đánh giá false positive;
- fit unsupervised detector.

### 16.2. Dataset B – Fault-injected dataset của nhóm

Mỗi experiment:

```text
5 min warm-up
10 min healthy
5 min fault
10 min recovery
```

Ví dụ ground truth:

```json
{
  "run_id": "exp_023",
  "fault_type": "network_delay",
  "target": "submission",
  "dependency": "submission->postgres",
  "started_at": "10:15:00",
  "ended_at": "10:20:00",
  "intensity": "500ms"
}
```

### 16.3. Số lượng run tối thiểu

Ví dụ:

```text
5 fault types
x 3 target services
x 2 intensity
x 2 repetitions
= 60 fault runs
```

Thêm:

```text
10–20 healthy runs
```

Khoảng 70–80 experiment là đủ cho một đồ án nếu automation tốt.

Không cần hàng nghìn run.

### 16.4. Dataset C – RCAEval

Dùng để:

- chạy baseline bên ngoài testbed;
- kiểm tra algorithm không overfit môi trường của nhóm;
- tham khảo cách đánh giá.

Không cần cam kết chạy toàn bộ 735 cases ngay từ đầu.

Có thể chọn subset phù hợp modality.

### 16.5. Dataset D – AnoMod

Stretch goal.

AnoMod 2026 cung cấp nhiều modality và fault category phong phú.

Có thể dùng để kiểm tra:

- multi-source fusion;
- missing modality;
- fine-grained analysis.

### 16.6. Data split

Vì bài toán chủ yếu unsupervised:

#### Normal training

```text
healthy periods
```

#### Validation

```text
subset healthy + subset fault
```

chỉ dùng để:

- chọn threshold;
- chọn hyperparameter.

#### Test

```text
fault scenarios chưa dùng khi tune
```

Tuyệt đối không tune threshold trực tiếp trên toàn bộ test set.

---

## C17. Pipeline AI/ML đề xuất

### 17.1. Pipeline tổng thể

```text
                     +------------------+
metrics ------------>|                  |
                     | Feature Builder  |
traces -------------->|                  |
                     |                  |
logs ---------------->|                  |
                     +---------+--------+
                               |
                               v
                    +---------------------+
                    | Normalization       |
                    | Missing-data logic  |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    | Anomaly Detection   |
                    +----------+----------+
                               |
                        anomaly profile
                               |
                               v
                    +---------------------+
                    | Incident Detection  |
                    +----------+----------+
                               |
                   +-----------+-----------+
                   |                       |
                   v                       v
        +------------------+    +----------------------+
        | Dependency Graph |    | Evidence Extraction  |
        +---------+--------+    +----------+-----------+
                  |                        |
                  +------------+-----------+
                               |
                               v
                     +------------------+
                     | RCA Ranker       |
                     +--------+---------+
                              |
                              v
                   candidates + evidence
```

### 17.2. Vì sao ưu tiên unsupervised?

Production incident labels hiếm và đắt.

Supervised model cần:

```text
X -> root_cause_label
```

Nhưng trong hệ thống thật:

- service thay đổi;
- version thay đổi;
- topology thay đổi;
- fault mới xuất hiện.

Unsupervised phù hợp hơn với mục tiêu:

```text
learn normal
detect deviation
rank suspicious entities
```

### 17.3. Không đồng nhất “AI” với deep learning

Đồ án có thể sử dụng:

- Isolation Forest;
- robust statistics;
- change-point detection;
- clustering;
- graph ranking;
- causal/statistical hypothesis testing.

Đây vẫn là một AI/ML pipeline thực chất.

Deep model chỉ nên thêm nếu baseline cho thấy cần thiết.

---

## C18. Phát hiện bất thường

### 18.1. Baseline A – Static threshold

Ví dụ:

```text
error_rate > 5%
p95 > 500ms
CPU > 90%
```

Mục đích:

- benchmark;
- không phải model chính.

### 18.2. Baseline B – Z-score

```text
z = (x - μ) / σ
```

Anomaly:

```text
|z| > 3
```

Nhược điểm:

- nhạy outlier;
- giả định distribution đơn giản.

### 18.3. Baseline C – Robust z-score

Dùng median/MAD:

```text
robust_z =
0.6745 * (x - median) / MAD
```

Đây là baseline rất đáng có.

### 18.4. Model D – Isolation Forest

Input một vector service-level:

```text
[
  request_rate,
  error_rate,
  latency_p95,
  cpu,
  memory,
  trace_error_rate,
  downstream_latency,
  log_error_rate
]
```

Output:

```text
anomaly_score
```

Ưu điểm:

- unsupervised;
- dễ triển khai;
- inference nhanh;
- phù hợp tabular features;
- dễ benchmark.

### 18.5. Model E – Change-point detection

State-of-the-art-inspired option:

- Bayesian Online Change Point Detection;
- hoặc một online change detector đơn giản hơn.

Mục tiêu:

```text
estimate incident start
```

thay vì chỉ:

```text
this point is anomalous
```

### 18.6. Không nên bắt đầu với LSTM/Transformer

Chỉ thêm nếu sau baseline có lý do cụ thể.

Nếu thêm:

- autoencoder;
- TCN;
- LSTM autoencoder.

Nhưng phải chứng minh:

```text
accuracy gain > complexity + training cost
```

### 18.7. Service anomaly score

Một cách fusion đơn giản:

```text
A_service =
w_m * A_metrics
+
w_t * A_traces
+
w_l * A_logs
```

Trong đó:

```text
w_m + w_t + w_l = 1
```

Không nhất thiết học weight bằng neural network.

Có thể tune bằng validation hoặc đặt equal weight rồi làm sensitivity study.

---

## C19. Xây dựng service dependency graph

### 19.1. Graph definition

```text
G_t = (V, E)
```

Trong đó:

```text
V = services
E = caller -> callee
```

Edge lấy từ spans.

Ví dụ:

```text
frontend -> checkout
checkout -> submission
checkout -> inventory
submission -> postgres
inventory -> redis
```

### 19.2. Dynamic graph

Không giữ graph static toàn kỳ.

Mỗi time window có:

```text
G(W)
```

vì:

- feature flag thay đổi route;
- service version thay đổi;
- dependency có thể temporary.

### 19.3. Edge weight

Có thể:

```text
weight(u,v) =
normalized_call_count
```

hoặc kết hợp:

```text
weight(u,v) =
alpha * call_volume
+
beta * edge_latency_change
+
gamma * edge_error_change
```

### 19.4. Service graph từ Tempo

Grafana Tempo có khả năng sinh service graph / span metrics từ trace. Có thể sử dụng cho visualization hoặc làm nguồn đối chiếu.

Tuy nhiên để nghiên cứu, nhóm nên tự xây một graph representation trong analysis backend để chủ động thuật toán.

---

## C20. Xếp hạng nguyên nhân gốc

Đây là phần cốt lõi nhất của đồ án.

### 20.1. Vấn đề của “highest anomaly wins”

Giả sử:

```text
DB        score 0.72 starts 10:00:10
Submission   score 0.88 starts 10:00:20
Checkout  score 0.94 starts 10:00:35
```

Nếu chỉ rank score:

```text
Checkout > Submission > DB
```

nhưng root cause thực tế là DB.

Do đó cần topology + time.

### 20.2. Các thành phần score đề xuất

#### Anomaly severity

```text
A(s)
```

#### Temporal precedence

Service bắt đầu anomalous sớm hơn được score cao hơn:

```text
T(s)
```

#### Propagation compatibility

Nếu:

```text
s -> downstream service
```

và downstream anomalous sau `s`, tăng score.

```text
P(s)
```

#### Edge degradation

Outgoing dependency từ `s` có latency/error tăng:

```text
E(s)
```

#### Evidence strength

Metric/log thay đổi có statistical significance:

```text
V(s)
```

### 20.3. Proposed RCA score

Phiên bản đầu:

```text
R(s) =
w1*A(s)
+ w2*T(s)
+ w3*P(s)
+ w4*E(s)
+ w5*V(s)
```

Ví dụ weight khởi tạo:

```text
w1 = 0.30
w2 = 0.20
w3 = 0.20
w4 = 0.20
w5 = 0.10
```

Không được coi đây là weight cuối cùng.

Phải:

- tune trên validation;
- hoặc sensitivity analysis.

### 20.4. Propagation score

Ví dụ:

```text
P(s) =
sum over downstream d:
    graph_weight(s,d)
    * anomaly(d)
    * temporal_consistency(s,d)
```

Trong đó:

```text
temporal_consistency = 1
if start(s) <= start(d)
else penalty
```

### 20.5. Reverse symptom tracing

Khi incident bắt đầu ở một SLO endpoint:

```text
frontend checkout error
```

có thể traverse ngược dependency path để tìm upstream cause theo execution tree.

### 20.6. Graph algorithm baseline

So sánh ít nhất:

#### Rank by anomaly

```text
R = anomaly_score
```

#### PageRank-like graph ranking

Graph + anomaly seed.

#### Proposed graph-temporal rank

Graph + anomaly + temporal.

### 20.7. Root cause hay root-cause candidate?

Trong báo cáo nên dùng từ:

> **root-cause candidate localization/ranking**

vì telemetry observational không đủ để chứng minh quan hệ nhân quả tuyệt đối trong mọi trường hợp.

Chỉ khi fault injection có ground truth mới nói:

> Ground truth root cause = X.

Đây là cách diễn đạt học thuật an toàn hơn.

---

## C21. Phân tích log và bằng chứng chi tiết

### 21.1. MVP

Không cần log transformer.

Pipeline:

```text
raw log
  |
  v
normalize dynamic fields
  |
  v
template
  |
  v
window frequency
```

Ví dụ:

```text
"submission timeout after 5012 ms"
"submission timeout after 5028 ms"
```

->

```text
"submission timeout after <*> ms"
```

### 21.2. Log template features

```text
template_frequency
template_first_seen
template_delta
error_template_count
new_error_template_count
```

### 21.3. Burst detection

Healthy:

```text
template timeout = 0/min
```

Incident:

```text
template timeout = 50/min
```

đây là bằng chứng rất tốt.

### 21.4. Trace-correlated logs

Khi log có `trace_id`:

```text
incident
 -> suspicious trace
    -> span
       -> log
```

Hệ thống có thể hiển thị:

```text
trace abc
submission span 2.1s
ERROR database timeout
```

Đây là một trong những demo mạnh nhất.

### 21.5. Stretch

- Drain-style log parsing;
- log embedding;
- template clustering;
- semantic similarity.

Không cần để hoàn thành core.

---

## C22. Thiết kế Incident và Timeline

### 22.1. Incident lifecycle

```text
NORMAL
  |
  v
SUSPECTED
  |
  v
OPEN
  |
  v
RECOVERING
  |
  v
RESOLVED
```

### 22.2. Incident trigger

Không tạo incident chỉ từ một điểm bất thường.

Ví dụ:

```text
anomaly_score > threshold
for >= 3 consecutive steps
```

hoặc:

```text
2+ service signals anomalous
```

### 22.3. Timeline event

```text
10:00:10 submission-db latency anomaly
10:00:18 submission outgoing dependency anomaly
10:00:23 submission timeout logs burst
10:00:30 checkout p95 latency anomaly
10:00:35 frontend SLO violation
```

### 22.4. Incident correlation

Nếu nhiều alert xảy ra gần nhau và cùng connected component trong graph:

```text
merge into one incident
```

Tránh:

```text
1 actual fault -> 12 separate alerts
```

---

## C23. Các baseline cần so sánh

Một đồ án có thuật toán đề xuất nhưng không baseline sẽ rất yếu.

### 23.1. Anomaly Detection baselines

Minimum:

1. Static threshold.
2. Robust Z-score.
3. Isolation Forest.

Target:

4. Change-point detector.

Stretch:

5. Autoencoder.

### 23.2. RCA baselines

Minimum:

#### B1 – Max anomaly

```text
rank = anomaly score
```

#### B2 – Earliest anomaly

```text
rank = anomaly start time
```

#### B3 – Graph-aware simple baseline

```text
anomaly + graph centrality/propagation
```

#### B4 – Proposed method

```text
anomaly + graph + temporal + evidence
```

### 23.3. External baseline

Nếu time cho phép:

- BARO artifact;
- một RCAEval baseline;
- PyRCA-based method.

Không cần reproduce Eadro full deep network nếu quá nặng.

---

## C24. Thiết kế thực nghiệm và chỉ số đánh giá

## C24.1. Anomaly detection metrics

### Precision

```text
TP / (TP + FP)
```

### Recall

```text
TP / (TP + FN)
```

### F1

```text
2PR / (P + R)
```

### False Positive Rate

Quan trọng vì alert fatigue.

### Detection Delay

```text
detected_at - actual_fault_start
```

Một hệ thống F1 cao nhưng phát hiện sau 10 phút có thể không hữu ích.

### Incident-level evaluation

Không chỉ point-level.

Ví dụ fault 5 phút được tính là detected nếu detector trigger trong fault interval.

---

## C24.2. RCA metrics

### Top-1 Accuracy

Root cause ground truth đứng rank 1.

### Top-3 Accuracy

Ground truth nằm top 3.

### Mean Reciprocal Rank

```text
MRR = mean(1 / rank_ground_truth)
```

Ví dụ:

```text
rank 1 -> 1
rank 2 -> 0.5
rank 3 -> 0.333
```

### Average Rank

Đơn giản và dễ giải thích.

---

## C24.3. System metrics

### RCA runtime

```text
ms / incident
```

### Feature extraction time

### Query latency

### CPU / memory

### Telemetry ingestion overhead

### Application overhead

So sánh:

```text
instrumentation off
vs
instrumentation on
```

về:

- throughput;
- p95 latency.

---

## C24.4. Experiment matrix

Ví dụ minimum:

| Fault | Service | Low | High | Repeats |
|---|---|---:|---:|---:|
| CPU | submission | ✓ | ✓ | 2 |
| CPU | inventory | ✓ | ✓ | 2 |
| Network delay | submission-db | ✓ | ✓ | 2 |
| Network delay | checkout-submission | ✓ | ✓ | 2 |
| Service error | submission | ✓ | ✓ | 2 |
| DB latency | submission-db | ✓ | ✓ | 2 |
| Crash | submission | - | ✓ | 3 |

Cần mở rộng đủ service để tránh model học thuộc service name.

---

## C25. Ablation study và robustness test

Ablation là điểm cộng lớn trong CLO3 vì chứng minh thành phần nào thực sự có ích.

### 25.1. Modality ablation

```text
M
M + T
M + L
M + T + L
```

Trong đó:

```text
M = metrics
T = traces
L = logs
```

### 25.2. Graph ablation

```text
without graph
vs
with graph
```

### 25.3. Temporal ablation

```text
without temporal precedence
vs
with temporal precedence
```

### 25.4. Evidence ablation

```text
without fine-grained evidence score
vs
with evidence score
```

### 25.5. Missing trace

Randomly drop:

```text
20%
50%
80%
```

spans/traces.

Mục tiêu:

- xem graph-aware RCA degrade thế nào;
- xác định giới hạn của phương pháp.

### 25.6. Workload shift

Train healthy baseline ở:

```text
100 req/s
```

test:

```text
150 req/s
```

Kiểm tra detector có nhầm traffic increase thành fault hay không.

---

## C26. Thiết kế Backend/API

### 26.1. Internal modules

```text
telemetry-adapter
feature-engine
detector
incident-engine
graph-builder
rca-engine
evidence-engine
experiment-runner
evaluation-engine
api-server
```

Không nhất thiết tách thành microservice vật lý.

Khuyến nghị analysis platform ban đầu là **modular monolith**.

Lý do:

- dễ debug;
- ít network overhead;
- 2 người;
- tránh “microservice hóa hệ thống phân tích microservice” một cách không cần thiết.

### 26.2. Suggested API

#### Health

```http
GET /api/v1/system/health
```

#### Services

```http
GET /api/v1/services
GET /api/v1/services/{name}
```

#### Anomaly scores

```http
GET /api/v1/services/{name}/anomalies
```

#### Incidents

```http
GET /api/v1/incidents
GET /api/v1/incidents/{id}
```

#### RCA

```http
POST /api/v1/incidents/{id}/analyze
GET  /api/v1/incidents/{id}/candidates
```

#### Evidence

```http
GET /api/v1/incidents/{id}/evidence
```

#### Trace

```http
GET /api/v1/incidents/{id}/traces
```

#### Experiments

```http
POST /api/v1/experiments
GET  /api/v1/experiments/{id}
```

#### Evaluation

```http
POST /api/v1/evaluations
GET  /api/v1/evaluations/{id}
```

### 26.3. Example incident response

```json
{
  "id": "INC-2026-0013",
  "state": "resolved",
  "start": "2026-10-20T10:00:14Z",
  "detected_at": "2026-10-20T10:00:45Z",
  "affected_services": [
    "frontend",
    "checkout",
    "submission"
  ],
  "candidates": [
    {
      "entity": "submission",
      "score": 0.91,
      "rank": 1
    }
  ]
}
```

---

## C27. Thiết kế giao diện

UI chỉ cần đủ cho demo và investigation.

### 27.1. System Overview

Hiển thị:

- service count;
- current anomalies;
- open incidents;
- request/error/latency summary.

### 27.2. Service Graph

Node:

- service.

Visual state:

- normal;
- anomalous;
- candidate.

Edge:

- calls;
- latency/error.

### 27.3. Incident List

```text
ID
start
status
severity
top candidate
confidence
```

### 27.4. Incident Detail

Bố cục đề xuất:

```text
+--------------------------------------------------+
| Incident Summary                                 |
+--------------------------------------------------+
| Timeline                                         |
+--------------------------------------------------+
| Service Graph                                    |
+--------------------------------------------------+
| Root Cause Candidates                            |
+--------------------------------------------------+
| Evidence                                         |
| - metrics                                        |
| - logs                                           |
| - traces                                         |
+--------------------------------------------------+
```

### 27.5. Experiment Page

Chỉ cần nếu còn thời gian.

Có thể dùng CLI cho experiment runner và web chỉ xem kết quả.

---

## C28. Technology stack

Đây là stack đề xuất, không phải bắt buộc.

### 28.1. Application testbed

- testbed microservice của nhóm;
- hoặc services viết Go/Java/Node.js.

### 28.2. Telemetry

- OpenTelemetry SDK;
- OpenTelemetry Collector;
- OTLP.

### 28.3. Metrics

- Prometheus.

### 28.4. Traces

- Grafana Tempo.

Alternative:

- Jaeger.

Tempo thuận lợi nếu dùng Grafana stack.

### 28.5. Logs

- Grafana Loki.

### 28.6. Visualization nền

- Grafana dùng để kiểm tra raw telemetry.

### 28.7. Analysis backend

**Python** rất phù hợp vì:

- scikit-learn;
- scipy;
- numpy;
- pandas/polars;
- networkx;
- causal libraries nếu mở rộng.

Framework:

- FastAPI.

### 28.8. Metadata DB

- PostgreSQL.

### 28.9. Background processing

MVP:

- asyncio/background worker.

Nếu cần:

- Redis queue / Celery.

Không thêm Kafka chỉ vì muốn kiến trúc “xịn”.

### 28.10. Frontend

- React / Next.js;
- hoặc Vue.

Frontend không phải trọng tâm nên giữ đơn giản.

### 28.11. Deployment

- Docker;
- Docker Compose.

Target:

- Kubernetes local (kind/k3d/minikube).

### 28.12. Fault injection

- Chaos Mesh cho Kubernetes.

### 28.13. Load generation

- k6.

Một microservice testbed đã có load generator.

---

## C29. Chiến lược triển khai

### Giai đoạn 1 – Local Compose

```text
docker compose up
```

Mục tiêu:

- nhanh;
- reproduce dễ;
- debug dễ.

### Giai đoạn 2 – Local Kubernetes

Chỉ chuyển khi:

- pipeline Compose ổn định;
- algorithm chạy được;
- experiment runner đã có.

### Giai đoạn 3 – Optional cloud VM

Không bắt buộc.

Có thể dùng 1–3 VM nếu cần benchmark.

### Quy tắc

> **Đừng biến Kubernetes thành đề tài chính.**

Kubernetes là hạ tầng thử nghiệm, không phải đóng góp nghiên cứu.

---

## C30. Cấu trúc repository

Khuyến nghị monorepo:

```text
graduation-project/
|
+-- README.md
+-- docs/
|   +-- architecture/
|   +-- research/
|   +-- experiments/
|   +-- adr/
|
+-- infrastructure/
|   +-- docker-compose/
|   +-- otel-collector/
|   +-- prometheus/
|   +-- tempo/
|   +-- loki/
|   +-- grafana/
|   +-- kubernetes/
|
+-- testbed/
|   +-- patches/
|   +-- fault-hooks/
|
+-- analysis/
|   +-- telemetry/
|   +-- features/
|   +-- anomaly/
|   +-- graph/
|   +-- rca/
|   +-- evidence/
|   +-- evaluation/
|
+-- backend/
|   +-- app/
|   +-- tests/
|
+-- frontend/
|
+-- experiments/
|   +-- scenarios/
|   +-- runner/
|   +-- results/
|
+-- notebooks/
|
+-- models/
|
+-- scripts/
|
+-- tests/
```

### 30.1. Không để notebook trở thành production code

Notebook dùng:

- exploration;
- visualization;
- offline experiment.

Algorithm chính phải nằm trong package Python có test.

---

## C31. Kiểm thử phần mềm

### 31.1. Unit tests

Cho:

- feature transformation;
- time window;
- graph builder;
- scoring;
- metric calculation.

### 31.2. Integration tests

Ví dụ:

```text
mock Prometheus
-> feature builder
-> detector
-> incident
```

### 31.3. Contract tests

Đối với telemetry adapter/API.

### 31.4. End-to-end test

```text
inject fault
-> telemetry
-> detector
-> incident
-> RCA
-> API
```

Đây là test quan trọng nhất.

### 31.5. Experiment regression tests

Khi thay thuật toán:

```text
old model
vs
new model
```

không chỉ nhìn một demo.

---


---

# PHẦN D – KẾ HOẠCH THỰC HIỆN, ĐÁNH GIÁ VÀ QUẢN TRỊ PHẠM VI

# D1. Kế hoạch 24 tuần

Khuyến nghị chia 12 sprint, mỗi sprint 2 tuần.

## Sprint 1 – Tuần 1–2: Scope, literature và architecture

### Công việc chung

- chốt tên đề tài;
- chốt research questions;
- literature review;
- chốt service-level RCA;
- chốt backend topology;
- chốt 5 fault type MVP;
- chốt technology stack;
- ADR ban đầu.

### Deliverables

```text
scope v1
architecture v1
service dependency graph
fault map
literature matrix
```

### Gate

Không bắt đầu viết nhiều CRUD nếu chưa chốt được:

> “Service này tồn tại để tạo dependency/fault nào?”

---

## Sprint 2 – Tuần 3–4: Backend foundation

### Backend-primary

- Docker Compose skeleton;
- Gateway;
- Auth;
- Course;
- PostgreSQL;
- Redis;
- seed data.

### AI-primary

- thiết kế telemetry schema;
- nghiên cứu Prometheus/Tempo/Loki query;
- chuẩn hóa service identity;
- xây notebook/prototype cho windowing.

### Deliverable

```text
login + course flow chạy end-to-end
```

---

## Sprint 3 – Tuần 5–6: Core microservice topology + observability

### Backend

- Enrollment;
- Assignment;
- Submission;
- service-to-service calls.

### Observability

- OpenTelemetry SDK;
- Collector;
- traces;
- metrics;
- structured logs;
- trace/log correlation.

### Gate

Một `submit assignment` phải xem được trace xuyên nhiều service.

---

## Sprint 4 – Tuần 7–8: Async workflow + experiment infrastructure

### Backend

- Grading;
- RabbitMQ;
- Notification;
- optional storage mock/MinIO.

### Experiment

- k6 workload;
- experiment metadata DB/file;
- fault hooks;
- automated start/stop/reset.

### Deliverable

Ít nhất:

```text
10 healthy runs
10 fault runs
```

---

## Sprint 5 – Tuần 9–10: Dataset v1 + anomaly baselines

### Data

- time alignment;
- service windows;
- edge windows;
- normalization;
- missing values.

### AI

- static threshold;
- robust z-score;
- Isolation Forest.

### Evaluation

- Precision;
- Recall;
- F1;
- detection delay.

### Gate

Phải chứng minh được:

```text
healthy traffic spike != fault
```

ở mức chấp nhận được.

---

## Sprint 6 – Tuần 11–12: Dependency graph + RCA baselines

- parse traces;
- build dynamic service graph;
- rank by anomaly;
- rank by earliest anomaly;
- simple graph-aware baseline;
- Top-1/Top-3/MRR.

### Mốc giữa kỳ kỹ thuật

Tại đây nhóm đã có một pipeline hoàn chỉnh:

```text
backend
-> telemetry
-> fault
-> anomaly
-> RCA baseline
-> evaluation
```

---

## Sprint 7 – Tuần 13–14: Multi-source fusion

- trace-derived features;
- log template aggregation;
- service anomaly profile;
- compare M / M+T / M+T+L.

### Deliverable

Ablation modality v1.

---

## Sprint 8 – Tuần 15–16: Proposed RCA method

- temporal precedence;
- propagation score;
- edge degradation;
- evidence score;
- root-cause candidate ranking;
- parameter sensitivity.

### Deliverable

Proposed method v1.

---

## Sprint 9 – Tuần 17–18: Productization

- incident lifecycle;
- persistent incident metadata;
- candidate/evidence API;
- timeline;
- service graph API;
- dashboard.

Không thêm business LMS feature mới.

---

## Sprint 10 – Tuần 19–20: Full experimental campaign

- hoàn thiện fault matrix;
- 2–3 repeat/scenario;
- multiple targets;
- multiple intensities;
- healthy high-load runs;
- missing trace;
- missing modality;
- runtime/resource benchmark.

Target tổng:

```text
60–100 controlled runs
```

tùy thời gian và automation.

---

## Sprint 11 – Tuần 21–22: External validation + hardening

Ưu tiên:

- RCAEval subset;
- hoặc AnoMod subset phù hợp.

Nếu external benchmark quá tốn thời gian:

- ưu tiên hoàn thiện ablation và robustness trên testbed của nhóm.

Đồng thời:

- unit/integration/E2E test;
- reproducibility script;
- fix dashboard;
- freeze feature.

---

## Sprint 12 – Tuần 23–24: Báo cáo và bảo vệ

- freeze code;
- final plots/tables;
- limitations;
- threats to validity;
- report;
- slide;
- demo script;
- backup recorded demo;
- Q&A.

Giữ ít nhất 1 tuần buffer, không lên kế hoạch feature lớn ở tuần 24.

---

# D2. Phân chia công việc 2 thành viên

## Thành viên 1 – Backend / Platform primary

Primary:

- microservice testbed;
- DB/cache/queue;
- service-to-service communication;
- OpenTelemetry instrumentation;
- Docker/Kubernetes;
- load generation;
- fault injection;
- experiment orchestration.

Secondary:

- telemetry adapter;
- incident backend;
- graph validation.

## Thành viên 2 – AI / Diagnosis primary

Primary:

- feature engineering;
- anomaly detection;
- multi-source fusion;
- dependency analysis;
- RCA ranking;
- evidence;
- evaluation;
- experimental analysis.

Secondary:

- telemetry schema;
- fault design;
- backend integration;
- dashboard API.

## Shared

- architecture;
- RQ;
- experiment protocol;
- testing;
- report;
- defense.

Không chia theo kiểu:

```text
người A chỉ biết LMS
người B chỉ biết AI
```

Mỗi module quan trọng cần code review chéo.

---

# D3. MVP / Target / Stretch

## MVP bắt buộc

### Backend

- 5–8 service;
- PostgreSQL;
- Redis;
- RabbitMQ;
- Compose;
- automated workload.

### Observability

- metrics;
- traces;
- logs cơ bản;
- correlation.

### Fault

- CPU;
- dependency/network delay;
- service error;
- DB latency;
- crash.

### AI

- robust statistical baseline;
- Isolation Forest hoặc detector unsupervised tương đương;
- incident detection;
- dynamic service graph;
- graph + temporal RCA ranking.

### Evaluation

- ≥ 50 fault runs nếu khả thi;
- Precision/Recall/F1;
- Detection Delay;
- Top-1/Top-3;
- MRR;
- runtime;
- ít nhất một ablation.

### Product

- REST API;
- incident list/detail;
- root-cause candidate;
- evidence;
- service graph.

---

## Target

- 7–8 service ổn định;
- cache/queue/storage fault;
- 70–100 experiment;
- multi-source fusion;
- log template features;
- missing trace test;
- modality ablation;
- external benchmark subset;
- Kubernetes/Chaos Mesh nếu không ảnh hưởng tiến độ.

---

## Stretch

- change-point model nâng cao;
- causal discovery top-N;
- instance-level RCA;
- multi-fault;
- performance regression;
- circuit breaker/retry storm;
- LLM chỉ để summarize evidence;
- code-level evidence;
- automated remediation simulation.

---

# D4. Thiết kế thực nghiệm tổng thể

## Unit of evaluation

Khuyến nghị đánh giá ở **incident/fault-run level**, không chỉ point anomaly.

Mỗi run có:

```text
warm-up
healthy baseline
fault active
recovery
```

Ví dụ:

```text
5 phút warm-up
10 phút healthy
5 phút fault
10 phút recovery
```

Thời lượng có thể giảm sau pilot.

## Ground truth

Mỗi run phải biết:

- fault type;
- root-cause service/dependency;
- fault start/end;
- intensity;
- workload profile.

## Repetition

Ít nhất 2 lần/scenario nếu tài nguyên cho phép.

## Data leakage

Healthy data dùng fit unsupervised model.  
Validation fault subset chỉ dùng tune threshold/weight.  
Test fault runs không dùng để chọn hyperparameter.

---

# D5. Evaluation matrix khuyến nghị

| Nhóm | Chỉ số |
|---|---|
| Anomaly Detection | Precision, Recall, F1, FPR |
| Timeliness | Detection Delay |
| RCA | Top-1, Top-3, MRR, Average Rank |
| Robustness | kết quả khi drop trace/log |
| Efficiency | feature time, RCA runtime, CPU, memory |
| System | application p95/throughput overhead |
| Explainability | candidate có evidence machine-readable |

Không cần một “accuracy tổng hợp” duy nhất.

---

# D6. Ablation bắt buộc

Ít nhất ba phép so sánh:

## A1 – Modality

```text
metrics
vs
metrics + traces
vs
metrics + traces + logs
```

## A2 – Graph

```text
RCA without graph
vs
RCA with dependency graph
```

## A3 – Temporal

```text
without temporal precedence
vs
with temporal precedence
```

Nếu đủ thời gian:

- evidence score;
- different window size;
- different fusion weight;
- trace sampling.

---

# D7. Rủi ro chính

## R1 – Backend chiếm hết thời gian

Mitigation:

- freeze LMS feature ở tuần 8–10;
- UI LMS là optional;
- Compose-first;
- chỉ thêm component có giá trị experiment.

## R2 – Telemetry không đủ sạch

Mitigation:

- instrumentation từ đầu;
- standardized service identity;
- UTC timestamp;
- trace context test;
- telemetry contract.

## R3 – Fault không reproducible

Mitigation:

- automated fault hook;
- clear reset;
- ground truth record;
- pilot trước khi chạy dataset lớn.

## R4 – AI bị đánh giá là quá đơn giản

Mitigation:

- multiple baselines;
- feature engineering;
- unsupervised model;
- model selection rationale;
- ablation;
- robust evaluation;
- graph/temporal RCA.

Độ phức tạp neural network không phải tiêu chí duy nhất của AI.

## R5 – RCA chỉ tìm symptom

Mitigation:

- temporal precedence;
- dependency propagation;
- edge features;
- pre/post comparison.

## R6 – Causal method quá nặng

Mitigation:

- không đặt causal discovery full-scale làm MVP;
- chỉ thử top-N nếu còn thời gian.

## R7 – Kubernetes làm chậm tiến độ

Mitigation:

- Docker Compose là môi trường chính cho đến khi core hoàn thành.

## R8 – Trace sampling/missing spans

Mitigation:

- evaluate robustness;
- recent graph cache;
- fallback metrics/log evidence;
- document limitation.

## R9 – Proposed method không thắng mọi baseline

Không coi là thất bại. Báo cáo:

- fault nào tốt/xấu;
- runtime;
- complexity;
- trade-off;
- why.

---

# D8. Definition of Done toàn đề tài

Một bản MVP thực sự hoàn thành khi có thể chạy:

```text
1. deploy testbed
2. seed synthetic data
3. start automated workload
4. collect metrics/traces/logs
5. inject known fault
6. detect incident
7. rank root-cause candidates
8. show evidence
9. compare prediction with ground truth
10. reset environment
11. repeat automatically
```

Nếu thiếu bước 5, 8 hoặc 9 thì chưa đủ mạnh về mặt nghiên cứu.

---

# PHẦN E – SẢN PHẨM, BÁO CÁO VÀ BẢO VỆ

# E1. Sản phẩm đầu ra

## 1. LMS Microservice Testbed

- source code;
- Docker images;
- deployment config;
- seed;
- workload scripts;
- fault hooks.

## 2. Observability Stack

- OpenTelemetry Collector config;
- metrics backend;
- trace backend;
- log backend.

## 3. Incident Diagnosis Platform

- telemetry adapters;
- feature engine;
- anomaly detector;
- incident engine;
- graph builder;
- RCA ranker;
- evidence extractor.

## 4. API / Dashboard

- service health;
- incidents;
- candidate ranking;
- timeline;
- related metric/trace/log.

## 5. Experiment Toolkit

- scenarios;
- ground truth;
- runner;
- evaluator;
- plots/tables.

## 6. Dataset do nhóm tạo

- telemetry window/export nếu có thể;
- experiment metadata;
- labels/ground truth;
- README tái lập.

---

# E2. Kịch bản demo khi bảo vệ

Khuyến nghị chọn workflow Submission vì có call chain rõ.

## Bình thường

```text
Student
 -> Gateway
 -> Submission
      -> Assignment
           -> Course
      -> Enrollment
      -> Storage
```

Dashboard chưa có incident.

## Inject fault

Ví dụ:

```text
Storage + 500 ms latency
```

hoặc:

```text
Submission DB latency
```

## Hệ thống quan sát

Metric:

```text
storage/client latency tăng
submission p95 tăng
gateway p95 tăng
```

Trace:

```text
Submission -> Storage span anomalous
```

Logs:

```text
dependency slow/timeout
```

## AI output

```text
Incident detected

Top candidates:
1. Submission -> Storage dependency
2. Submission Service
3. Gateway

Evidence:
- dependency latency +X%
- anomaly bắt đầu trước upstream
- related abnormal traces
```

## Evaluation

Hiển thị:

```text
Ground truth
Predicted rank
Detection delay
```

Sau đó remove fault và incident chuyển recovery/resolved.

---

# E3. Cấu trúc báo cáo cuối

## Chương 1 – Giới thiệu

- vấn đề;
- mục tiêu;
- đóng góp;
- phạm vi.

## Chương 2 – Cơ sở lý thuyết

- microservice;
- observability;
- OpenTelemetry;
- anomaly detection;
- RCA;
- graph;
- metrics.

## Chương 3 – Related Work

- metric-based;
- trace-based;
- log-based;
- multi-source;
- causal/graph;
- benchmark.

## Chương 4 – Phân tích và thiết kế testbed

- LMS domain;
- service boundaries;
- workflow;
- DB/cache/queue;
- fault model;
- workload.

Không cần mô tả CRUD quá dài.

## Chương 5 – Observability & Data Pipeline

- instrumentation;
- telemetry;
- correlation;
- windowing;
- feature schema.

## Chương 6 – Phương pháp AI/RCA

- baseline;
- model;
- anomaly profile;
- graph;
- temporal/propagation;
- ranking;
- complexity.

## Chương 7 – Triển khai nền tảng

- backend;
- analysis API;
- dashboard;
- experiment framework.

## Chương 8 – Thực nghiệm

- environment;
- fault matrix;
- metrics;
- results;
- ablation;
- robustness;
- runtime.

## Chương 9 – Thảo luận

- kết quả;
- trade-off;
- failure cases;
- threats to validity;
- limitation.

## Chương 10 – Kết luận

---

# E4. Các câu hỏi hội đồng có thể hỏi

## “Tại sao LMS?”

Vì LMS là testbed có domain dễ hiểu và có thể tạo sync/async dependency, DB/cache/queue; LMS không phải đóng góp nghiên cứu chính.

## “Tại sao phải tự xây backend?”

Để kiểm soát source code, instrumentation, workload, fault và ground truth.

## “AI nằm ở đâu?”

Feature engineering + anomaly detector + multi-source fusion + root-cause ranking/evidence; không phải LLM API.

## “Tại sao không chỉ dùng threshold?”

Có baseline threshold để so sánh, nhưng hệ thống học/ước lượng normal behavior đa biến và phân tích graph/temporal context.

## “Tại sao không dùng deep learning?”

Phải chứng minh trade-off. Nếu classical unsupervised method đủ tốt, nhẹ và explainable hơn thì đó là lựa chọn kỹ thuật hợp lý.

## “Làm sao biết RCA đúng?”

Controlled fault injection + ground truth + Top-K/MRR.

## “Đây có phải causal inference không?”

Không gọi graph/temporal ranking là causal proof. Nếu không chạy causal discovery/SCM đúng nghĩa thì dùng thuật ngữ dependency/propagation-aware RCA.

## “Khác Grafana/Prometheus ở đâu?”

Prometheus/Grafana cung cấp telemetry query/visualization. Đề tài tự xây anomaly detection, incident correlation, RCA candidate ranking, evidence và experimental evaluation.

---

# E5. Mapping với chuẩn đầu ra đồ án

## CLO1 – Phân tích

Thể hiện qua:

- bài toán phân tán;
- failure propagation;
- graph;
- time series;
- constraints;
- trade-off.

## CLO2 – Thiết kế/triển khai

- microservice architecture;
- database/cache/queue;
- observability;
- deployment;
- API;
- testing;
- reproducibility;
- privacy.

## CLO3 – AI

Phải thể hiện rõ:

1. chọn detector có lý do;
2. preprocessing/feature engineering;
3. fit/tune model;
4. tích hợp inference vào hệ thống;
5. graph/temporal RCA;
6. baseline;
7. F1/Top-K/MRR;
8. ablation;
9. robustness;
10. runtime.

Đây là điểm phải ưu tiên khi viết báo cáo và bảo vệ.

## CLO4 – Trình bày

Có thể minh họa bằng:

- architecture diagram;
- service graph;
- trace;
- timeline;
- anomaly chart;
- RCA ranking;
- ablation plot.

## CLO5 – Làm việc nhóm

- sprint;
- issue tracker;
- PR/code review;
- ownership;
- weekly log;
- ADR.

---

# PHẦN F – CÁC QUYẾT ĐỊNH KỸ THUẬT NÊN GIỮ

# F1. ADR ban đầu

## ADR-001 – Domain

LMS thu gọn là domain của testbed, không phải sản phẩm chính.

## ADR-002 – AI user

Developer/SRE là người dùng của AI.

## ADR-003 – Telemetry standard

OpenTelemetry.

## ADR-004 – Analysis architecture

Modular monolith trước; không microservice hóa analysis platform nếu không cần.

## ADR-005 – Learning paradigm

Unsupervised / weakly supervised là mặc định.

## ADR-006 – RCA granularity

Service-level trước; dependency/indicator evidence đi kèm.

## ADR-007 – Structural information

Dynamic dependency graph lấy chủ yếu từ traces.

## ADR-008 – Deployment

Docker Compose trước, Kubernetes sau.

## ADR-009 – Ground truth

Controlled fault injection là nguồn ground truth chính.

## ADR-010 – LLM

Không thuộc core AI.

## ADR-011 – Frontend LMS

Optional/minimal.

## ADR-012 – External benchmark

RCAEval/AnoMod là validation bổ sung, không được làm trễ evaluation trên testbed chính.

---

# F2. Các tài liệu/công trình nên đọc

## Nền tảng observability

**[O1] OpenTelemetry Documentation / Specification**  
Nguồn chuẩn cho traces, metrics, logs, OTLP, resources và semantic conventions.

**[O2] OpenTelemetry Collector documentation**  
Kiến trúc receive/process/export telemetry.

**[O3] testbed microservice của nhóm architecture**  
Dùng làm reference về cách một microservice demo được instrument end-to-end; không phải testbed chính bắt buộc của nhóm.

## RCA / AIOps

**[R1] Eadro: An End-to-End Troubleshooting Framework for Microservices on Multi-source Data. ICSE 2023.**  
Cheryl Lee et al. arXiv:2302.05092.

**[R2] PyRCA: A Library for Metric-based Root Cause Analysis. 2023.**  
Chenghao Liu et al. arXiv:2306.11417.

**[R3] BARO: Robust Root Cause Analysis for Microservices via Multivariate Bayesian Online Change Point Detection. FSE 2024.**  
Luan Pham, Huong Ha, Hongyu Zhang. arXiv:2405.09330.

**[R4] Root Cause Analysis for Microservice Systems based on Causal Inference: How Far Are We? ASE 2024.**  
Luan Pham et al. arXiv:2408.13729.

**[R5] RCAEval: A Benchmark for Root Cause Analysis of Microservice Systems with Telemetry Data. WWW 2025.**  
Luan Pham et al. arXiv:2412.17015.

**[R6] Rethinking the Evaluation of Microservice RCA with a Fault Propagation-Aware Benchmark. 2025.**  
arXiv:2510.04711.

**[R7] TORAI: Multi-source Root Cause Analysis for Blind Spots in Microservice Service Call Graph. FSE 2026.**  
Luan Pham et al. arXiv:2604.13522.

**[R8] AnoMod: A Dataset for Anomaly Detection and Root Cause Analysis in Microservice Systems. MSR 2026.**  
Ke Ping et al. arXiv:2601.22881.

**[R9] Anomaly Detection and Root Cause Analysis for Microservice Systems. 2026 thesis.**  
Luan Pham. arXiv:2606.09942.

---

# F3. Checklist trước khi bắt đầu implementation lớn

- [ ] Chốt tên đề tài tạm thời.
- [ ] Chốt LMS chỉ là testbed.
- [ ] Chốt 5–8 service.
- [ ] Chốt sync/async workflow.
- [ ] Chốt 5 fault type MVP.
- [ ] Chốt root-cause granularity.
- [ ] Chốt OpenTelemetry schema.
- [ ] Chốt backend stack.
- [ ] Chốt Compose-first.
- [ ] Chốt anomaly baselines.
- [ ] Chốt RCA baselines.
- [ ] Chốt evaluation metrics.
- [ ] Chốt experiment metadata format.
- [ ] Chốt trách nhiệm từng thành viên.
- [ ] Tạo Git repository + project board.
- [ ] Tạo ADR folder.
- [ ] Không đưa AI nghiệp vụ LMS vào MVP.

---

# F4. Mô tả ngắn toàn đề tài

> Nhóm xây dựng một backend microservice theo miền nghiệp vụ LMS ở phạm vi thu gọn làm môi trường thử nghiệm có kiểm soát. Hệ thống gồm nhiều service tương tác qua API và message queue, sử dụng database, cache và các dependency khác, đồng thời được instrument bằng OpenTelemetry để thu thập metrics, distributed traces và logs. Trên nguồn telemetry này, nhóm xây dựng pipeline AI/ML nhằm học hành vi bình thường, phát hiện các bất thường và incident, sau đó kết hợp mức độ bất thường với quan hệ phụ thuộc động giữa các service, thứ tự xuất hiện triệu chứng và các bằng chứng từ trace/log/metric để xếp hạng các thành phần có khả năng là nguyên nhân sự cố. Nhóm chủ động sinh workload và inject các fault có kiểm soát vào testbed để tạo ground truth, từ đó đánh giá giải pháp bằng các chỉ số như Precision, Recall, F1, Detection Delay, Top-1/Top-3 Root Cause Accuracy, MRR, runtime và ablation study.

---

# F5. Quy tắc định hướng cuối cùng

Mỗi khi nhóm muốn thêm một công nghệ, model hoặc feature, phải trả lời được ít nhất một câu:

1. Nó giúp tạo failure scenario mới có giá trị không?
2. Nó cải thiện observability không?
3. Nó cải thiện anomaly detection/RCA không?
4. Nó giúp đánh giá khoa học hơn không?
5. Nó giúp hệ thống dễ tái lập/triển khai hơn không?

Nếu cả năm câu đều là **không**, feature đó nhiều khả năng nằm ngoài scope.

Mục tiêu cuối cùng không phải:

> “Xây LMS nhiều chức năng nhất”  
> hoặc  
> “Dùng model AI phức tạp nhất”.

Mục tiêu là:

> **Xây một hệ thống kỹ thuật thống nhất, trong đó microservice backend tạo ra môi trường failure thực tế có kiểm soát, observability cung cấp dữ liệu, AI/RCA chẩn đoán sự cố và thực nghiệm chứng minh giải pháp hiệu quả đến đâu.**
