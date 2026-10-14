# Output task

## Thông tin hoàn thành

| Trường             | Nội dung                                   |
| ------------------ | ------------------------------------------ |
| Mã task            | `task-05_validate-fresh-setup-and-m2-gate` |
| Người phụ trách    | Bách                                       |
| Trạng thái         | Đang thực hiện                             |
| Bắt đầu thực tế    | 14/10/2026 11:25 (UTC+7)                   |
| Hoàn thành thực tế | Chưa hoàn thành                            |
| Tổng thời lượng    | Chưa xác định                              |
| Pull request       | Chưa tạo                                   |
| Người review       | Chưa có                                    |
| Kết quả review     | Chưa review                                |

## Báo cáo công việc đã làm

- 14/10/2026 11:25: Khởi tạo branch, input/output và chuyển task sang `Đang thực hiện`.
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

## Đối chiếu Gate M2

Nguồn: [Plan v0.2](../../../../../docs/processed/plan/plan-v0.2-24-weeks.md) — "Cả hai đều tự vận hành và giải thích được ít nhất hai workflow xuyên nhiều service" — và nghiệm thu B07 trong [implementation backlog](../../../../../docs/processed/plan/implementation-backlog-v1.md).

| Tiêu chí                                                                 | Kết quả  | Bằng chứng                                                                      |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------- |
| 6 business service + Gateway; PostgreSQL, Redis, RabbitMQ, Storage Mock  | Đạt      | Hai lượt fresh setup đều có 11 service healthy                                  |
| E2E W1–W5 pass                                                           | Đạt      | `test:regression` E2E `5/5` ở cả hai lượt; CI `main` sau merge PR #39 xanh      |
| Reset/seed tái lập                                                       | Đạt      | Cùng fingerprint `c0222dc2…f522` ở hai lượt local, reset trong regression và CI |
| Bách tự vận hành và giải thích ít nhất hai workflow, gồm một luồng async | Chưa đạt | Đã vận hành; phần giải thích chưa ghi nhận                                      |
| Đức tự vận hành độc lập                                                  | Chưa đạt | Chờ Đức chạy theo tài liệu đã sửa và comment kết quả trên PR                    |

Kết luận hiện tại: Gate M2 `Chờ xử lý`.

## Đối chiếu Definition of Done

| Điều kiện từ input                                                    | Kết quả  | Bằng chứng                                                                                                                     |
| --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Checkout sạch, version được tài liệu hóa; Compose đủ service healthy  | Đạt      | Lượt 1 và lượt 2: clone mới, Node `22.13.1`, pnpm `11.19.0`, build không cache, 11 service healthy                             |
| Reset/seed và regression suite pass, có log/thời lượng/commit         | Đạt      | Lượt 1 (`53a3cf4`): reset 31 giây, regression 52 giây; lượt 2 (`91ab407`): reset 32 giây, regression 52 giây; cùng fingerprint |
| Vận hành và giải thích ít nhất hai workflow, gồm một luồng async      | Chưa đạt | Đã vận hành; chờ Bách ghi nhận phần giải thích                                                                                 |
| Người thứ hai kiểm chứng độc lập; nếu chưa có thì Gate M2 `Chờ xử lý` | Chưa đạt | Chờ Đức kiểm chứng trên PR                                                                                                     |
| Lỗi tài liệu setup được sửa và kiểm tra lại từ trạng thái sạch        | Đạt      | Bảy lỗi ở bảng trên; lượt 2 làm theo nguyên văn tài liệu đã sửa và pass                                                        |
| URL/số PR và `Chờ review` được commit/push vào PR head trước review   | Chưa đạt | Chưa tạo PR                                                                                                                    |
| `APPROVED` hợp lệ và finalization trước merge                         | Chưa đạt | Chưa review                                                                                                                    |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Sửa thêm `lms/README.md` vì hướng dẫn toolchain Bash nằm ở đó; vẫn là tài liệu setup, không sửa code.
- Việc chưa hoàn thành hoặc trở ngại: Chưa có phần giải thích workflow của Bách và kiểm chứng độc lập của Đức. Log chi tiết hai lượt lưu ngoài repository trên máy Bách; output ghi lại kết quả và số liệu chính.
- Bước tiếp theo: Mở PR; Đức chạy theo tài liệu đã sửa trên máy mình và comment kết quả lên PR; Bách ghi nhận phần giải thích hai workflow, cập nhật kết luận Gate M2 rồi chuyển `Chờ review`.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
