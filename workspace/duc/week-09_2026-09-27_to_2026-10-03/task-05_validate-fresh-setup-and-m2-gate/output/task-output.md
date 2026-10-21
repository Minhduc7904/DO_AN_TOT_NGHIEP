# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                   |
| ------------------ | ------------------------------------------ |
| Mã task            | `task-05_validate-fresh-setup-and-m2-gate` |
| Người phụ trách    | Đức                                       |
| Trạng thái         | Chờ review                             |
| Bắt đầu thực tế    | 14/10/2026 11:25 (UTC+7)                   |
| Hoàn thành thực tế | Chưa hoàn thành                            |
| Tổng thời lượng    | Chưa xác định                              |
| Pull request       | [#40](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40)                                   |
| Người review       | Chưa có                                    |
| Kết quả review     | Chưa review                                |

## Báo cáo công việc đã làm

- 14/10/2026 11:25: Khởi tạo branch, input/output và chuyển task sang `Chờ review`.
- 14/10/2026 — lượt 1, fresh setup trên máy Bách từ clone mới commit `53a3cf4`, chỉ dựa vào tài liệu:
  - Toolchain theo `lms/.nvmrc` và `packageManager`: Node.js `v22.13.1`, pnpm `11.19.0` qua Corepack; Docker `29.8.1`, Docker Compose `v5.3.0`, Linux `7.0.0-38-generic`.
  - `.env` tạo từ `.env.example`; đổi `COMPOSE_PROJECT_NAME` thành `aiops-lms-fresh-setup` vì máy đã có volume dev `aiops-lms_*` (giữ nguyên, không dùng làm bằng chứng).
  - `docker compose build --no-cache` một lần cho tám image bị lỗi `cannot allocate memory` (Docker VM khoảng 3,7 GB RAM); build tuần tự từng image không dùng cache thành công trong 321 giây, `up -d --wait` đủ 11 service healthy trong 30 giây.
  - Mọi lệnh ở mục "Kiểm tra" của `docker-compose/README.md` pass: health Auth/Course, login → `course-001` qua Gateway, PostgreSQL/Redis/RabbitMQ readiness.
  - `pnpm install --frozen-lockfile` với pnpm store mới: tải 637 package, không tái sử dụng store có sẵn.
  - Gọi `pnpm --dir lms run testbed:reset …` từ repository root theo tài liệu cũ bị `ERR_PNPM_UNSUPPORTED_ENGINE` (Corepack dùng pnpm `9.15.9` vì root không có `package.json`); chạy cùng lệnh từ `lms/` thì đúng pnpm `11.19.0`.
  - `testbed:reset` pass trong 31 giây, fingerprint `c0222dc2c158f2f46368db43fe77752a044832ef76a218b9836da2fa5256f522` trùng CI; `test:regression` pass trong 52 giây (E2E `5/5`, messaging failure/recovery ba vòng).
- 14/10/2026 — sửa tài liệu setup (`dbb02d1`, `91ab407`) theo các lỗi phát hiện ở lượt 1.
- 14/10/2026 — lượt 2, clone mới commit `91ab407`, làm theo nguyên văn tài liệu đã sửa: toolchain Bash trong `lms/README.md`, build tuần tự không cache 304 giây, `up -d --wait` 30 giây, các lệnh kiểm tra pass, reset/seed 32 giây với cùng fingerprint, regression 52 giây (E2E `5/5`, messaging ba vòng); tổng 448 giây. Lượt này dùng pnpm store chung của máy vì pnpm 11 không nhận biến store riêng; bằng chứng cài dependency không dùng cache lấy từ lượt 1.
- Dọn toàn bộ project/volume test (`aiops-lms-fresh-setup`, `aiops-lms-local`, `aiops-lms-test-regression`) sau validation; volume dev `aiops-lms_*` không bị tác động.

## Lỗi tài liệu setup đã phát hiện và sửa

| Lỗi                                                                                                            | Tác động                                                          | Sửa tại                                                 |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Quick Start mô tả baseline chỉ có Course, PostgreSQL, Redis, RabbitMQ và không dẫn tới toolchain               | Người mới không biết thứ tự cài đặt và phạm vi Testbed MVP        | `README.md`                                             |
| Toolchain chỉ có lệnh PowerShell; `pnpm --dir lms` từ root dùng sai pnpm qua Corepack                          | Lệnh reset/seed bị `ERR_PNPM_UNSUPPORTED_ENGINE` trên Bash        | `lms/README.md`, `docker-compose/README.md`             |
| Không nêu yêu cầu RAM; build không cache song song hết bộ nhớ                                                  | Fresh build lỗi `cannot allocate memory` trên Docker VM ~4 GB     | `docker-compose/README.md` (mục build tuần tự)          |
| `COMPOSE_PROJECT_NAME` cố định, không cảnh báo về volume có sẵn                                                | Fresh setup dùng lại volume cũ; lệnh reset có thể xóa dữ liệu dev | `docker-compose/README.md`                              |
| Stack chính, `aiops-lms-local` và `aiops-lms-test-regression` dùng chung host port nhưng không ghi thứ tự dừng | Reset/regression lỗi port bị chiếm                                | `docker-compose/README.md`                              |
| `test:regression` chưa được tài liệu hóa                                                                       | Không có hướng dẫn chạy regression W9 task-04                     | `docker-compose/README.md` (mục Regression Testbed MVP) |
| Đoạn OpenTelemetry chỉ nhắc Course                                                                             | Mô tả lệch so với Compose hiện tại                                | `docker-compose/README.md`                              |

## Sản phẩm thực tế

| Sản phẩm                                                                  | Loại | Link hoặc đường dẫn        |
| ------------------------------------------------------------------------- | ---- | -------------------------- |
| Báo cáo fresh setup và đối chiếu Gate M2                                  | Docs | Output này                 |
| Quick Start cập nhật                                                      | Docs | `README.md`                |
| Toolchain Bash và cảnh báo Corepack                                       | Docs | `lms/README.md`            |
| Yêu cầu, build tuần tự, project name, thứ tự port, Regression Testbed MVP | Docs | `docker-compose/README.md` |

## Kiểm chứng độc lập và tiếp quản ngày 21/10/2026

Ngày 21/10/2026, Đức chỉ thị tiếp quản task thay Bách và xác nhận ngoại lệ, cho phép commit/push/merge PR #40 sau cảnh báo. Không có GitHub APPROVED; không xác nhận Gate M2 hai thành viên đạt khi thiếu phần giải thích của Bách.

Bằng chứng: [comment kiểm chứng của Đức](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40#issuecomment-6314205006) tại commit `042a4a4796e2a97b00a700e06066419fc308bd9d`. Đây là kết quả đã ghi trên GitHub, không phải lần chạy mới trong phiên finalization này. Linux, Node 22.13.1, pnpm 11.19.0; 11/11 service healthy; reset 33 giây; regression 52 giây, E2E 5/5 và messaging 3/3; fingerprint trùng hai lượt của Bách. Lượt Đức dùng pnpm store có sẵn, không chứng minh cache rỗng. Windows/PowerShell chưa được kiểm chứng trong lượt này.

Hai workflow được tài liệu hóa trong comment:

1. `login → course → enroll → submit`: Gateway/Auth xác thực, Course đọc dữ liệu/cache, Enrollment ghi đăng ký; Submission kiểm tra Course/Enrollment và gọi Storage Mock.
2. `submit → grade → grade.completed → notification`: Grading publish vào `lms.events`, Notification dùng queue durable, deduplicate `event_id` và ack sau xử lý.

Phần này không thay thế bằng chứng Bách tự giải thích.

## Đối chiếu Gate M2 và DoD hiện hành

| Điều kiện | Kết quả và bằng chứng |
| --- | --- |
| Checkout sạch, topology healthy | Đạt theo hai lượt Bách và comment Đức: 11/11 healthy |
| Reset/seed, regression, commit và thời lượng | Đạt theo các lượt đã ghi; cùng fingerprint, E2E 5/5, messaging ba vòng |
| Hai workflow gồm async | Đã có mô tả và kiểm chứng được ghi dưới tên Đức; chưa có bằng chứng Bách tự giải thích |
| Kiểm chứng độc lập thứ hai | Đã có comment Đức trên đúng PR head kỹ thuật |
| Sửa tài liệu và kiểm tra lại sạch | Đạt theo lượt 2 của Bách; Đức không phát hiện lỗi tài liệu mới |
| URL PR và Chờ review | PR #40; được cập nhật trong commit readiness trước finalization |
| GitHub APPROVED | Không có; bỏ qua theo xác nhận trực tiếp của Đức sau cảnh báo |
| Finalization trước merge | Thực hiện trên chính branch PR; không sửa application code |

**Gate M2 canonical: Chờ xử lý**, vì chưa đủ bằng chứng cả hai thành viên tự vận hành và giải thích. Task validation được đóng theo ngoại lệ do Đức xác nhận; không đồng nghĩa Gate M2 đạt. Kế hoạch canonical không thay đổi.

## Nguồn và hồ sơ bàn giao

- Hồ sơ gốc: [output Bách](../../../../bach/week-09_2026-09-27_to_2026-10-03/task-05_validate-fresh-setup-and-m2-gate/output/task-output.md).
- PR: [#40](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/40).
- Reviewer/verdict GitHub: không có review submission; không ghi APPROVED giả.
- Thời lượng tiếp quản: không có timesheet; không suy diễn tổng thời gian công từ khoảng lịch.
- Bước tiếp theo: finalization metadata, kiểm tra CI và merge theo chỉ thị Đức; giữ giới hạn Gate M2 trong overview.
