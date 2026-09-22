# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-enrollment-workflow` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 22/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành — đang chờ `APPROVED` từ Bách, xem [vòng đời task canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical). |
| Tổng thời lượng | ~1 phiên làm việc (22/09/2026), tiếp nối task-01/02 |
| Pull request | [#27](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/27) (xếp chồng trên #26, #25) |
| Người review | Bách (chưa review) |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- **Gateway**: thêm `GATEWAY_ENROLLMENT_BASE_URL` (config + env schema) và route `@All(['enrollments'])` — cố ý không dùng wildcard (khác route `courses`) để `GET /api/v1/enrollments/check` không bị forward qua Gateway, đúng ý contract §7.3 (internal service contract cho Submission). Đổi tên `requireCoursePrincipal` → `requireStudentOrInstructorPrincipal` vì logic dùng chung cho route `courses` và `enrollments`.
- **Compose**: thêm service `enrollment` (port 3003, healthcheck, `depends_on: postgres`), `gateway` thêm `depends_on: enrollment`; thêm `docker-compose/postgres-init/01-create-enrollment-database.sh` (tạo `enrollment_db` sở hữu bởi `POSTGRES_USER` sẵn có — đơn giản hơn script `auth_db` vì không cần role riêng); cập nhật `.env.example`.
- **E2E mới**: `lms/test/w3-postgres-workflow.e2e-spec.ts` (mẫu theo `w2-postgres-workflow.e2e-spec.ts`) dựng Auth+Course+Enrollment+Gateway in-process với Postgres/Redis thật — 5 kịch bản: (1) login → enroll qua Gateway thành công + assert trace W3C xuyên Gateway/Enrollment/Course và span `enrollment-postgres`/`enrollment-course`; (2) thiếu JWT/role sai → 401/403; (3) enroll trùng → 409; (4) Course unavailable nhìn từ Enrollment (kết nối bị từ chối thật, không mock) → Gateway trả 503 `DEPENDENCY_UNAVAILABLE`; (5) Course timeout nhìn từ Enrollment (HTTP server thật cố ý không phản hồi) → Gateway trả 504 `DEPENDENCY_TIMEOUT`.
- **Root scripts**: `test:enrollment:postgres`, `test:w3:postgres` mới; `build`/`lint`/`test`/`test:telemetry` đã bao gồm Enrollment.
- **CI**: job `quality` chạy thêm `test:enrollment:postgres` và `test:w3:postgres`; job compose smoke đổi tên `w2-compose` → `w3-compose`, thêm bước gọi `POST /api/v1/enrollments` qua Gateway.
- **Verify thủ công bằng `docker compose up` thật** (không chỉ jest in-process): build toàn bộ image, tất cả service `Healthy`, gọi `curl` thật qua Gateway — login → browse course (200) → enroll (201) → enroll trùng (409) → course không tồn tại (404) → `/enrollments/check` qua Gateway không được route (404, đúng ý đồ thiết kế, log Gateway xác nhận chỉ map `{/api/v1/enrollments, ALL}` không có wildcard con).
- Mở PR [#27](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/27) từ `test/week-07/task-03-verify-enrollment-workflow` vào nhánh task-02 (xếp chồng trên #26, #25), cập nhật card task và `weekly-overview.md` sang `Chờ review`.
- Phát hiện ngoài phạm vi (không sửa trong task này): Gateway `HttpExceptionFilter` thiếu mapping status 404 → code `NOT_FOUND` (trả về `INTERNAL_ERROR` thay vì `NOT_FOUND` cho route không khớp) — lỗi có sẵn từ Week 6, không liên quan Enrollment; đã tạo task riêng qua `spawn_task` để xử lý sau.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| E2E login → enroll và telemetry assertions | Code | [lms/test/w3-postgres-workflow.e2e-spec.ts](../../../../../lms/test/w3-postgres-workflow.e2e-spec.ts) |
| Gateway routing cho Enrollment | Code | [lms/services/gateway/src/adapters/http/gateway/gateway.controller.ts](../../../../../lms/services/gateway/src/adapters/http/gateway/gateway.controller.ts) |
| Compose/CI cập nhật | Code / Docs | [docker-compose/compose.yaml](../../../../../docker-compose/compose.yaml), [.github/workflows/ci.yml](../../../../../.github/workflows/ci.yml) |
| Pull request | Code | [PR #27](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/27) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, Enrollment, PostgreSQL không cần bước ngầm | Đạt | `docker compose --env-file docker-compose/.env.example -f docker-compose/compose.yaml up --build -d --wait` — tất cả service `Healthy` từ volume rỗng, xác nhận thủ công trên sandbox (port override do máy có container khác chiếm cổng mặc định, không phải vấn đề của compose.yaml). |
| E2E login qua Gateway nhận JWT rồi dùng token tạo enrollment cho seeded course qua Gateway; role hợp lệ/không hợp lệ được kiểm tra | Đạt | `w3-postgres-workflow.e2e-spec.ts` test 1–2 (5/5 pass); xác nhận thêm bằng `curl` thật qua compose. |
| E2E bao phủ ít nhất một Course dependency unavailable/timeout behavior nhìn từ phía Enrollment, với error envelope canonical | Đạt | `w3-postgres-workflow.e2e-spec.ts` test 4–5: kết nối bị từ chối → 503 `DEPENDENCY_UNAVAILABLE`; server treo → 504 `DEPENDENCY_TIMEOUT`. |
| Trace `login → enroll` giữ W3C context qua Gateway và downstream; HTTP server/client cùng `enrollment-postgres` signals có assertions phù hợp | Đạt | Test 1 assert span SERVER `enrollments`/`courses` và span CLIENT `enrollment-postgres`/`enrollment-course` cùng `trace_id`, dùng `InMemorySpanExporter`. |
| CI chạy test cần thiết thành công; kết quả/giới hạn được ghi trong PR hoặc output task | Đạt (cục bộ; GitHub Actions chờ xác nhận qua PR) | Chạy đầy đủ chuỗi lệnh CI `quality` job (`test:w1:postgres && test:course:postgres && test:enrollment:postgres && test:w2:postgres && test:w3:postgres && ci:verify`) với Postgres/Redis thật trong container cục bộ — tất cả pass. |
| URL/số PR và `Chờ review` đã commit/push vào PR head trước review | Đạt | Commit cập nhật card/weekly-overview/output nằm trên chính nhánh `test/week-07/task-03-verify-enrollment-workflow`, đã push lên PR #27. |
| PR có mô tả đúng template, `APPROVED` từ Bách, completion metadata trước merge | Chưa đạt | Đang chờ Bách chạy độc lập và review PR #27 (và #25/#26 vì xếp chồng); finalization thực hiện riêng sau khi có `APPROVED`. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có thay đổi phạm vi; toàn bộ DoD input giữ nguyên.
- Việc chưa hoàn thành hoặc trở ngại: Chờ Bách chạy độc lập luồng `login → enroll` và review; GitHub Actions CI cho cả 3 PR (#25/#26/#27) cần xác nhận xanh; `tools/sync-plan-json-and-timeline.ps1` không chạy được (thiếu `pwsh`), timeline đang chờ đồng bộ.
- Bước tiếp theo: Sau khi PR #25/#26/#27 có `APPROVED`, Đức dùng `task-completion-recording` để finalization từng task theo đúng thứ tự (task-01 → task-02 → task-03) trước khi merge tuần tự vào `main`; sau đó track Submission (task-04/05/06, Bách phụ trách) mới đủ điều kiện bắt đầu vì phụ thuộc Enrollment đã merge. Gateway 404-code-mapping gap đã ghi nhận qua `spawn_task` riêng, không nằm trong phạm vi task này.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
