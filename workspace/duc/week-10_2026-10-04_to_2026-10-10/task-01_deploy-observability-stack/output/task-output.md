# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_deploy-observability-stack` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 21/10/2026 21:20 (Asia/Saigon) |
| Hoàn thành thực tế | 21/10/2026 21:42 (Asia/Saigon) — finalization theo ngoại lệ |
| Tổng thời lượng | Khoảng 22 phút lịch từ thời điểm bắt đầu ghi hồ sơ; không phải timesheet |
| Pull request | [PR #41](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/41) |
| Người review | Agent review độc lập theo yêu cầu Đức; không đại diện Bách |
| Kết quả review | APPROVED nội bộ tại `9c4a422`; không có GitHub APPROVED |

## Báo cáo công việc đã làm

Dựng năm backend mặc định cùng network Compose; pin image gốc và builder cho probe static. Tất cả giữ user/entrypoint gốc, dùng thư mục volume có ownership phù hợp. Sửa endpoint container của tám runtime sang Collector nội bộ. Cấu hình ba pipeline, resource labels bounded, retention/resource limit MVP và ba datasource Grafana; không triển khai structured logger/dashboard. Đồng bộ vị trí cấu hình trong blueprint/README root từ dự kiến cũ sang `docker-compose/observability/` theo card và plan đã chốt; không đổi topology/schema.

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
| Compose hợp lệ, 16 thành phần healthy | Đạt | Compose config và hai lượt reset local xác nhận16/16 healthy; CI fresh Compose pass |
| Endpoint Collector nội bộ, 3 pipeline | Đạt | Compose tám runtime; Collector 0.163.1 khởi động thành công HTTP4318/gRPC4317 và 3 pipeline |
| OTLP mẫu query được ba backend | Đạt | `pnpm run test:observability:stack`: Tempo/Prometheus/Loki pass; trace reset1 `b1f0eb6267c67b65f754106eef7fcd91`, reset2 `5edfe219402030b4c2df324c5a8395c3` ngày21/10/2026; Grafana provision3 datasource cũng pass |
| Docs port/volume/retention/resource/stop/reset | Đạt | README và `.env.example`; chỉ bind observability host ports loopback |
| CI, regression, reset hai lần | Đạt | Build/lint/full `pnpm test` local pass; Linux clean quality (gồm `ci:verify`), fresh Compose và regression pass trong [CI run39617474360](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/actions/runs/39617474360). Reset enhanced local2x cùng fingerprint `c0222dc2c158f2f46368db43fe77752a044832ef76a218b9836da2fa5256f522`,16healthy mỗi lượt, query3 backend+Grafana pass và trace cũ404 sau reset |
| URL PR và Chờ review trên remote | Đạt | Card/input/output/overview đồng bộ [PR #41](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/41), push readiness trước khi reviewer bắt đầu |
| Review độc lập/finalization theo ngoại lệ | Đạt theo ngoại lệ | Reviewer agent độc lập APPROVED tại `9c4a422`; Đức xác nhận dùng review nội bộ và ủy quyền điều phối viên commit/push/merge; không có GitHub approval của Bách |

## Thay đổi, tồn đọng và bước tiếp theo

- Giữ phạm vi task-01; task-04/05 của Bách vẫn `Chờ xử lý`.
- Finalization trước merge sau review nội bộ; CI của head cuối phải đạt trước merge. `ci:verify` local dừng format với34 file baseline CRLF giống origin/main sau normalize; clean Linux quality pass. Windows wrapper `test:regression` gặp baseline `spawn EINVAL` ở pnpm.cmd, Linux wrapper regression đã pass. Một lượt local startup Enrollment exited1 không lưu đủ log trước cleanup; manual startup và hai lượt reset sau đó đều pass; reset-smoke nay lưu log khi fail trước cleanup để điều tra nếu tái diễn.
- Sau kiểm chứng cập nhật PR/URL/readiness, agent review độc lập kiểm tra rồi điều phối viên finalization/merge theo [quy tắc canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Review độc lập và finalization

Reviewer kiểm Compose/syntax/diff, reset guard 11/11, smoke ba backend và Grafana, OTLP gRPC thực tế, runtime nonroot/resource/loopback labels và negative health probe. Trace độc lập HTTP `c2ade414827dd8eaf6c54c4dd91b2f14`, gRPC `727ea401aab57f8c2801b9b2bc0280ef`. Không có blocker. Góp ý không chặn: reset smoke đang dùng Tempo port canonical 3200; chưa hỗ trợ override port tùy chỉnh tại assertion trace cũ. Không có GitHub review submission; nguồn thay thế là review agent và xác nhận ngoại lệ của Đức trong cuộc trò chuyện triển khai W10.
