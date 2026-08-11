<div align="center">

# AIOps RCA for Microservices

### Phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố từ dữ liệu observability và học máy

<p>
  <a href="#-tổng-quan">Tổng quan</a> •
  <a href="#-kiến-trúc">Kiến trúc</a> •
  <a href="#-phạm-vi">Phạm vi</a> •
  <a href="#-tài-liệu">Tài liệu</a> •
  <a href="#-nhóm-thực-hiện">Nhóm</a>
</p>

<p>
  <img src="https://img.shields.io/badge/Status-In%20Development-2563EB?style=for-the-badge" alt="Project status: In Development" />
  <img src="https://img.shields.io/badge/Type-Graduation%20Thesis-7C3AED?style=for-the-badge" alt="Project type: Graduation Thesis" />
  <img src="https://img.shields.io/badge/Focus-AIOps%20%26%20RCA-059669?style=for-the-badge" alt="Focus: AIOps and Root Cause Analysis" />
</p>

</div>

---

## ✨ Tổng quan

Đây là đồ án tốt nghiệp về hệ thống hỗ trợ **developer/SRE phát hiện hành vi bất thường** và **xếp hạng ứng viên nguyên nhân gốc** (*Root Cause Analysis – RCA*) trong kiến trúc microservice, dựa trên dữ liệu observability và học máy.

Hệ thống LMS thu gọn đóng vai trò **microservice testbed / System Under Test**. Testbed tạo workload, telemetry, fault propagation và ground truth có kiểm soát để đánh giá khách quan pipeline AI/RCA — không phải một sản phẩm LMS hoàn chỉnh.

> **Trạng thái hiện tại:** Hoàn thiện định hướng kỹ thuật, kiến trúc testbed và kế hoạch thực nghiệm.

## 🎯 Mục tiêu

| Mục tiêu | Kết quả hướng đến |
| --- | --- |
| **Microservice testbed** | LMS thu gọn có giao tiếp đồng bộ/bất đồng bộ và dependency thực tế. |
| **Observability** | Thu thập metrics, distributed traces và structured logs với OpenTelemetry. |
| **Anomaly detection** | Nhận diện hành vi bất thường/incident từ dữ liệu telemetry. |
| **Root cause analysis** | Xếp hạng root-cause candidates từ dependency graph và thứ tự lan truyền bất thường. |
| **Đánh giá có cơ sở** | Fault injection, workload tự động và ground truth để đo định lượng. |

## 🏗️ Kiến trúc

```mermaid
flowchart LR
    U[Automated Workload] --> G[API Gateway]
    G --> S[LMS Microservice Testbed]
    S --> D[(PostgreSQL · Redis · RabbitMQ · Storage)]
    S --> O[OpenTelemetry]

    O --> T[Metrics · Traces · Logs]
    T --> F[Feature Engineering]
    F --> A[Anomaly & Incident Detection]
    A --> R[Dependency & Temporal RCA]
    R --> V[Root-cause Candidates<br/>Evidence · Timeline · Dashboard]

    I[Fault Injection] --> S
    I --> GT[Ground Truth]
    GT --> E[Evaluation]
    R --> E
```

### Luồng phân tích

```text
Metrics + Traces + Logs
          ↓
Feature engineering theo service và cửa sổ thời gian
          ↓
Anomaly detection → Incident detection
          ↓
Dependency graph + temporal propagation analysis
          ↓
Root-cause candidate ranking + evidence + incident timeline
```

## 🧩 Phạm vi

### LMS Microservice Testbed

Các service dự kiến gồm **API Gateway, Auth, Course, Enrollment, Assignment, Submission, Grading** và **Notification**. Hệ thống sử dụng PostgreSQL, Redis, RabbitMQ và object storage/storage mock để tạo nhiều loại dependency và failure mode.

Các luồng nghiệp vụ trọng tâm là đăng nhập, xem khóa học, đăng ký học, tạo/nộp bài tập, chấm điểm và gửi thông báo.

### Không thuộc MVP

Chat realtime, forum, video streaming, AI tutor, recommendation, payment và mobile app không thuộc phạm vi vì không trực tiếp đóng góp cho bài toán observability, anomaly detection hoặc RCA.

## 🔬 Hướng đánh giá

| Hạng mục | Cách đánh giá |
| --- | --- |
| **Fault scenarios** | Service error/crash, dependency delay, database latency, cache slowdown, CPU saturation, queue backlog. |
| **Anomaly/incident detection** | Precision, Recall, F1-score, Detection Delay. |
| **RCA ranking** | Top-1, Top-3, Mean Reciprocal Rank (MRR). |
| **So sánh & ablation** | Metrics-only so với metrics + traces; RCA có/không có dependency graph và temporal information. |
| **Độ bền** | Runtime, chi phí tài nguyên và khả năng hoạt động khi telemetry thiếu hoặc sampling giảm. |

## 🛠️ Công nghệ định hướng

<p>
  <img src="https://img.shields.io/badge/OpenTelemetry-000000?logo=opentelemetry&logoColor=white" alt="OpenTelemetry" />
  <img src="https://img.shields.io/badge/Prometheus-E6522C?logo=prometheus&logoColor=white" alt="Prometheus" />
  <img src="https://img.shields.io/badge/Grafana%20Tempo-F46800?logo=grafana&logoColor=white" alt="Grafana Tempo" />
  <img src="https://img.shields.io/badge/Loki-F46800?logo=grafana&logoColor=white" alt="Loki" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

| Thành phần | Hướng triển khai |
| --- | --- |
| Testbed | LMS microservices chạy bằng Docker Compose. |
| Telemetry | OpenTelemetry Collector, Prometheus, Grafana Tempo và Loki. |
| Phân tích | Feature engineering, statistical baselines, Isolation Forest, dependency/temporal ranking. |
| Thực nghiệm | Automated workload, fault injection và ground-truth dataset. |

## 📚 Tài liệu

| Nhóm | Nội dung |
| --- | --- |
| [Mô tả đề tài](docs/description/Mô%20tả%20đề%20tài%20ĐATN_260811_125322.pdf) | Phạm vi và mục tiêu chính thức của đồ án. |
| [Định hướng tổng thể](docs/direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md) | Khung kỹ thuật, kiến trúc, hướng AI/ML, RCA và đánh giá. |
| [Kiến trúc backend testbed](docs/architecture/dinh_huong_backend_microservice_testbed_lms.md) | Phạm vi LMS, service topology, workload và fault scenarios. |
| [First Plan — 20 tuần](docs/plan/FirstPlan.md) | Lộ trình theo tuần, mốc bàn giao, phối hợp hai thành viên và quản lý rủi ro. |

## 👥 Nhóm thực hiện

<div align="center">
  <table>
    <tr>
      <td align="center" width="220">
        <a href="https://github.com/Minhduc7904">
          <img src="https://github.com/Minhduc7904.png?size=160" width="120" height="120" alt="Nguyễn Minh Đức" style="border-radius: 50%;" />
          <br /><sub><b>Nguyễn Minh Đức</b></sub>
        </a>
        <br /><sub>Thành viên thực hiện</sub>
      </td>
      <td align="center" width="220">
        <a href="https://github.com/b4schh">
          <img src="https://github.com/b4schh.png?size=160" width="120" height="120" alt="Mai Khoa Bách" style="border-radius: 50%;" />
          <br /><sub><b>Mai Khoa Bách</b></sub>
        </a>
        <br /><sub>Thành viên thực hiện</sub>
      </td>
    </tr>
  </table>
</div>

## 📌 Lưu ý

Dự án phục vụ mục đích học thuật. Kết quả benchmark và kết luận sẽ được công bố sau khi hoàn tất quy trình thực nghiệm có thể tái lập.

<div align="center">
  <sub>Made for a graduation thesis · Observable · Measurable · Evidence-driven</sub>
</div>
