# Báo cáo đồng bộ kiến trúc và tài liệu

## 1. Mục tiêu

Đợt chỉnh sửa này thống nhất vai trò của các tài liệu, chốt phạm vi khả thi cho nhóm hai người và loại các mô tả cạnh tranh về service topology, source-code structure, observability, experiment, RCA và timeline. Mục tiêu là để nhóm có thể bắt đầu implementation từ backend blueprint mà không phải suy đoán tài liệu nào được ưu tiên.

## 2. Các quyết định đã chốt

- `backend_microservice_testbed_blueprint.md` là canonical implementation architecture.
- `plan-v0.2-24-weeks.md` là sole canonical source of truth cho WHEN + WHO.
- MVP gồm 6 business service + API Gateway; `Assignment` thuộc Target.
- Auth phát JWT và Gateway kiểm tra JWT cục bộ, không remote introspection cho mọi request.
- Backend testbed dùng TypeScript + NestJS; analysis/anomaly/RCA dùng Python; runtime MVP dùng Docker Compose.
- `packages/observability/` chứa shared application instrumentation; `infrastructure/observability/` chứa runtime/config của Collector, Prometheus, Tempo, Loki và Grafana.
- `load/`, `faults/`, `experiments/` và `analysis/evaluation/` có trách nhiệm riêng, không copy implementation chéo.
- Event MVP canonical là `grade.completed`.
- Primary RCA evaluation là service-level; component/dependency là evidence bổ sung.
- MVP evaluation floor là 5 scenario × 3 repetitions = 15 controlled runs; 30–60+ run là Target khi đủ điều kiện.
- Tuần 1–2 là preparation, tuần 3–22 là implementation và tuần 23–24 chỉ là contingency/buffer.

## 3. Các file đã sửa

- `README.md`
  - Rút gọn thành landing page; phân biệt MVP/Target/Stretch và liên kết đầy đủ các tài liệu canonical.
- `docs/processed/architecture/backend_microservice_testbed_blueprint.md`
  - Chuẩn hóa repository tree, lightweight service template, contract/event convention, observability-by-design, experiment manifest, fault scope, RCA granularity và technical DoD.
- `docs/processed/architecture/dinh_huong_backend_microservice_testbed_lms.md`
  - Giữ đúng phạm vi backend testbed; chốt topology, workflow, công nghệ, observability, workload, fault và MVP/Target/Stretch; bỏ source tree và roadmap trùng lặp.
- `docs/processed/direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`
  - Giữ WHY/WHAT, research questions, high-level architecture, anomaly/RCA direction và evaluation philosophy; bỏ implementation tree, roadmap chi tiết và residue ngoài miền LMS.
- `docs/processed/plan/plan-v0.2-24-weeks.md`
  - Giữ mô hình 24 tuần; đưa Assignment ra khỏi critical path; chốt async workflow, observability, manifest, fault floor, service-level RCA và tham chiếu blueprint.
- `docs/processed/plan/plan-v0.1-20-weeks.md`
  - Thêm banner historical/deprecated và liên kết tới plan v0.2.

## 4. Các inconsistency đã xử lý

- Loại các cây repository cạnh tranh có `platform/`, root `backend/`, root `testbed/`, root `dashboard/`, root `agents/` hoặc `docs/architecture/`.
- Thống nhất runtime observability tại `infrastructure/observability/` và tách khỏi shared instrumentation.
- Loại việc coi `Assignment` là điều kiện MVP và bỏ `assignment.created` khỏi critical path.
- Loại mô tả Auth như shared runtime dependency của mọi API sau login.
- Chốt NestJS thay cho danh sách lựa chọn Java/Go/NestJS song song.
- Giảm Clean/Hexagonal ceremony; không bắt buộc `command/handler/result`, interface hoặc folder rỗng.
- Tách rõ workload generation, fault mechanism, experiment orchestration và evaluation logic.
- Chuẩn hóa manifest đủ truy vết workload, fault, ground truth, code/config version và artifact.
- Loại residue `checkout`, `inventory`, topology e-commerce và roadmap 24 tuần cạnh tranh trong tài liệu tổng thể.
- Thay yêu cầu 60–100 run bằng evaluation floor khả thi và Target có điều kiện.

## 5. Trạng thái sau chỉnh sửa

Các tài liệu canonical hiện đã đủ thống nhất để bắt đầu scaffold và triển khai `services/`, `analysis/`, `infrastructure/`, `load/`, `faults/` và `experiments/` theo backend blueprint.

`plan-v0.1-20-weeks.md` vẫn giữ nguyên các quyết định lịch sử, bao gồm naming/cấu trúc cũ, vì đây là historical baseline có banner cảnh báo rõ và không phải nguồn triển khai hiện tại. Repository hiện chưa scaffold các module implementation; việc này là chủ ý vì phạm vi đợt đồng bộ chỉ là tài liệu.

Đã chạy search consistency cuối cho các path/pattern cũ, event name, run count, residue e-commerce và tuần 23–24; các occurrence cũ còn lại chỉ nằm trong historical plan hoặc trong đoạn giải thích rõ nội dung đã loại bỏ/không được dùng. Kiểm tra link nội bộ và `git diff --check` đều đạt.
