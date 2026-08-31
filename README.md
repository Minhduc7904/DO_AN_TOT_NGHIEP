<div align="center">

# AIOps RCA for Microservices

### Phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố từ observability telemetry

<p>
  <img src="https://img.shields.io/badge/Status-In%20Development-2563EB?style=for-the-badge" alt="Project status: In Development" />
  <img src="https://img.shields.io/badge/Type-Graduation%20Thesis-7C3AED?style=for-the-badge" alt="Project type: Graduation Thesis" />
  <img src="https://img.shields.io/badge/Focus-AIOps%20%26%20RCA-059669?style=for-the-badge" alt="Focus: AIOps and Root Cause Analysis" />
</p>

</div>

## Tổng quan

Đây là đồ án tốt nghiệp xây dựng hệ thống hỗ trợ developer/SRE phát hiện incident và xếp hạng root-cause candidates trong kiến trúc microservice. Một LMS thu gọn đóng vai trò System Under Test để tạo workload, telemetry, fault propagation và ground truth có kiểm soát; LMS không phải sản phẩm chính.

```text
LMS testbed
-> OpenTelemetry metrics + traces + structured logs
-> feature/anomaly/incident pipeline
-> dependency + temporal RCA
-> service-level candidates + evidence
-> evaluation với ground truth
```

## Phạm vi canonical

### MVP

MVP gồm 6 business service và 1 API Gateway:

```text
Gateway
├── Auth
├── Course -> Redis + PostgreSQL
├── Enrollment -> Course
├── Submission -> Course + Enrollment + Storage mock
└── Grading
    ├── Submission
    └── grade.completed -> RabbitMQ -> Notification
```

- Auth phát JWT; Gateway kiểm tra JWT cục bộ.
- Backend testbed dùng TypeScript + NestJS; analysis/anomaly/RCA dùng Python.
- Runtime dùng Docker Compose; workload dùng k6.
- Observability dùng OpenTelemetry, Prometheus, Tempo, Loki và Grafana.
- Primary RCA evaluation ở service-level; component/dependency là evidence bổ sung.
- Evaluation floor là 5 fault scenario × 3 repetitions.
- Robustness MVP gồm ít nhất một đánh giá focused bằng controlled trace dropping/sampling simulation trên telemetry artifact hoặc missing-modality evaluation, tận dụng baseline thu với 100% trace sampling; không yêu cầu robustness matrix lớn.

### Target và Stretch

Target có thể thêm Assignment, MinIO và expanded robustness evaluation với nhiều sampling level, nhiều missing-modality combination, thêm workload/fault intensity, thêm repetitions hoặc live sampling experiment khi thực sự cần. Kubernetes chỉ là Stretch; không thuộc critical path. Service mesh, production-grade enterprise platform và full LMS frontend không thuộc MVP.

## Ranh giới module

- `services/`: API Gateway và LMS business services.
- `packages/observability/`: shared application instrumentation.
- `infrastructure/observability/`: Collector, Prometheus, Tempo, Loki và Grafana runtime/config.
- `load/`: workload implementation.
- `faults/`: reusable fault mechanisms.
- `experiments/`: protocol, scenario orchestration, runner và run artifacts.
- `analysis/evaluation/`: prediction + ground truth → metrics.

Repository chỉ scaffold các module khi bắt đầu triển khai. Cây source code đầy đủ và convention kỹ thuật nằm trong backend blueprint.

## Tài liệu canonical

| Tài liệu | Vai trò |
| --- | --- |
| [Định hướng tổng thể](docs/processed/direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md) | WHY/WHAT, research questions, anomaly/RCA direction và evaluation philosophy. |
| [Backend blueprint](docs/processed/architecture/backend_microservice_testbed_blueprint.md) | **Canonical backend:** định hướng, scope, topology, workload/fault/observability requirements và implementation architecture. |
| [Analysis/AI/RCA blueprint](docs/processed/architecture/analysis-anomaly-rca-blueprint.md) | **Canonical Analysis/AI/RCA:** định hướng, telemetry/data model, feature pipeline, detector, incident, graph, RCA, evidence, evaluation và implementation architecture. |
| [Plan v0.2 — 24 tuần](docs/processed/plan/plan-v0.2-24-weeks.md) | **Canonical project plan:** WHEN, WHO, milestone, dependency, deliverable và weekly DoD. |
| [Mô tả đề tài](docs/processed/description/Mo_ta_de_tai_DATN_260811_125322_day_du.md) | Mô tả đề tài đã chuyển đổi từ tài liệu nguồn. |
| [Quy ước workspace](agent-resources/skills/graduation-workspace/references/workspace-standard.md) | Cách tổ chức task, input/output và tài liệu của nhóm. |

Định hướng tổng thể, hai blueprint và plan v0.2 tạo thành **architecture baseline v1** để bắt đầu implementation. Thay đổi architectural decision đáng kể sau mốc này phải được ghi bằng ADR và cập nhật tài liệu canonical liên quan.

`plan-v0.1-20-weeks.md` là historical baseline và không được dùng làm kế hoạch triển khai hiện tại.

## Nhóm thực hiện

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Minhduc7904">
        <img src="https://github.com/Minhduc7904.png?size=160" width="100" alt="Avatar Nguyễn Minh Đức"><br>
        <strong>Nguyễn Minh Đức</strong><br>
        <sub>@Minhduc7904</sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/b4schh">
        <img src="https://github.com/b4schh.png?size=160" width="100" alt="Avatar Mai Khoa Bách"><br>
        <strong>Mai Khoa Bách</strong><br>
        <sub>@b4schh</sub>
      </a>
    </td>
  </tr>
</table>

## Timeline kế hoạch dự án

Timeline trực quan hiển thị toàn bộ lộ trình 24 tuần, các task đã được break, người phụ trách, trạng thái, phụ thuộc, sản phẩm và Definition of Done. Markdown trong `docs/processed/plan/` vẫn là nguồn canonical; dữ liệu trong `docs/processed/plan/json/` và HTML timeline được sinh tự động, không chỉnh sửa trực tiếp.

Đồng bộ lại JSON và timeline sau khi thay đổi kế hoạch hoặc task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-plan-json-and-timeline.ps1
```

Đồng bộ rồi mở timeline bằng trình duyệt mặc định:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\open-project-timeline.ps1
```

Có thể mở trực tiếp `docs/processed/plan/timeline/project-timeline.html` mà không cần web server hoặc kết nối mạng. Các skill lập task tuần và finalization task bắt buộc chạy bước đồng bộ trước khi workflow được coi là hoàn tất.

## Lưu ý

Dự án phục vụ mục đích học thuật. Kết luận chỉ được đưa ra từ experiment có manifest, ground truth và artifact đủ để kiểm tra/tái lập.
