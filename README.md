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

MVP gồm 8 service và 4 worker (12 `service.name`), chạy trên PostgreSQL, RabbitMQ, MinIO, SMTP và một nhà cung cấp LLM bên ngoài:

```text
Gateway
├── Auth -> Student
├── Student
├── Course -> Media + AI
├── Media -> Student + MinIO
├── Notification
├── Scheduler
└── AI

Worker (cùng image với service, tiêu thụ command qua RabbitMQ)
├── media-worker -> MinIO
├── notification-worker -> Student + SMTP
├── scheduler-worker -> Media
└── ai-worker -> Course + Media + nhà cung cấp LLM

Mỗi service -> PostgreSQL (logical DB riêng); mọi cạnh xác thực bằng service token do Auth cấp
```

- Auth phát hai loại token EdDSA: user access token (đăng nhập) và service access token (client-credentials); mọi service verify cục bộ bằng JWKS. API tách `/api/v1` (public, chỉ Gateway gọi) và `/internal/v1` (service-to-service), xem [ADR-004](docs/processed/adr/adr-004-service-access-token-and-api-surfaces-v1.md).
- Backend testbed dùng TypeScript + NestJS; analysis/anomaly/RCA dùng Python.
- Runtime dùng Docker Compose; workload dùng k6.
- Observability dùng OpenTelemetry, Prometheus, Tempo, Loki và Grafana.
- Primary RCA evaluation ở service-level; component/dependency là evidence bổ sung.
- RCA engine (ML + dependency graph) là bên truy vết nguyên nhân chính và được đối chứng với truy vết thủ công; MCP/agent là thành phần thứ yếu, làm sau, không phải điều kiện hoàn thành ([ADR-002](docs/processed/adr/adr-002-ai-primary-root-cause-analysis-v1.md)).
- Fault canonical là FA–FH kèm bảy case phức tạp C1–C7 ([project-scope-v2](docs/processed/direction/project-scope-v2.md)). Evaluation floor đang đề xuất `K × R` với 3 repetitions mỗi case (21 run nếu đủ bảy case), chờ Đức xác nhận và chốt ở evaluation protocol.
- Robustness MVP gồm ít nhất một đánh giá focused bằng controlled trace dropping/sampling simulation trên telemetry artifact hoặc missing-modality evaluation, tận dụng baseline thu với 100% trace sampling; không yêu cầu robustness matrix lớn.

### Target và Stretch

Target có thể thêm fault crash/restart worker, bổ sung các tín hiệu telemetry còn thiếu, mở rộng thử nghiệm người thật và expanded robustness evaluation với nhiều sampling level, nhiều missing-modality combination, thêm workload/fault intensity, thêm repetitions hoặc live sampling experiment khi thực sự cần. Kubernetes chỉ là Stretch; không thuộc critical path. Service mesh, production-grade enterprise platform và full LMS frontend không thuộc MVP.

## Ranh giới module

- `lms/`: backend workspace canonical dùng pnpm cho LMS testbed.
- `lms/services/`: API Gateway và LMS business services.
- `lms/packages/observability/`: shared application instrumentation.
- `lms/contracts/`: published HTTP/event contracts của LMS.
- `aiops-platform/`: thành phần thu thập dữ liệu và phân tích tách khỏi LMS; hiện có `observability/` (Collector, Prometheus, Tempo, Loki, Grafana). LMS chỉ kết nối qua HTTP (OTLP). Module huấn luyện AI sẽ đặt tại đây.
- `docker-compose/`: Compose manifest để khởi động LMS service và dependency cục bộ; `compose.full.yaml` ghép LMS với `aiops-platform`.
- `load/`: workload implementation.
- `faults/`: reusable fault mechanisms.
- `experiments/`: protocol, scenario orchestration, runner và run artifacts.
- `analysis/evaluation/`: prediction + ground truth → metrics.

Repository chỉ scaffold các module khi bắt đầu triển khai. Cây source code đầy đủ và convention kỹ thuật nằm trong backend blueprint.

## Quick Start Docker Compose

Testbed v2 gồm Gateway, bảy service (Auth, Student, Course, Media, Notification, Scheduler, AI), bốn worker
(`media-worker`, `notification-worker`, `scheduler-worker`, `ai-worker`), PostgreSQL, RabbitMQ, MinIO và Mailpit; dựng
kèm stack observability của `aiops-platform` khi dùng `compose.full.yaml`. Thứ tự dựng từ checkout sạch:

1. Cài toolchain và dependency theo [lms/README.md](lms/README.md#cài-đặt-và-kiểm-tra): Node.js `22.13.1`,
   pnpm `11.19.0` qua Corepack, rồi `pnpm install --frozen-lockfile` trong `lms/`.
2. Validate, khởi động, kiểm tra, xem log và reset stack theo [docker-compose/README.md](docker-compose/README.md).
3. Chạy reset/seed có kiểm soát và regression LMS theo
   [docker-compose/README.md](docker-compose/README.md#regression-lms).

## Tài liệu canonical

| Tài liệu | Vai trò |
| --- | --- |
| [Định hướng tổng thể](docs/processed/direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md) | WHY/WHAT, research questions, anomaly/RCA direction và evaluation philosophy. |
| [Backend blueprint v2](docs/processed/architecture/backend-microservice-testbed-blueprint-v2.md) | **Canonical backend:** định hướng, scope, topology, workload/fault/observability requirements và implementation architecture. |
| [Analysis/AI/RCA blueprint v1](docs/processed/architecture/analysis-anomaly-rca-blueprint-v1.md) | **Canonical Analysis/AI/RCA:** định hướng, telemetry/data model, feature pipeline, detector, incident, graph, RCA, evidence, evaluation và implementation architecture. |
| [Plan v0.2 — 24 tuần](docs/processed/plan/plan-v0.2-24-weeks.md) | **Canonical project plan:** WHEN, WHO, milestone, dependency, deliverable và weekly DoD. |
| [Mô tả đề tài](docs/processed/description/Mo_ta_de_tai_DATN_260811_125322_day_du.md) | Mô tả đề tài đã chuyển đổi từ tài liệu nguồn. |
| [Quy ước workspace](agent-resources/skills/graduation-workspace/references/workspace-standard.md) | Cách tổ chức task, input/output và tài liệu của nhóm. |

Định hướng tổng thể, hai blueprint và plan v0.2 tạo thành kiến trúc nền cho implementation; định hướng và hai blueprint đã được viết lại theo topology v2 ở R-12 (bản trước giữ làm lịch sử), plan v0.2 chưa cập nhật theo refactor. Thay đổi architectural decision đáng kể sau mốc này phải được ghi bằng ADR và cập nhật tài liệu canonical liên quan.

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

## Kiểm tra kế hoạch và tiến độ

Markdown trong `docs/processed/plan/` và hồ sơ `workspace/` là nguồn canonical cho kế hoạch, phân công, trạng thái và bằng chứng DoD.

Khi tạo hoặc cập nhật tuần/task, agent đối chiếu trực tiếp `weekly-overview.md`, các card `task-*.md`, input/output của người phụ trách và trạng thái GitHub liên quan. Việc kiểm tra phải xác nhận tối thiểu người phụ trách, trạng thái, nhánh, liên kết hồ sơ, PR/review và bằng chứng DoD khớp nhau trước khi báo workflow hoàn tất.

## Lưu ý

Dự án phục vụ mục đích học thuật. Kết luận chỉ được đưa ra từ experiment có manifest, ground truth và artifact đủ để kiểm tra/tái lập.
