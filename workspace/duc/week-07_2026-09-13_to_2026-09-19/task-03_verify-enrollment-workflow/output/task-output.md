# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-enrollment-workflow` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành theo ngoại lệ review |
| Bắt đầu thực tế | 22/09/2026 |
| Hoàn thành thực tế | 22/09/2026 12:20 ICT |
| Tổng thời lượng | ~1 phiên làm việc (22/09/2026), tiếp nối task-01/02 |
| Pull request | [#27](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/27) (xếp chồng trên #26, #25; cả hai đã merge vào `main`) |
| Người review | Đức tự review thay Bách (Bách không thể review, không chạy độc lập được) |
| Kết quả review | Đạt theo ngoại lệ workflow, xác nhận trực tiếp ngày 22/09/2026 bởi người phụ trách: Bách không thể review hay chạy độc lập nên Đức tự thực hiện review thay Bách (xem các phát hiện/sửa lỗi ở mục "Báo cáo công việc đã làm"); không có submission `APPROVED` trên GitHub và không có review độc lập từ Bách — đây là xác nhận của chính người phụ trách, không phải verdict GitHub. |

## Báo cáo công việc đã làm

- **Gateway**: thêm `GATEWAY_ENROLLMENT_BASE_URL` (config + env schema) và route `@All(['enrollments'])` — cố ý không dùng wildcard (khác route `courses`) để `GET /api/v1/enrollments/check` không bị forward qua Gateway, đúng ý contract §7.3 (internal service contract cho Submission). Đổi tên `requireCoursePrincipal` → `requireStudentOrInstructorPrincipal` vì logic dùng chung cho route `courses` và `enrollments`.
- **Compose**: thêm service `enrollment` (port 3003, healthcheck, `depends_on: postgres`), `gateway` thêm `depends_on: enrollment`; thêm `docker-compose/postgres-init/01-create-enrollment-database.sh` (tạo `enrollment_db` sở hữu bởi `POSTGRES_USER` sẵn có — đơn giản hơn script `auth_db` vì không cần role riêng); cập nhật `.env.example`.
- **E2E mới**: `lms/test/w3-postgres-workflow.e2e-spec.ts` (mẫu theo `w2-postgres-workflow.e2e-spec.ts`) dựng Auth+Course+Enrollment+Gateway in-process với Postgres/Redis thật — 5 kịch bản: (1) login → enroll qua Gateway thành công + assert trace W3C xuyên Gateway/Enrollment/Course và span `enrollment-postgres`/`enrollment-course`; (2) thiếu JWT/role sai → 401/403; (3) enroll trùng → 409; (4) Course unavailable nhìn từ Enrollment (kết nối bị từ chối thật, không mock) → Gateway trả 503 `DEPENDENCY_UNAVAILABLE`; (5) Course timeout nhìn từ Enrollment (HTTP server thật cố ý không phản hồi) → Gateway trả 504 `DEPENDENCY_TIMEOUT`.
- **Root scripts**: `test:enrollment:postgres`, `test:w3:postgres` mới; `build`/`lint`/`test`/`test:telemetry` đã bao gồm Enrollment.
- **CI**: job `quality` chạy thêm `test:enrollment:postgres` và `test:w3:postgres`; job compose smoke đổi tên `w2-compose` → `w3-compose`, thêm bước gọi `POST /api/v1/enrollments` qua Gateway.
- **Verify thủ công bằng `docker compose up` thật** (không chỉ jest in-process): build toàn bộ image, tất cả service `Healthy`, gọi `curl` thật qua Gateway — login → browse course (200) → enroll (201) → enroll trùng (409) → course không tồn tại (404) → `/enrollments/check` qua Gateway không được route (404, đúng ý đồ thiết kế, log Gateway xác nhận chỉ map `{/api/v1/enrollments, ALL}` không có wildcard con).
- Mở PR [#27](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/27) từ `test/week-07/task-03-verify-enrollment-workflow` vào nhánh task-02 (xếp chồng trên #26, #25), cập nhật card task và `weekly-overview.md` sang `Chờ review`.
- Tự review lại (self-review) sau khi chuyển `Chờ review`, phát hiện và sửa qua commit `317e863`: test 409 conflict phụ thuộc side-effect của test khác chạy trước trong cùng file (dễ vỡ nếu đổi thứ tự/chạy riêng lẻ) — sửa cho tự tạo enrollment trước khi kiểm tra conflict, không phụ thuộc thứ tự chạy.
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
| PR có mô tả đúng template, `APPROVED` từ Bách, completion metadata trước merge | Đạt theo ngoại lệ đã xác nhận | PR #27 dùng template; GitHub không có submission `APPROVED` vì Bách không thể review hay chạy độc lập. Đức tự thực hiện review thay Bách (commit fix `317e863`) và xác nhận trực tiếp ngày 22/09/2026 chấp nhận bỏ qua cổng GitHub `APPROVED`; completion metadata được commit/push trên PR head trước merge, sau khi PR #25/#26 đã merge vào `main`. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có thay đổi phạm vi; toàn bộ DoD input giữ nguyên.
- Việc chưa hoàn thành hoặc trở ngại: Bách không thể review hay chạy độc lập (theo xác nhận của người phụ trách ngày 22/09/2026) nên không có `APPROVED` GitHub — Đức tự thực hiện review thay Bách theo ngoại lệ đã xác nhận; `tools/sync-plan-json-and-timeline.ps1` không chạy được (thiếu `pwsh`), timeline đang chờ đồng bộ.
- Bước tiếp theo: Finalization theo ngoại lệ đã hoàn tất cho cả task-01/02/03 trong cùng phiên; người phụ trách (Đức) merge PR #27 vào `main` sau khi PR #25/#26 đã merge, sau đó track Submission (task-04/05/06, Bách phụ trách) đủ điều kiện bắt đầu. Gateway 404-code-mapping gap đã ghi nhận qua `spawn_task` riêng, không nằm trong phạm vi task này.

> Ngoại lệ workflow: GitHub không ghi nhận `APPROVED` vì Bách không thể review hay chạy độc lập. Người phụ trách (Đức) xác nhận trực tiếp ngày 22/09/2026 rằng Đức đã tự thực hiện review thay Bách cho cả 3 task (task-01/02/03) và chấp nhận bỏ qua cổng GitHub `APPROVED` để finalization. Không diễn giải ngoại lệ này thành GitHub approval hay review độc lập từ Bách. `Hoàn thành thực tế` là thời điểm work, DoD và finalization đã hoàn tất; không ghi merge time.
