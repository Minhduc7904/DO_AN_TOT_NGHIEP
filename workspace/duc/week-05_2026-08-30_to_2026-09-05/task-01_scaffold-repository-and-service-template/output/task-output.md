# Output task

## Thông tin thực hiện

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_scaffold-repository-and-service-template` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện — phần code đã qua quality gate cục bộ, còn Docker runtime và quy trình PR/review |
| Bắt đầu thực tế | 30/08/2026 |
| Cập nhật gần nhất | 30/08/2026 |
| Pull request | Chưa tạo |
| Người review | Bách — chưa review |

## Báo cáo công việc đã làm

- Tạo pnpm workspace canonical tại `lms/`, khóa Node `22.13.1`, pnpm `11.19.0`, NestJS `12.0.x` và TypeScript `6.0.3`.
- Tạo Course service theo lightweight Clean Architecture; boundary chưa có hành vi chỉ chứa README nêu trách nhiệm, dependency được phép/bị cấm và thời điểm thay bằng code thật.
- Tạo environment validation cho `PORT`, `NODE_ENV`; bootstrap bind `0.0.0.0`, bật graceful shutdown và cung cấp `GET /health`.
- Tạo multi-stage Dockerfile, production dependency deployment và runtime `USER node`.
- Cập nhật blueprint, README repository và card tuần 5 sang canonical path `lms/...`.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| LMS backend workspace | Code/docs | [`lms/`](../../../../../lms/) |
| Course service | Code/docs | [`lms/services/course/`](../../../../../lms/services/course/) |
| Workspace lockfile | Build input | [`lms/pnpm-lock.yaml`](../../../../../lms/pnpm-lock.yaml) |
| Backend blueprint đã chuẩn hóa path | Docs | [`backend_microservice_testbed_blueprint.md`](../../../../../docs/processed/architecture/backend_microservice_testbed_blueprint.md) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả hiện tại | Bằng chứng |
| --- | --- | --- |
| Frozen install, lint, format check, unit, E2E và build | Đạt cục bộ | `pnpm --dir lms install --frozen-lockfile`, `lint`, `format:check`, 6 unit test, 2 E2E test và `build` đều exit code `0` ngày 30/08/2026 |
| Health endpoint và route chưa triển khai | Đạt cục bộ | `GET /health` trả `200`, `status=ok`, timestamp `2026-08-30T08:55:40.158Z`; `/api/v1/courses` trả `404` |
| Docker image chạy non-root và health hoạt động | Chưa kiểm chứng runtime | Dockerfile dùng `USER node`; bước `pnpm deploy --legacy --prod` đã chạy thành công. Docker Desktop daemon không chạy và tài khoản hiện tại không có quyền khởi động `com.docker.service`, nên chưa build/start container |
| Dependency direction và placeholder README | Đạt ở source cục bộ | ESLint exit code `0`; domain/application import restriction được cấu hình; các boundary chưa triển khai chỉ có README |
| Fresh setup từ bản sao sạch | Đạt cục bộ | Bản sao loại `node_modules`, `dist`, `coverage` cài frozen lockfile và chạy lint/format/unit/E2E/build đều exit code `0` |
| Sản phẩm được lưu/đẩy và truy cập | Mới đạt tại working tree | File đã nằm đúng vị trí; chưa commit/push theo yêu cầu hiện tại |
| PR head có URL và trạng thái `Chờ review` | Chưa đạt | Chưa tạo PR |
| Approval và completion metadata trước merge | Chưa đạt | Chưa có review GitHub từ Bách |

## Thay đổi, tồn đọng và bước tiếp theo

- Build script dùng `tsc -p tsconfig.build.json` thay cho `nest build` vì Nest CLI 12 kéo Angular DevKit gặp vòng lặp ESM trên Node `22.13.1`; runtime service vẫn dùng NestJS 12.
- Jest chạy ESM bằng `--experimental-vm-modules` để tương thích package ESM của NestJS 12.
- Máy kiểm chứng hiện chạy Node `24.19.0`; repository và Docker image khóa target Node `22.13.1`. Engine warning là chủ đích để phát hiện lệch runtime.
- Còn phải bật Docker daemon, chạy Docker build/container/health/non-root gate, sau đó commit/push, tạo PR và nhờ Bách review theo workflow.

> Task chưa được đánh dấu `Hoàn thành` vì chưa có Docker runtime evidence, PR head, GitHub `APPROVED` và completion finalization.
