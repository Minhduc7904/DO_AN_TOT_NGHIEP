# Output task

## Thông tin thực hiện

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_scaffold-repository-and-service-template` |
| Người phụ trách | Đức |
| Trạng thái | Đang thực hiện — phần kỹ thuật đã qua quality gate, còn quy trình PR/review |
| Bắt đầu thực tế | 30/08/2026 |
| Cập nhật gần nhất | 07/09/2026 |
| Pull request | Chưa tạo |
| Người review | Bách — chưa review |

## Báo cáo công việc đã làm

- Tạo pnpm workspace canonical tại `lms/`, khóa Node `22.13.1`, pnpm `11.19.0`, NestJS `12.0.x` và TypeScript `6.0.3`.
- Tạo Course service theo lightweight Clean Architecture; boundary chưa có hành vi chỉ chứa README nêu trách nhiệm, dependency được phép/bị cấm và thời điểm thay bằng code thật.
- Tạo environment validation cho `PORT`, `NODE_ENV`; bootstrap bind `0.0.0.0`, bật graceful shutdown và cung cấp `GET /health`.
- Tạo multi-stage Dockerfile, production dependency deployment và runtime `USER node`; pin Corepack `0.34.0` để pnpm `11.19.0` hoạt động trên Node `22.13.1-alpine` mà vẫn giữ kiểm tra chữ ký.
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
| Frozen install, lint, format check, unit, E2E và build | Đạt | Container sạch dùng Node `22.13.1`, Corepack `0.34.0` và pnpm `11.19.0` chạy frozen install, lint, format check, 6 unit test, 2 E2E test và build với exit code `0` ngày 07/09/2026 |
| Health endpoint và route chưa triển khai | Đạt | Container production trả `GET /health` với `200`, `status=ok`, timestamp `2026-09-07T03:05:10.473Z`; `/api/v1/courses` trả `404` |
| Docker image chạy non-root và health hoạt động | Đạt | Image `aiops-lms-course:task01-check` build thành công từ context `lms/`; container chạy UID `1000` và health endpoint hoạt động trên `PORT=3102` |
| Dependency direction và placeholder README | Đạt | ESLint exit code `0`; domain/application import restriction được cấu hình; các boundary chưa triển khai chỉ có README |
| Fresh setup từ bản sao sạch | Đạt | Bản sao chỉ đọc được chép vào container Node `22.13.1`, cài frozen lockfile rồi chạy toàn bộ quality gate thành công |
| Sản phẩm được lưu/đẩy và truy cập | Đang hoàn tất | File nằm đúng vị trí trên nhánh task; commit/push substantive work được thực hiện trước khi tạo PR |
| PR head có URL và trạng thái `Chờ review` | Chưa đạt | Chưa tạo PR |
| Approval và completion metadata trước merge | Chưa đạt | Chưa có review GitHub từ Bách |

## Thay đổi, tồn đọng và bước tiếp theo

- Build script dùng `tsc -p tsconfig.build.json` thay cho `nest build` vì Nest CLI 12 kéo Angular DevKit gặp vòng lặp ESM trên Node `22.13.1`; runtime service vẫn dùng NestJS 12.
- Jest chạy ESM bằng `--experimental-vm-modules` để tương thích package ESM của NestJS 12.
- Máy host chạy Node `24.19.0`; toàn bộ gate được chạy trong container sạch dùng đúng Node `22.13.1` để tránh sai lệch runtime.
- Còn phải commit/push, tạo PR, cập nhật URL/trạng thái `Chờ review` trên PR head và nhờ Bách review theo workflow.

> Task chưa được đánh dấu `Hoàn thành` vì chưa có PR head, GitHub `APPROVED` và completion finalization.
