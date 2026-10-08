# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-grading-service` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành |
| Bắt đầu thực tế | 08/10/2026 |
| Hoàn thành thực tế | 08/10/2026 — finalization theo ngoại lệ do Đức xác nhận |
| Tổng thời lượng | Không có giờ bắt đầu/kết thúc chính xác để tổng kết; thực hiện trong ngày 08/10/2026 |
| Pull request | [#32](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32) |
| Người review | Subagent AI theo chỉ định của Đức (thay Bách) |
| Kết quả review | Review nội bộ vòng 1 không có blocking; **chưa có verdict GitHub `APPROVED`** |

## Báo cáo công việc đã làm

- Khởi tạo hồ sơ task, chuyển card và `weekly-overview.md` sang `Đang thực hiện`.
- Dựng `lms/services/grading/` theo hexagonal như Submission: `domain/grade.ts`, `application/` (service, port `GradeRepository`, port `SubmissionClient`, các domain error), `adapters/` (controller, `SubmissionHttpClient`, `PostgresGradeRepository`, dependency telemetry, exception filter), `config/`, `scripts/migrate.ts`, Dockerfile, README và `.env.example` (cổng `3007`).
- API: `POST /api/v1/grades` (chỉ `instructor`, payload strict, `score` thuộc `[0, 100]`, trả `{ id, submission_id, score, completed_at }`) và `GET /api/v1/grades/{grade_id}` (`instructor` đọc mọi grade, `student` chỉ đọc grade của mình, người khác `403`). Grade là create-only: tạo trùng trả `409 CONFLICT` nhờ unique `submission_id`. Không có `PUT`/`PATCH`/`DELETE`/list và không có RabbitMQ publisher.
- Grading gọi Submission qua HTTP trước khi persist (`404` nếu không tồn tại, `503`/`504` khi lỗi/quá hạn). Lời gọi nội bộ không gửi Bearer JWT hay principal header (Submission cho phép `GET` không có principal), chỉ propagate W3C trace context. `principal_id`/`course_id` trong `grades` là snapshot từ response của Submission.
- `grading_db`: bảng `grades` (`id uuid`, `submission_id text UNIQUE`, `principal_id`, `course_id`, `score numeric(7,4)` có CHECK `[0,100]`, `completed_at`), migration idempotent, seed một grade cho `submission-001` (UUID cố định `7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001`, `ON CONFLICT DO NOTHING`). `numeric` được chuyển sang `number`; PostgreSQL `23505` được map thành `GradeConflictError`.
- Telemetry: dependency `grading-submission` và `grading-postgres` có client span, `grading.dependency.request.count`, `grading.dependency.error.count`, `grading.dependency.duration`, `status` hữu hạn (`ok`/`timeout`/`unavailable`). `GradeConflictError` và Submission `404` là kết quả nghiệp vụ nên không tính vào error count. Không dùng principal/submission/grade ID, JWT làm label.
- Gateway: khai báo `GATEWAY_SUBMISSION_BASE_URL` (lấp config gap) và `GATEWAY_GRADING_BASE_URL` trong env schema/`.env.example`, thêm route `/api/v1/grades` và `/api/v1/grades/*path`; principal chỉ derive từ JWT (header `x-principal-*` của client bị bỏ).
- Auth: seed idempotent thêm `instructor@example.test` (role `instructor`), không đổi account student.
- Compose/CI: service `grading` (cổng 3007, phụ thuộc `postgres` và `submission`), Gateway phụ thuộc Grading, `grading_db` trong init PostgreSQL, biến môi trường trong `.env.example`; workspace scripts `build`/`lint`/`test` gồm Grading, thêm `test:grading:postgres` và `test:w5:postgres`; CI tạo `GRADING_DATABASE_URL`, chạy hai script mới và thêm bước smoke qua Gateway vào job Compose.

### Quyết định/điều chỉnh so với kế hoạch

- Submission `GET /api/v1/submissions/{id}` không bắt buộc principal header (`principal` optional trong controller) nên Grading gọi không kèm principal, đúng contract v1 §2.3 mục 3; không phát sinh cơ chế mới.
- `GET /api/v1/grades/{id}` với id không phải UUID trả `404` (không thể tồn tại) thay vì để PostgreSQL báo lỗi cast.
- Test Gateway → Grading → Submission dùng Submission thật trên PostgreSQL (`test/w5-postgres-workflow.e2e-spec.ts`); Course/Enrollment là stub HTTP tối thiểu, Storage Mock thật.
- Contract v1 §10 ban đầu chưa liệt kê `403 FORBIDDEN` và giới hạn `score` của Grading; đã bổ sung trong vòng review nội bộ vòng 1 (xem mục bên dưới), chỉ phần Grading, không đổi event `grade.completed`.
- `tools/sync-plan-json-and-timeline.ps1` không chạy nguyên bản được trên Linux (lỗi `MakeRelativeUri` do dùng dấu `\`; `docs/processed/plan/json/` thuộc `root` nên không ghi được; card task-02/task-03 của Bách trỏ tới file workspace chưa tồn tại). Đã chạy bản sao tạm ngoài repo (sửa tính đường dẫn, bỏ kiểm tra tồn tại link, ghi JSON ra thư mục tạm) và nhận `Đồng bộ thành công: 24 tuần, 32 task`; nhưng PowerShell 7 sinh định dạng JSON khác bản đã commit nên timeline sinh lại thay đổi ~9.600 dòng không phản ánh thay đổi thực, vì vậy không commit timeline sinh lại. Timeline đang chờ đồng bộ bằng Windows PowerShell; không sửa tay đầu ra.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Grading service (API, migration/seed, HTTP client Submission, test) | Code | [lms/services/grading/](../../../../../lms/services/grading/) |
| Gateway route/config, Auth seed instructor | Code / Config | [lms/services/gateway/](../../../../../lms/services/gateway/), [lms/services/auth/](../../../../../lms/services/auth/) |
| Compose/CI wiring | Config | [docker-compose/compose.yaml](../../../../../docker-compose/compose.yaml), [.github/workflows/ci.yml](../../../../../.github/workflows/ci.yml) |
| Test workflow W5 | Code | [lms/test/w5-postgres-workflow.e2e-spec.ts](../../../../../lms/test/w5-postgres-workflow.e2e-spec.ts) |

## Đối chiếu Definition of Done

Bằng chứng chạy cục bộ ngày 08/10/2026 với Node 22.13.1, pnpm 11.19.0 (không tắt engine check), PostgreSQL `postgres:17.6-alpine` và Redis `redis:8.2.1-alpine` tạm bằng Docker, trên HEAD của nhánh task.

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Grading tạo grade theo HTTP contract, validation/authorization/error envelope rõ ràng và gọi Submission qua HTTP | Đạt | `services/grading/test/unit/grading.controller.spec.ts` (401/403/400/404/409/503/504, representation chỉ gồm 4 field), `grading.service.spec.ts`, `submission-http.client.spec.ts`: 33/33 test pass; `test/submission-integration.mjs` gọi Submission qua HTTP thật; `test:w5:postgres` 3/3 pass (Gateway → Grading → Submission thật). |
| `grading_db` migration/seed từ trạng thái sạch, chạy lại không nhân bản; không cross-service DB/source import | Đạt | `pnpm run test:grading:postgres`: "Grading PostgreSQL migration, seed và repository integration đạt." (migrate hai lần, seed 1 dòng, create/find, `numeric`→`number`, unique→`GradeConflictError`, CHECK score, DB unavailable/timeout map đúng); `pnpm run test` chạy `test:architecture` và `pnpm run lint` sạch (`architecture/no-cross-service-imports`). |
| Health, config, Compose/Gateway wiring và unit/PostgreSQL integration tests pass | Đạt | `docker compose --env-file docker-compose/.env.example -f docker-compose/compose.yaml config --quiet` rc=0; `docker compose up --build -d --wait` toàn bộ service healthy (kể cả `grading`); smoke qua Gateway: login student → enroll → tạo Submission mới → login instructor → student bị `403` khi chấm → instructor tạo grade `201` → student đọc grade → tạo lần hai `409`; Gateway e2e 9/9 pass (route `/grades`, ghi đè principal giả mạo). Chạy lặp smoke vẫn đạt. |
| Telemetry HTTP server/client và PostgreSQL giữ trace context, có dependency identity/error semantics, không lộ secret/PII | Đạt | `test/telemetry/dependency.telemetry-test.mjs` ("Grading dependency spans và metrics assertions đạt."), `submission-integration.mjs` (traceparent Grading → Submission, span lỗi `timeout`/`unavailable`, metric không chứa principal/submission/JWT), `test:w5:postgres` (cùng trace ID qua Gateway, Grading, Submission, `grading-postgres`, `submission-postgres`; quan hệ cha-con span đúng). |
| URL/số PR và `Chờ review` đã commit/push vào PR head trước review | Đạt | PR [#32](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32); transition này được commit/push vào PR head. |
| PR có mô tả đúng quy tắc, có `APPROVED` hợp lệ và completion metadata | Đạt theo ngoại lệ | PR [#32](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32) dùng template. Bách không thể review; Đức chỉ định subagent AI review (vòng 1, [comment](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/32#issuecomment-6053804131)) và xác nhận finalization dù chưa có GitHub `APPROVED`; completion metadata được commit/push vào PR #32. Không ghi nhận đây là GitHub approval. |

### Cổng kiểm chứng đã chạy (kết quả thực)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm install --frozen-lockfile` | Đạt (lockfile giữ định dạng Prettier; diff so với `main` chỉ thêm importer `services/grading`) |
| `pnpm run format:check` | Đạt |
| `pnpm run build` | Đạt |
| `pnpm run lint` | Đạt (`--max-warnings=0`) |
| `pnpm run test` | Đạt (observability 7, course 18, auth 6, gateway 9, enrollment 20, storage mock 3, submission 15, grading 33, notification 4, test:w1 7; các telemetry test đạt) |
| `pnpm run test:grading:postgres` | Đạt |
| `pnpm run test:w1:postgres`, `test:course:postgres`, `test:enrollment:postgres`, `test:submission:postgres`, `test:w2:postgres`, `test:w3:postgres`, `test:w5:postgres` | Đạt |
| `pnpm run ci:verify` | Đạt |
| `docker compose ... config --quiet` và smoke Compose qua Gateway | Đạt |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: grade create-only (card nêu "tạo/cập nhật" nhưng kế hoạch đã chốt chỉ tạo); thêm `403` và giới hạn `score` so với ví dụ contract v1.
- Việc chưa hoàn thành hoặc trở ngại: Không có blocker substantive trong phạm vi task-04. GitHub chưa có `APPROVED` hợp lệ từ thành viên còn lại — cổng chuẩn được Đức yêu cầu bỏ qua theo ngoại lệ. Timeline đang chờ đồng bộ bằng Windows PowerShell (xem ghi chú trên); Đức chỉ thị tiếp tục.
- Bước tiếp theo: Đức kiểm tra branch protection rồi merge PR #32 theo ngoại lệ; đồng bộ timeline bằng Windows PowerShell; bắt đầu task-05 từ `main` mới.

## Vòng review nội bộ vòng 1 (ngày 08/10/2026)

Nguồn: Đức giao một subagent AI đóng vai reviewer thay Bách (Bách không còn tham gia review). Đây là xác nhận/chỉ định của người phụ trách, **không phải** verdict GitHub `APPROVED`; PR chưa có approval hợp lệ trên GitHub. Sau vòng review này, Đức xác nhận finalization theo ngoại lệ. Reviewer đã tự review lại toàn bộ `git diff main...HEAD` (không dựa vào kết luận review nội bộ trước), không tìm thấy lỗi blocking; có 4 góp ý non-blocking, đã xử lý như sau.

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| a | Non-blocking (nên sửa) | `lms/services/grading/src/adapters/persistence/postgres-grade.repository.ts` | `Pool` thiếu listener `error`: client idle bị ngắt kết nối làm process crash. | Thêm `pool.on('error')` chỉ log mã lỗi (không log message/connection string). Test mới `test/unit/postgres-grade.repository.spec.ts` kiểm tra emit `error` không ném, có log mã lỗi và không chứa credential. Không sửa Submission (ngoài phạm vi). |
| b | Non-blocking | `lms/services/grading/src/adapters/http/grading/grading.controller.ts` | `numeric(7,4)` làm tròn âm thầm `score` có hơn 4 chữ số thập phân. | Chọn validate: `score` tối đa 4 chữ số thập phân, vượt thì `400 VALIDATION_ERROR`. Lý do: nhất quán với cách controller đã validate chặt (strict, `[0, 100]`) và tránh trả về giá trị khác với giá trị client gửi. Thêm case test từ chối `90.12345` và chấp nhận `92.1234`; README và contract ghi rõ. |
| c | Non-blocking | `postgres-grade.repository.ts` (nhận diện timeout) | Timeout DB nhận diện bằng regex message. | Giữ nguyên, thêm comment lý do: `pg` không gắn code ổn định cho connection timeout (`timeout exceeded when trying to connect`) và client `query_timeout` (`Query read timeout`); chỉ `57014` (statement timeout phía server) có code và đã được xử lý. Test integration timeout thật vẫn đạt. |
| d | Non-blocking (tài liệu) | `docs/processed/architecture/http-and-event-contracts-v1.md` §10 | Chưa có `403`, quyền đọc và giới hạn `score` của Grading. | Bổ sung §10.2/§10.3: chỉ `instructor` tạo, payload strict, `score` trong `[0, 100]` tối đa 4 chữ số thập phân, create-only/`409`, `401`/`403`. Không đổi §11 (`grade.completed`). |

Kết quả kiểm chứng sau khi sửa (Node 22.13.1, pnpm 11.19.0; PostgreSQL `postgres:17.6-alpine` tạm tại `127.0.0.1:55432`, đã xóa sau khi chạy):

| Lệnh | Kết quả |
| --- | --- |
| `pnpm install --frozen-lockfile` | Đạt |
| `pnpm run format:check`, `build`, `lint` | Đạt |
| `pnpm run test` | Đạt (Grading 35 test, tăng từ 33) |
| `pnpm run test:grading:postgres` | Đạt |
| `pnpm run test:w5:postgres` | Đạt |
| `pnpm run ci:verify` | Đạt |
| `docker compose --env-file docker-compose/.env.example -f docker-compose/compose.yaml config --quiet` | Đạt |

Smoke Compose đầy đủ không chạy lại vì vòng này không đổi Compose/Gateway/Dockerfile.
