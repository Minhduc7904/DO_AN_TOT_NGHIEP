# Đợt tái cấu trúc: từ testbed v1 sang testbed v2

> **File này giải thích gì:** trước đợt refactor hệ thống thử nghiệm (testbed) có gì, vì sao phải làm lại, Đức đã đổi gì và bỏ gì, Bách thu gọn phạm vi ra sao bằng ADR-006, tên cũ ứng với tên mới thế nào, phần thiết kế AI ban đầu còn giữ được bao nhiêu, và cổng nghiệm thu **Gate R** đang ở đâu. Viết cho người chưa theo sát đợt refactor.
>
> **Nguồn gốc (canonical):**
>
> - Quyết định: [`../adr/adr-001-restructure-lms-testbed-v1.md`](../adr/adr-001-restructure-lms-testbed-v1.md) → [`../adr/adr-006-trim-project-scope-v1.md`](../adr/adr-006-trim-project-scope-v1.md) (6 file ADR trong [`../adr/`](../adr/))
> - Kế hoạch: [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) (hiện hành; giai đoạn 4 và Gate R giữ nguyên từ v0.3, mục 9 nén lịch), [`../plan/plan-v0.3-24-weeks.md`](../plan/plan-v0.3-24-weeks.md) (mục 0, 4; lịch sử), [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md) (lịch sử)
> - Bảng task: [`../plan/refactor/refactor-board-v1.md`](../plan/refactor/refactor-board-v1.md)
> - Testbed v1 (lịch sử): [`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md), [`../architecture/data-ownership-and-fault-matrix-v1.md`](../architecture/data-ownership-and-fault-matrix-v1.md), các file tuần cũ [`../weekly-explanations/week-06_2026-09-06_to_2026-09-12.md`](../weekly-explanations/week-06_2026-09-06_to_2026-09-12.md) → [`week-09`](../weekly-explanations/week-09_2026-09-27_to_2026-10-03.md)
> - Testbed v2: [`../architecture/service-catalogue-and-topology-v2.md`](../architecture/service-catalogue-and-topology-v2.md) (mục 12), [`../architecture/data-ownership-and-fault-matrix-v2.md`](../architecture/data-ownership-and-fault-matrix-v2.md) (mục 7)
> - Thiết kế AI: [`../architecture/analysis-anomaly-rca-blueprint.md`](../architecture/analysis-anomaly-rca-blueprint.md) (v0, lịch sử), [`../architecture/analysis-anomaly-rca-blueprint-v1.md`](../architecture/analysis-anomaly-rca-blueprint-v1.md) (mục 12, 27, 30)
> - Bằng chứng Gate R: mô tả PR #73 trên GitHub (merge 17/11/2026), commit `f6372ff` và `047050f`
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge)

Khái niệm nền (service, worker, gateway, queue, outbox/inbox, token, JWKS, service token, MinIO, Mailpit, telemetry) đã giải thích ở [khái niệm nền](02-basic-concepts.md). File này chỉ nhắc ngắn.

---

## 0. Đọc nhanh trong một phút

**Ý chính:** testbed v1 chạy được nhưng "quá dễ đoán bệnh". Lỗi ở đâu thì triệu chứng hiện ngay ở đó, nên không chứng minh được AI giúp gì hơn người đọc trace. Đức dựng lại thành testbed v2 có chuỗi việc bất đồng bộ dài, dependency dùng chung và lỗi lộ ra muộn. Sau đó Bách cắt bớt phạm vi (ADR-006) để kịp làm phần AI.

Hình dung như **dựng đề thi cho thám tử**. Ở v1, mọi "vụ án" đều có hung thủ đứng ngay hiện trường: thám tử nào cũng bắt được. Muốn biết thám tử AI giỏi hơn người, phải có vụ án mà hung thủ ở phòng khác, gây án qua đường ống chung, và nạn nhân mấy phút sau mới ngã.

```text
Tuần 1–10   (02/08 → 10/10/2026)  Testbed v1 + observability. Báo cáo giữa kỳ sau tuần 10.
Tuần 13–14  (27/10 → 09/11/2026)  Đức refactor một mình: ADR-001 → ADR-005, task R-01 → R-13,
                                   PR #70, PR #71.
03/11/2026                         R-18 slice 1 (URL ký cho media), merge qua PR #72.
Tuần 16     (17/11/2026)           Bách: ADR-006, plan v0.3, revert R-18, sửa 2 lỗi telemetry.
                                   Tất cả vào main qua PR #73.
                                   PR #74 sửa các chỗ tài liệu lệch code (đã merge).
                                   Làm việc tuần 13 của plan: PR #75–#79 (chưa merge).
                                   ADR-007 + plan v0.4 (workload bán thực, bằng chứng E1–E8).
```

Lưu ý ký hiệu: bảng refactor viết "W13–W14" nghĩa là **tuần** 13–14. Còn W1–W7 trong testbed là **workflow** (luồng nghiệp vụ). Hai thứ khác nhau.

---

## 1. Testbed v1 trước refactor

**Ý chính:** trước refactor có 6 service nghiệp vụ + 1 gateway, một PostgreSQL, Redis, RabbitMQ với đúng một sự kiện, và một kho lưu file giả (Storage Mock). Năm kịch bản lỗi F1–F5.

### 1.1. Các thành phần (trước refactor)

```text
Gateway
├── Auth ──────────> PostgreSQL: auth_db
├── Course ──> Redis
│          └─> PostgreSQL: course_db
├── Enrollment ──> Course
│              └─> PostgreSQL: enrollment_db
├── Submission ──> Course
│              ├─> Enrollment
│              ├─> Storage Mock
│              └─> PostgreSQL: submission_db
└── Grading ──> Submission
            ├─> PostgreSQL: grading_db
            └─> RabbitMQ ──(grade.completed)──> Notification
```

- 6 service nghiệp vụ + `gateway` + Storage Mock = **8 runtime**; **5 logical DB**; Redis làm cache cho `course`.
- Storage Mock là container riêng giả làm kho file, lưu trong bộ nhớ, chỉnh được độ trễ/lỗi.
- **Một chuỗi bất đồng bộ duy nhất:** `grading` phát `grade.completed`, `notification` nhận rồi chỉ ghi log.
- Gateway tự kiểm JWT tại chỗ; thiết kế v1 ghi rõ `auth` **không** phải dependency dùng chung của mọi API sau đăng nhập. Điều này sẽ đổi hẳn ở v2.
- Code: SQL viết tay bằng `pg`, bảng tạo bằng `CREATE TABLE IF NOT EXISTS`, mỗi service dồn logic vào một lớp (ADR-001).

Năm workflow v1 (trước refactor): W1 đăng nhập, W2 xem khóa học, W3 ghi danh, W4 nộp bài (qua Storage Mock), W5 chấm điểm và thông báo (qua RabbitMQ).

### 1.2. Năm kịch bản lỗi F1–F5 (trước refactor)

| Fault | Gây lỗi gì | Service gốc | Lỗi lan thế nào |
| --- | --- | --- | --- |
| F1 | Redis của Course chậm | `course` | Redis → `course` → `gateway` |
| F2 | Storage Mock chậm | `submission` | storage → `submission` → `gateway` |
| F3 | Submission tự trả lỗi | `submission` | `submission` → `gateway` |
| F4 | Consumer của Notification chậm, hàng đợi dồn | `notification` | `grading` → RabbitMQ → `notification` |
| F5 | Submission bị ép CPU | `submission` | `submission` → `gateway` |

Nguồn: [`data-ownership-and-fault-matrix-v1`](../architecture/data-ownership-and-fault-matrix-v1.md) mục 6. Cách giải thích chi tiết từng service v1 nằm ở các file tuần 6–9 trong [`../weekly-explanations/`](../weekly-explanations/).

---

## 2. Vì sao v1 chưa đủ

**Ý chính:** giảng viên đòi hai điều mà v1 không đáp ứng được. Rà lại v1 thì thấy ba thiếu sót làm mọi lỗi đều dễ đoán.

### 2.1. Hai yêu cầu sau báo cáo giữa kỳ (plan v0.3, mục 0)

1. **Chứng minh dùng ML/AI giúp chẩn đoán nhanh hơn hoặc hiệu quả hơn truy vết thủ công**, vì người đọc trace thủ công vẫn có thể tìm ra nguyên nhân.
2. **Traffic giả lập phải giống người dùng thật**, không chỉ k6 bắn request. Ba mức gợi ý: mức 1 chuỗi request, mức 2 mô phỏng hành vi, mức 3 AI agent đóng vai người dùng. Chi tiết ở [case và workload](09-cases-and-workload.md).

### 2.2. Ba thiếu sót của v1

| Thiếu sót | Hệ quả cho bài toán tìm nguyên nhân |
| --- | --- |
| Chỉ một chuỗi bất đồng bộ (`grade.completed`) | Gần như mọi lỗi nằm trên đường đi của chính request bị lỗi |
| Storage là mock | Không có hành vi thật của kho file (copy, xóa, thumbnail) để lỗi lan đi |
| Không có dependency dùng chung | Một nguyên nhân không thể tạo nhiều triệu chứng ở nhiều nơi cùng lúc |

Ví dụ F2: Storage chậm thì trace của request nộp bài có ngay một chặng `submission → storage` dài bất thường. Người mở trace thấy liền. AI có đúng cũng không chứng minh được gì thêm.

### 2.3. Tiêu chí thiết kế testbed v2 (plan v0.3, giai đoạn 4)

1. Có chuỗi bất đồng bộ nhiều bước (HTTP → command → worker → HTTP), để nguyên nhân và triệu chứng ở hai service khác nhau.
2. Có dependency dùng chung (xác thực, database, broker), để một nguyên nhân gây nhiều triệu chứng.
3. Có cơ chế làm lỗi lộ ra muộn (cache token, lease, quét định kỳ), để triệu chứng cách nguyên nhân về thời gian.
4. Telemetry phủ mọi cạnh; trace nối được qua RabbitMQ.
5. Không thêm tính năng nào không tạo ra ít nhất một điều kiện trên.

---

## 3. Những gì Đức đã làm

**Ý chính:** năm quyết định kiến trúc (ADR-001 → ADR-005), 15 task hoàn thành trên bảng refactor (R-01 → R-13, cộng R-04b, R-05b), hai PR bổ sung (#70, #71) và một task dở (R-18) sau này bị hủy. Theo bảng refactor, Đức làm một mình cả code lẫn tài liệu, không cần Bách review.

### 3.1. Năm quyết định, kể bằng lời đời thường

| ADR | Ngày | Nói gọn | Hiện còn hiệu lực? |
| --- | --- | --- | --- |
| [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md) | 27/10 | Đập đi xây lại bằng bộ service mới | Có (quyết định 1 và 5 đã được ADR-005 sửa) |
| [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) | 27/10 | AI là bên truy vết chính, tự kết luận | Một phần: quyết định 1, 2, 3 bị ADR-006 thay |
| [ADR-003](../adr/adr-003-remove-admin-service-v1.md) | 27/10 | Bỏ service `admin` | Có |
| [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md) | 28/10 | Thẻ ra vào giữa các service, tách hai mặt API | Có (tên service phát token đổi thành `identity`) |
| [ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md) | 30/10 | Gộp `auth` + `student` thành `identity` | Có |

**ADR-001 — xây lại.** Bỏ `enrollment`, `submission`, `grading`, Storage Mock, Redis. Ghi danh, tiến độ, làm quiz vào `course`; file lưu ở MinIO thật qua `media`; thêm `notification` gửi email thật, `scheduler` chạy job theo lịch, `ai` làm cổng gọi LLM. Prisma + PostgreSQL 17, mỗi service một database; việc bất đồng bộ là command qua RabbitMQ có outbox/inbox; observability tách sang `aiops-platform/`.

**ADR-002 — AI làm thám tử chính.** Hệ thống AI (gọi là **RCA engine**, khác service `ai` của LMS) tự phát hiện, tự xếp hạng và **tự kết luận không cần người**; thêm MCP/agent, đối chứng thủ công, thử nghiệm người thật và danh mục "case phức tạp". Phần lớn ý này về sau bị ADR-006 hạ xuống (mục 4).

**ADR-003 — bỏ `admin`.** Service này không có database, không có nghiệp vụ. Admin giờ chỉ là tài khoản có role `admin`.

**ADR-004 — thẻ ra vào và hai cửa.** Trước đó các service tin nhau vì "cùng mạng nội bộ". ADR-004 đổi thành:

- Hai mặt API: `/api/v1` (công khai, chỉ gateway gọi) và `/internal/v1` (giữa các service, không bao giờ đi qua gateway).
- Service muốn gọi service khác phải xin **service token** (thẻ nhân viên) từ service xác thực. Token ký bằng EdDSA, ai cũng kiểm được chữ ký bằng khóa công khai lấy từ JWKS.
- **Mọi request vào service đều cần service token, kể cả route công khai** (phương án "P1").
- Token sống 10 phút, được làm mới chủ động khi qua nửa đời. Nếu lấy token mới bị lỗi thì tạm dùng token cũ còn hạn ("stale-while-error").

Vì sao quan trọng cho RCA: dịch vụ xác thực trở thành **dependency dùng chung của mọi service**, và lỗi của nó lộ ra **muộn** (đợi token cũ hết hạn). Đây chính là nguồn của case C6 và C7. Thiết kế v1 cố ý tránh điều này; v2 cố ý tạo ra nó.

**ADR-005 — gộp `auth` + `student` thành `identity`.** Hai service gần như trùng dữ liệu; tách đôi buộc đăng ký ghi vào hai database và dễ lệch. Gộp lại thì đăng ký chỉ còn một transaction. Hệ quả:

- 12 → 11 runtime, 7 → 6 logical DB, candidate set của RCA 11 → 10.
- Mất chuỗi `gateway → auth → student` trong luồng đăng ký.
- Ba case C5, C6, C7 cùng có nguyên nhân gốc là `identity`. Một bảng xếp hạng cố định (luôn đặt `identity` đầu) đã đúng Top-3 ở 5/7 case, khoảng 71%.

### 3.2. Task R-01 → R-13, gom theo nhóm

| Nhóm | Task | Làm gì | PR |
| --- | --- | --- | --- |
| Nền móng | R-01 | ADR, bộ tài liệu kiến trúc v2, chốt `service.name` | #51 (theo git) |
| | R-02 | Tách observability sang `aiops-platform/observability/`, network `aiops-net` | #52 |
| | R-03 | `packages/common`, khung service mẫu, luật ranh giới ESLint, Compose v2 (PostgreSQL, RabbitMQ, MinIO, Mailpit), Prisma | #53 |
| Cửa vào và danh tính | R-04 | `auth` (3 role, 3 cửa đăng nhập), `student`, `gateway` | #53, #54, #57, #58 |
| | R-04b | DTO dùng chung, khung phản hồi thống nhất, phân trang | #55 |
| | R-05b | Hai mặt API, user token và service token (ADR-004) | #61 (theo git) |
| Service nghiệp vụ | R-05 | `course` v2: khóa học, bài học, quiz, ghi danh, tiến độ, làm bài, export CSV | #61 (theo git) |
| | R-06 | `media` + `media-worker`: upload thẳng MinIO, thumbnail, usage | #62 |
| | R-07 | `notification` + worker: gửi đơn, gửi hàng loạt, email thật, hộp thư | #63 |
| | R-08 | `ai` + worker và luồng AI trong `course` | #65 |
| | R-09 | `scheduler` + worker: job dọn media không dùng | #64 |
| Dữ liệu và kiểm chứng | R-10 | Seeder dữ liệu lớn | #66 |
| | R-11 | Regression 7 luồng, Postman v2, viết lại CI | #67 |
| | R-12 | Viết lại 5 smoke observability, viết lại tài liệu, danh mục case C1–C7 | #68 |
| | R-13 | Gộp `identity` (ADR-005) | #69 |

Vài con số thật trên bảng: R-10 nạp 5.057.612 dòng trong 156,1 giây (profile `large`); R-11 regression 46/46, Postman 90 request, 223 assertion; R-12 có 9/9 luồng trace đủ service và sửa lỗi trace bất đồng bộ bị đứt; R-13 đo lại 38 cặp (service, dependency), 24 queue, C6 lỗi sau 70–74 giây.

Cần biết khi đọc bảng:

- Nhiều task R-03 → R-10 ghi "bỏ qua CI theo chỉ thị của Đức", chỉ có bằng chứng chạy cục bộ. Từ R-11 CI GitHub mới chạy thật.
- Cột "theo git" lấy từ lịch sử merge: bảng ghi R-05, R-05b "chưa có PR" (chưa cập nhật), còn git có PR #61 từ nhánh `task-05-course`.
- Bảng không có dòng R-14 → R-17, nhưng R-18 ghi phụ thuộc "R-16, R-17". Theo tên nhánh git, task-16 là PR #71 và task-17 là PR #70 (suy luận, bảng không ghi).

### 3.3. Hai PR sau bảng

- **PR #70 (30/10):** tách chi tiết khóa học khỏi danh sách bài học. `GET /courses/{id}` chỉ trả thông tin khóa học kèm trạng thái ghi danh; thêm `GET /courses/{id}/lessons` (học viên phải đã ghi danh).
- **PR #71 (30/10):** `media` tự nhận diện loại file (MIME) bằng cách đọc 64 KiB đầu, không tin loại file client khai báo; thêm avatar cho mọi role và trường `avatar_url`.

ADR-006 giữ cả hai vì đã xong, có test, gỡ ra tốn công hơn giữ, dù chúng ít giá trị cho RCA.

### 3.4. R-18: URL ký cho media, đã hủy

R-18 muốn ảnh riêng tư chỉ xem được qua link có chữ ký và hạn dùng (như vé xem phim có giờ). Slice 1 (commit `a1ea944`, PR #72, 03/11) mới làm phía `media`; `course` và `notification` chưa dựng link ký, nên **ảnh trong markdown bài học, quiz, thông báo trả `404`**. ADR-006 hủy R-18 và revert: tính năng bảo mật không tạo đường lan lỗi cho RCA, đang làm hỏng chức năng có sẵn. Media quay về đọc bằng UUID khó đoán; code đặt `Cache-Control: public, max-age=300` (trình duyệt được giữ 5 phút). Bản đầu ADR-006 ghi nhầm `no-store`, đã đính chính ở PR #74.

---

## 4. Bách thu gọn phạm vi bằng ADR-006

**Ý chính:** đến tuần 16, LMS đã dựng xong nhưng phần AI/RCA chưa có dòng code nào, trong khi phạm vi vẫn phình thêm. ADR-006 cắt bớt như người cắt hành lý trước chuyến đi: giữ cái cần để tới đích, bỏ cái "có thì hay".

### 4.1. Bối cảnh (ADR-006, mục "Bối cảnh")

- Chưa có fault injector, workload k6, dataset, RCA engine; theo plan v0.2, tuần 16 lẽ ra đã có graph động và RCA baseline. Mô tả PR #73 ước tính phần AI/RCA trễ khoảng 6 tuần.
- Phạm vi tăng hai phía: LMS thêm tính năng không tạo đường lan lỗi (R-18); tài liệu v2 đưa thêm vào MVP MCP/agent, ranker học có giám sát, thử nghiệm người thật, bảy case (chỉ C6 đã chạy thật).
- Ba điểm lệch: (1) đề tài đăng ký là "**hỗ trợ** phân tích nguyên nhân", ADR-002 đổi thành "AI tự kết luận"; (2) phương pháp lõi là detector không giám sát và điểm tuyến tính, evaluation-protocol-v1 còn cấm huấn luyện bằng run có lỗi, nên nói "phần chính là huấn luyện mô hình" không khớp; (3) `base-manual-auto` bị cấm nhìn ra ngoài đường request, như so với đối thủ bị bịt mắt đúng chỗ case khai thác, hội đồng dễ bác.

### 4.2. Các quyết định và lý do

| Nhóm | Quyết định | Lý do |
| --- | --- | --- |
| Đóng băng LMS | Không thêm nghiệp vụ. Chỉ nhận thay đổi phục vụ telemetry, fault, workload (ví dụ metric pool PostgreSQL, LLM stub chỉnh được độ trễ, proxy chèn trễ) | Dồn sức cho phần AI đang trễ |
| | Hủy R-18, revert slice 1 | Tính năng bảo mật, không phục vụ RCA, đang gây `404` |
| | Giữ phần đã xong: ba cửa đăng nhập, CRUD provider/model của `ai`, avatar, tách chi tiết khóa học, seeder, export CSV | Gỡ ra tốn công và rủi ro hơn giữ; báo cáo không cần mô tả |
| Vai trò RCA engine | **Hỗ trợ** người vận hành: tự phát hiện incident, tự xếp hạng ứng viên kèm bằng chứng; bỏ "kết luận không cần người" | Khớp tên đề tài đã đăng ký |
| | Phần học máy: detector không giám sát fit trên run khỏe (Isolation Forest, thống kê bền vững), trọng số và ngưỡng chỉnh trên validation | Mô tả đúng cái thực sự làm |
| | Ranker học có giám sát ("Hướng 2") xuống **Stretch**; MVP dùng "Hướng 1" | Ít run có lỗi, không đủ dữ liệu học |
| Đối chứng thủ công (RQ6) | Chứng minh bằng **chi phí và độ ổn định**: độ chính xác Top-K, thời gian tới kết luận đúng, số artifact phải mở, kết quả khi nhiều triệu chứng cùng lúc và có nhiễu | Không dựa vào lập luận "người không tìm ra" |
| | `base-manual-auto` mô phỏng SRE thật: lấy trace lỗi/chậm nhất, đi theo span CLIENT lỗi hoặc chậm sâu nhất, được đi theo cạnh bất đồng bộ và xác thực | Đối thủ công bằng |
| | Thử nghiệm người thật xuống **Target** (2–3 người, minh họa định tính) | Tốn công, không phải điều kiện hoàn thành. ADR-007 giữ Target (E7) nhưng nhắm 6–10 người nếu tìm được |
| Bộ case | MVP: **C2 (viết lại), C3, C4, C6**. Target: C1, C5, C7 | Bốn nguyên nhân gốc ở bốn service khác nhau |
| | C2 viết lại: chèn trễ trên kết nối `course` → `course-postgres` | Cơ chế cũ "export CSV giữ kết nối" không khớp code |
| | `R = 5` mỗi case (1 validation + 4 test) = 20 run có lỗi | Ít case, nhiều lần lặp để thấy độ dao động |
| Ngoài phạm vi | MCP server và agent LLM | Không phải cốt lõi đề tài |
| | Ablation tách theo loại cạnh và cạnh tài nguyên dùng chung xuống Target; manifest chỉ giữ trường bắt buộc | Giảm khối lượng |

Chi tiết từng case và vì sao chọn bốn case này: [case và workload](09-cases-and-workload.md). Vai trò RCA engine và `base-manual-auto`: [thiết kế AI/RCA](08-ai-rca-design.md).

### 4.3. Phương án đã loại (ADR-006)

- **Gỡ CRUD provider/model của `ai` và gộp ba cửa đăng nhập:** phải sửa test, regression, Postman, seeder trong lúc AI đang trễ; lợi ích cho nghiên cứu gần bằng không.
- **Làm nốt R-18:** thêm endpoint, scope, script mà không tạo tín hiệu mới cho RCA.
- **Giữ bảy case với `R = 3`:** mỗi case chỉ còn 2 run test; ba case cùng `identity` làm xếp hạng cố định đạt Top-3 khoảng 71%.

---

## 5. Bảng đối chiếu tên cũ → tên mới

**Ý chính:** gần như mọi tên đều đổi. Khi đọc tài liệu cũ, tra bảng này để biết nó ứng với cái gì bây giờ.

### 5.1. Service

| v1 (trước refactor) | Trạng thái giữa chừng | v2 (hiện tại) |
| --- | --- | --- |
| `gateway` | — | `gateway` (chuyển tiếp stream, gắn service token) |
| `auth` | `auth` (R-04) | `identity` (R-13) |
| — | `student` (R-04) | `identity` (R-13) |
| — | `admin` (ADR-001) | bỏ (ADR-003) |
| `course` | — | `course` (thêm ghi danh, tiến độ, làm và chấm quiz) |
| `enrollment` | — | nhập vào `course` |
| `submission`, `grading` | — | bỏ (gỡ ở R-05); chấm quiz nằm trong `course` |
| `notification` (chỉ ghi log) | — | `notification` + `notification-worker` (email thật, hộp thư) |
| Storage Mock | — | MinIO thật, do `media` + `media-worker` dùng |
| Redis | — | bỏ |
| — | — | mới: `media`, `media-worker`, `scheduler`, `scheduler-worker`, `ai`, `ai-worker` |

Kết quả: **7 service + 4 worker = 11 `service.name`**. Candidate set của RCA là 10 (bỏ `gateway`, vì gateway là nơi thấy triệu chứng chứ không có fault nào gốc ở đó).

### 5.2. Database

| v1 | Giữa chừng (trước R-13) | v2 |
| --- | --- | --- |
| `auth_db`, `course_db`, `enrollment_db`, `submission_db`, `grading_db` (5 DB) | `auth_db`, `student_db`, `course_db`, `media_db`, `notification_db`, `scheduler_db`, `ai_db` (7 DB) | `identity_db`, `course_db`, `media_db`, `notification_db`, `scheduler_db`, `ai_db` (**6 DB**) |

### 5.3. Fault và case: F1–F5 → FA–FH → C1–C7

**Fault** là cơ chế gây lỗi (ví dụ "chèn trễ vào MinIO"); **case** là kịch bản + chuỗi nhân quả + đáp án dùng để chấm (project-scope-v2 mục 3.4; giải thích kỹ ở [case và workload](09-cases-and-workload.md)). Bảng dưới ghép theo **ý tưởng**. Đây là cách đọc của ghi chú này; tài liệu gốc không có bảng ánh xạ F → FA chính thức.

| v1 | Gần giống ở v2 | Case v2 | Mức (ADR-006) |
| --- | --- | --- | --- |
| F1 Redis chậm | không còn (Redis đã bỏ) | — | — |
| F2 Storage chậm | FA: MinIO chậm/ngắt | C4 | MVP |
| F3 Submission tự lỗi | không còn tương ứng | — | — |
| F4 Consumer chậm, queue dồn | FB: backlog hàng đợi của `notification-worker` | C1 | Target |
| F5 CPU | FF: quá tải tài nguyên | không có case riêng | — |
| — | FC: `course-postgres` (C2 viết lại thành chèn trễ) | C2 | MVP |
| — | FD: nhà cung cấp LLM chậm | C3 | MVP |
| — | FE: `identity-postgres` chậm khi lấy danh sách người nhận | C5 | Target |
| — | FG: `identity` chậm/chết | C6 | MVP |
| — | FH: đổi khóa ký mà không giữ khóa cũ | C7 | Target |

### 5.4. Cạnh, dependency, workflow

| Mục | v1 | v2 |
| --- | --- | --- |
| Cạnh trong sơ đồ thiết kế | `e01–e20` | `e01–e29`, bỏ `e03` và `e09` ở R-13 |
| Dependency identity | 9 (ví dụ `course-redis`, `submission-storage`) | 16 hạ tầng + cạnh HTTP `<caller>-<callee>` + cạnh xác thực `<caller>-identity-token`, `<caller>-identity-jwks` |
| Đo thật | — | 38 cặp (service, dependency), 24 queue (đo 30/10/2026) |
| Workflow | W1–W5 | W1–W7 |

**Cẩn thận:** W1–W5 của v1 và W1–W7 của v2 trùng ký hiệu nhưng **khác nội dung**. Ví dụ W4 v1 là "nộp bài", W4 v2 là "upload media". W1–W7 v2 được giải thích ở [hướng dẫn dựng stack và workflow](06-stack-and-workflows-guide.md).

### 5.5. Tài liệu v1 → v2

Quy ước của R-12: viết bản mới, giữ bản cũ kèm dòng "Đã được thay thế".

| Bản cũ (lịch sử) | Bản hiện hành |
| --- | --- |
| `backend_microservice_testbed_blueprint` | `backend-microservice-testbed-blueprint-v2` |
| `service-catalogue-and-topology-v1`, `http-and-event-contracts-v1`, `data-ownership-and-fault-matrix-v1`, `dependency-resilience-policy-v1`, `project-scope-v1`, `research-questions-and-metrics-v1` | cùng tên, đuôi `-v2` |
| `telemetry-and-ground-truth-schema-v0`, `evaluation-protocol-v0` | cùng tên, đuôi `-v1` |
| `analysis-anomaly-rca-blueprint`, `khung_dinh_huong_tong_the_lms_microservice_ai_rca` | `analysis-anomaly-rca-blueprint-v1`, `khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1` |
| `plan-v0.2-24-weeks` | `plan-v0.3-24-weeks`, nay thay tiếp bằng `plan-v0.4-24-weeks` (17/11/2026, ADR-007) |
| `literature-matrix-v0` | `literature-matrix-v1` (đang viết cùng task-06 tuần 13) |
| — | mới: `adr-001…adr-007`, `refactor-board-v1`, `complex-case-catalogue-and-rca-result-v0`; tuần 13: `workload-design-v1`, `telemetry-data-dictionary-v2` (PR #78, #79, chưa merge) |

---

## 6. Thiết kế phần model ban đầu còn giữ được bao nhiêu

**Ý chính:** "luật chơi" của phần AI giữ gần nguyên; thứ phải làm lại là mọi chỗ gắn với sân cũ (tên service, cạnh, fault, metric). Vai trò AI đi một vòng: hỗ trợ (v0) → tự kết luận (v1, ADR-002) → **quay về hỗ trợ** (ADR-006).

Giống đổi sân thi đấu: luật bóng đá không đổi, nhưng phải đo lại sân, kẻ lại vạch, xếp lại vị trí.

```text
Blueprint v0 (tuần 4–10)        Blueprint v1 (R-12, ADR-002)          Sau ADR-006 (17/11)
AI hỗ trợ, trả Top-K      ──>   AI là bên truy vết chính,       ──>   AI hỗ trợ người vận hành,
cho người đọc                    tự kết luận; Hướng 1 + Hướng 2        MVP dùng Hướng 1; Hướng 2 là Stretch
```

| Loại | Nội dung | Nguồn |
| --- | --- | --- |
| **Giữ nguyên ý nghĩa** | Chia dữ liệu theo run (không trộn cửa sổ của cùng một run vào hai tập); detector chỉ fit trên run khỏe; xử lý dữ liệu thiếu có chủ đích; các detector baseline (ngưỡng cố định, z-score, z-score bền vững, Isolation Forest) và cách gộp nhiều nguồn; vòng đời incident; năm thành phần điểm A/T/P/E/V; yêu cầu chạy lại ra cùng kết quả; ablation theo nguồn dữ liệu/thời gian/bằng chứng; robustness MVP; danh sách bài báo tham khảo | blueprint-v1 mục 30 |
| **Giữ cả con số** | Công thức điểm tuyến tính "Hướng 1" với trọng số khởi điểm `0.30 / 0.20 / 0.20 / 0.20 / 0.10` (chưa kiểm chứng trên v2, phải chỉnh trên validation) | blueprint v0 dòng 982–986, blueprint-v1 mục 12.4 |
| **Phải làm lại** | Candidate set (6 service v1 → 10 service/worker); graph (ví dụ 5 cạnh → bốn loại cạnh: đồng bộ, bất đồng bộ, dependency, tài nguyên dùng chung, cộng cạnh xác thực); metric đầu vào (bỏ metric v1 chưa có như `redis_latency`, dùng metric có thật `http_server_*`, `lms_dependency_*`, `process_*`, `rabbitmq_detailed_queue_*`); kịch bản F1–F5 → case C2/C3/C4/C6; số run tối thiểu `5 × 3 = 15` → `4 × 5 = 20` | blueprint-v1 mục 30, ADR-006 |
| **Thêm mới** | Đối chứng thủ công `base-manual-auto` và RQ6; đo thời gian chẩn đoán; đặc trưng "service im lặng" (không còn phát telemetry); đặc trưng queue và độ trễ từ lúc phát command tới lúc worker nhận; verdict `insufficient_evidence` (không đủ chứng cứ thì không ép ra đáp án); schema đầu ra `RcaIncidentResult` | blueprint-v1 mục 12, 14; catalogue mục 5 |
| **Bị hạ hoặc bỏ** | "Kết luận không cần người" (bỏ); ranker học có giám sát (Stretch); MCP/agent (ngoài phạm vi); cạnh tài nguyên dùng chung và ablation theo loại cạnh (Target) | ADR-006 |

Nhận xét: sau ADR-006, phần AI gần với thiết kế v0 hơn là với ADR-002. Cái thực sự mới so với v0 là **đối chứng thủ công** và **case có nguyên nhân ở xa triệu chứng**. Chi tiết: [thiết kế AI/RCA](08-ai-rca-design.md).

---

## 7. Kế hoạch tuần 11–12 trong plan v0.3 và Gate R

**Ý chính:** plan v0.3 gói toàn bộ đợt refactor vào "tuần 11–12", kết thúc bằng **Gate R**: cổng cứng, chưa qua thì không làm việc của tuần 13 trở đi. Tại 17/11/2026, 5/6 điều kiện đã đạt, còn điều kiện 5 (Bách tự dựng stack).

### 7.1. Tuần 11–12 trong plan và cách đọc số tuần

- **Tuần 11:** chốt ADR-001 → 004 và tài liệu v2 trước khi code; tách observability; nền tảng chung, `gateway`, service xác thực, `course` v2. Phía B: đối chiếu ADR với thiết kế model ban đầu (mục 6).
- **Tuần 12:** các service bất đồng bộ cùng worker, seeder, regression/Postman/CI, smoke telemetry, ADR-005, sửa nhãn telemetry. Phía B: ADR-006, plan v0.3, rà tài liệu, nghiệm thu Gate R.

Plan v0.3 (giai đoạn 4) có bảng đối chiếu từng hạng mục với mã R-xx.

**Cách đọc số tuần.** Plan ghi "số tuần trong plan là thứ tự công việc" (mục 1). Theo lịch thật, refactor diễn ra tuần 13–14 (27/10 → 09/11/2026) và ADR-006 ra ngày 17/11 (tuần 16). Vậy "tuần 11–12" của plan là **giai đoạn**, không phải ngày tháng.

Tính nhẩm: tuần 13–23 của plan cần 11 tuần, trong khi plan v0.4 mục 1 ghi ngày 17/11/2026 chỉ còn 8 tuần lịch (tuần 17–24). Khi thiếu, plan v0.4 mục 9 cho **phương án nén lịch**, cắt theo thứ tự: bỏ Stretch và toàn bộ Target (E7 → E6 → biến thể case → C1/C5/C7) → gộp tuần 14 và 15 → giảm `R` từ 5 xuống 4 → gộp tuần 20 và 21 → bỏ C3 nếu LLM stub chưa ổn sau tuần 14 → dùng tuần 24. Plan chưa ghi bước nào đã được kích hoạt. Không được cắt: Gate R, ground truth, chia dữ liệu chống lộ đề, đối chứng với `base-manual-auto` và ít nhất một baseline đã công bố, kiểm chứng độ thực của workload, đăng ký trước. (Plan v0.3 có thứ tự cắt khác, nay chỉ còn là lịch sử.)

### 7.2. Sáu điều kiện của Gate R và trạng thái tại 17/11/2026

| # | Điều kiện (plan v0.3) | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| 1 | ADR-001 → 006 có hiệu lực; tài liệu v2 khớp nhau và khớp code: không còn tên `auth`/`student` cũ ngoài phần lịch sử, candidate set 10, 6 logical DB | **Đạt** | Commit `f6372ff` sửa tên service, số DB, candidate set còn lệch; banner ADR-006 trong tài liệu canonical |
| 2 | LMS đóng băng theo ADR-006, không còn tính năng dở trên `main` | **Đạt** | R-18 đã revert; PR #73 merge ngày 17/11/2026 |
| 3 | CI xanh; regression W1–W7, Postman v2, smoke tracing/metrics/logs đạt trên stack dựng từ volume sạch | **Đạt bằng kiểm tra chạy local** | GitHub Actions không chạy được vì tài khoản chủ repo bị khóa do vấn đề thanh toán. Thay bằng: chạy lại mọi job trong `.github/workflows/ci.yml` ở máy (commit `047050f`, cùng image và biến môi trường như CI); regression **52/52**; Postman 90 request, **226 assertion, 0 lỗi**; **5 smoke** observability đạt |
| 4 | Telemetry: 11/11 runtime có trace/metric/log; trace nối qua RabbitMQ; `operation_name` không chứa ID; lỗi publish RabbitMQ dùng identity `<service>-rabbitmq` | **Đạt** | Commit `047050f`: `HttpQueryClient` dùng route template (ví dụ `GET /internal/v1/students/:studentId` thay vì path có ID thật); lỗi publish mang `<service>-rabbitmq`, ghi lỗi gốc lên span và log `dependency.failure`; metrics smoke kiểm 186 tổ hợp `operation_name` không chứa ID |
| 5 | B (Bách) tự dựng stack từ máy sạch theo README và giải thích được W1–W7 (đồng thời đóng phần còn treo của Gate M2) | **Chưa đạt** (Bách làm sau) | Xem [hướng dẫn dựng stack và workflow](06-stack-and-workflows-guide.md); phải có bằng chứng trước khi đóng tuần 13 |
| 6 | Issue thuộc topology v1 (#44, #50) đã phân loại hoặc đóng; bảng refactor đã đóng | **Đạt** | Issue #44, #50 đóng 17/11/2026 (code v1 đã xóa ở R-05); bảng refactor ghi "Đóng (17/11/2026)" |

Ghi chú:

- **Điều kiện 3** đạt theo nghĩa thay thế: cùng các bước kiểm tra, chạy ở máy thay vì trên GitHub. Một test reset lỗi với pnpm 9.15.9 / Node 22.22.0 nhưng đạt 11/11 với phiên bản được ghim (Node 22.13.1, pnpm 11.19.0): khác biệt môi trường. Regression tăng từ 46/46 (R-11 → R-13) lên 52/52, Postman từ 223 lên 226 assertion; tài liệu không ghi test thêm đến từ PR nào (chưa kiểm chứng).
- **Điều kiện 1** đạt theo ba tiêu chí cụ thể (tên service, candidate set, số DB). Vẫn còn vài chỗ lệch nhỏ về fault/case, ví dụ component của FB là `notification-rabbitmq` ở [`service-catalogue-and-topology-v2`](../architecture/service-catalogue-and-topology-v2.md) mục 9 nhưng `notification-worker-rabbitmq` ở fault matrix v2 và catalogue case; mục 5–6 của fault matrix v2 vẫn mô tả C2 theo cơ chế export CSV cũ. Quy tắc "ADR-006 ưu tiên khi mâu thuẫn" bao các chỗ này.
- Ngày 17/11 còn phát hiện: container bị `docker pause` mất lô span cuối (khoảng 2 giây trước lúc pause), ảnh hưởng C6, xem [case và workload](09-cases-and-workload.md).

### 7.3. Sau Gate R

Gate R là cổng cứng: theo plan, không bắt đầu việc tuần 13 (workload, fault injector, export telemetry) khi chưa đạt, và không làm song song với phần refactor còn dở. Thực tế ngày 17/11/2026 Bách quyết định **bắt đầu tuần 13 theo ngoại lệ** khi Gate R đạt 5/6 (ghi ở [tổng quan tuần 13](../plan/weekly/week-13_2026-10-25_to_2026-10-31/weekly-overview.md)): điều kiện 5 chỉ kiểm chứng hiểu biết của người làm, không đổi testbed, và vẫn phải xong trước khi đóng tuần 13. Phần việc tuần 13 đã xong ở 5 PR #75–#79 (chưa merge), xem [tổng quan](01-project-overview.md) mục 5.5. Tiếp theo là tuần 14–15 của plan v0.4 (workload bán thực, fault manifest, dataset v0, mốc M3), mô tả ở [case và workload](09-cases-and-workload.md).

---

## Tóm tắt

- Testbed v1 (trước refactor) có 6 service + gateway, 5 DB, Redis, Storage Mock, một chuỗi bất đồng bộ `grade.completed` và năm fault F1–F5. Lỗi nào cũng hiện ngay trên đường request, nên không chứng minh được giá trị của AI.
- Sau giữa kỳ, giảng viên đòi chứng minh AI giúp chẩn đoán nhanh/hiệu quả hơn thủ công và đòi traffic giống người thật.
- Đức refactor một mình (27/10 → 09/11/2026): ADR-001 xây lại, ADR-002 AI tự kết luận, ADR-003 bỏ `admin`, ADR-004 service token + hai mặt API, ADR-005 gộp thành `identity`; task R-01 → R-13; PR #70, #71.
- Testbed v2: 7 service + 4 worker = 11 `service.name`, 6 DB, RabbitMQ chở command, MinIO, Mailpit, LLM provider; candidate set RCA là 10.
- ADR-004 làm `identity` thành dependency dùng chung có lỗi lộ muộn, nguồn của C6 và C7.
- ADR-006 (Bách, 17/11/2026): đóng băng LMS, hủy R-18, AI quay về vai "hỗ trợ", Hướng 2 xuống Stretch, MCP/agent ngoài phạm vi, case MVP C2 (viết lại)/C3/C4/C6 với `R = 5`, `base-manual-auto` mô phỏng SRE thật.
- Phần lớn "luật chơi" của thiết kế AI ban đầu giữ nguyên (chia theo run, detector fit trên run khỏe, điểm A/T/P/E/V với trọng số cũ); phải làm lại mọi chỗ gắn với topology.
- Gate R: đạt điều kiện 1, 2, 3 (bằng kiểm tra local vì GitHub Actions bị khóa), 4, 6; còn điều kiện 5 là Bách tự dựng stack và giải thích W1–W7 (làm sau; tuần 13 bắt đầu theo ngoại lệ).
- Theo lịch thật đã là tuần 16; còn 8 tuần lịch cho 11 tuần plan, nên có thể phải nén lịch theo plan v0.4 mục 9.

## Câu hỏi tự kiểm tra

1. Vì sao testbed v1 khó dùng để chứng minh AI giúp ích hơn truy vết thủ công?
   <details><summary>Đáp án</summary>Vì chỉ có một chuỗi bất đồng bộ, storage là mock và không có dependency dùng chung. Nguyên nhân gần như luôn nằm trên đường đi của request bị lỗi, nên người mở trace thấy ngay.</details>

2. ADR-004 tạo ra điều gì có ích cho bài toán RCA, dù nó là quyết định bảo mật?
   <details><summary>Đáp án</summary>Biến service xác thực (nay là `identity`) thành dependency dùng chung của mọi service, với lỗi lộ ra muộn vì token cũ còn dùng được tới khi hết hạn. Đây là nguồn của case C6 và C7.</details>

3. Gộp `auth` + `student` thành `identity` có mặt trái gì cho việc đánh giá?
   <details><summary>Đáp án</summary>Mất chuỗi `gateway → auth → student`, và ba case C5, C6, C7 cùng nguyên nhân gốc `identity`, nên một xếp hạng cố định đã đúng Top-3 khoảng 71% (5/7 case).</details>

4. Vì sao R-18 bị hủy?
   <details><summary>Đáp án</summary>Là tính năng bảo mật không tạo đường lan lỗi mới cho RCA, làm dở nên ảnh trong markdown bài học, quiz, thông báo trả `404`, và làm nốt tốn thêm endpoint, scope, script.</details>

5. ADR-006 đổi vai trò của RCA engine thế nào và vì sao?
   <details><summary>Đáp án</summary>Từ "tự kết luận không cần người" (ADR-002) về "hỗ trợ người vận hành": tự phát hiện và xếp hạng ứng viên kèm bằng chứng. Lý do: khớp tên đề tài đã đăng ký và khớp phương pháp thật (detector không giám sát, điểm tuyến tính).</details>

6. `base-manual-auto` mới khác bản cũ ở điểm nào?
   <details><summary>Đáp án</summary>Bản cũ bị cấm nhìn ra ngoài đường request, nên so sánh tự chứng minh. Bản mới mô phỏng SRE thật: đi theo span CLIENT lỗi/chậm sâu nhất và được đi theo cạnh bất đồng bộ và xác thực.</details>

7. Phần nào của thiết kế AI ban đầu được giữ cả con số?
   <details><summary>Đáp án</summary>Công thức điểm tuyến tính "Hướng 1" với trọng số khởi điểm 0.30 / 0.20 / 0.20 / 0.20 / 0.10, vẫn phải chỉnh lại trên validation.</details>

8. Điều kiện 3 của Gate R "đạt" theo nghĩa nào?
   <details><summary>Đáp án</summary>GitHub Actions không chạy được do tài khoản chủ repo bị khóa vì thanh toán. Nhóm chạy lại toàn bộ job CI ở máy, cộng regression 52/52, Postman 226 assertion 0 lỗi và 5 smoke observability trên stack sạch.</details>

9. Gate R còn thiếu gì, và vì sao tuần 13 vẫn được làm?
   <details><summary>Đáp án</summary>Còn điều kiện 5: Bách tự dựng stack từ máy sạch và giải thích W1–W7. Gate R là cổng cứng nên theo plan chưa đạt thì chưa bắt đầu tuần 13; Bách đã ghi một ngoại lệ có lý do (điều kiện 5 không đổi testbed, LMS đã đóng băng), và điều kiện 5 vẫn phải có bằng chứng trước khi đóng tuần 13.</details>
