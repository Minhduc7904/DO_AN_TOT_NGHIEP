# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_deploy-observability-stack` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện |
| Bắt đầu thực tế | 21/10/2026 21:15 (Asia/Saigon) |
| Hoàn thành thực tế | Chưa finalization |
| Tổng thời lượng | Đang thực hiện |
| Pull request | Bổ sung sau khi tạo |
| Người review | Agent review độc lập theo yêu cầu Đức; không đại diện Bách |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

Dựng năm backend mặc định cùng network Compose; pin image gốc và builder cho probe static. Tất cả giữ user/entrypoint gốc, dùng thư mục volume có ownership phù hợp. Sửa endpoint container của tám runtime sang Collector nội bộ. Cấu hình ba pipeline, resource labels bounded, retention/resource limit MVP và ba datasource Grafana; không triển khai structured logger/dashboard.

Kiểm chứng thực tế phát hiện Tempo 3.1 dùng `backend_worker.compaction` thay `compactor` của Tempo 2 và Loki cần volume writable UID10001; cấu hình đã điều chỉnh theo version pin và cả năm backend đã healthy.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Compose và cấu hình backend/probe | Config / Code | [compose.yaml](../../../../../docker-compose/compose.yaml), [observability](../../../../../docker-compose/observability/) |
| Smoke dữ liệu thật | Test | [stack-smoke.mjs](../../../../../lms/test/observability/stack-smoke.mjs) |
| Reset hai lần và kiểm chứng telemetry | Test | [compose-reset-smoke.mjs](../../../../../lms/test/testbed-reset/compose-reset-smoke.mjs) |
| Hướng dẫn vận hành | Docs | [README](../../../../../docker-compose/README.md#observability-baseline-w10) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Compose hợp lệ, 16 thành phần healthy | Đang kiểm chứng | `docker compose ... config --quiet` đạt; 5 backend healthy; full topology/reset đang chạy |
| Endpoint Collector nội bộ, 3 pipeline | Đạt | Compose tám runtime; Collector 0.163.1 khởi động thành công HTTP4318/gRPC4317 và 3 pipeline |
| OTLP mẫu query được ba backend | Đạt | `pnpm run test:observability:stack`: Tempo/Prometheus/Loki pass; trace `e09fa858370e2430cefd10f41c5a5a30` ngày 21/10/2026 |
| Docs port/volume/retention/resource/stop/reset | Đạt | README và `.env.example`; chỉ bind observability host ports loopback |
| CI, regression, reset hai lần | Đang kiểm chứng | Build/lint local pass; `ci:verify` local dừng format với 34 file baseline CRLF giống `origin/main` sau normalize, không thuộc diff; chờ clean-checkout CI và test còn lại |
| URL PR và Chờ review trên remote | Chưa đạt | Chưa chuyển trạng thái trước khi đủ bằng chứng |
| Review độc lập/finalization theo ngoại lệ | Chưa đạt | Đợi review agent và điều phối viên; ngoại lệ do Đức xác nhận, không có GitHub approval của Bách |

## Thay đổi, tồn đọng và bước tiếp theo

- Giữ phạm vi task-01; task-04/05 của Bách vẫn `Chờ xử lý`.
- Chưa finalization/merge. Không ghi các kiểm tra đang chạy là đạt.
- Sau kiểm chứng cập nhật PR/URL/readiness, agent review độc lập kiểm tra rồi điều phối viên finalization/merge theo [quy tắc canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).
