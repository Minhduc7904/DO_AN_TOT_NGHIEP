# Giải thích đồ án, bản v2 (sau tái cấu trúc)

Folder này là **ghi chú cá nhân của Bách** để hiểu lại toàn bộ đề tài sau đợt tái cấu trúc testbed (tuần 11–12 theo plan) và chuẩn bị cho các việc tiếp theo: workload, case lỗi, RCA engine, bảo vệ. Mọi file viết bằng tiếng Việt, dễ hiểu, hạn chế thuật ngữ tiếng Anh nâng cao.

- Trước đây folder **không được Git theo dõi** (khai trong `.git/info/exclude`, giống folder cũ `weekly-explanations/`); từ đợt tài liệu task-06 tuần 13 folder được đưa vào repo, nên nội dung phải khớp code và tài liệu gốc.
- Đây là tài liệu **giải thích lại**, không phải tài liệu gốc. Khi cần con số hoặc quyết định chính xác, mở tài liệu gốc được dẫn ở đầu mỗi file. Thứ tự tin cậy: code + test thật > ADR-007 và ADR-006 > plan v0.4 > ADR-001→005 > tài liệu kiến trúc > ghi chú này (chi tiết ở [`11-reading-guide.md`](11-reading-guide.md) mục 1).
- Trạng thái của toàn bộ folder: **17/11/2026** (tuần 16 theo lịch). Đã merge vào `main`: PR #73 (ADR-006, plan v0.3, sửa telemetry) và PR #74 (sửa tài liệu lệch code). Tuần 13 của plan đã làm xong phần việc, nằm ở 5 PR **chưa merge** (#75–#79), cộng task-06 (tài liệu: ADR-007, plan v0.4, rà soát bộ ghi chú này).

## Có gì mới từ ngày 17/11/2026 (đọc trước nếu đã đọc bản cũ)

| Thay đổi | Ở đâu | Đọc giải thích ở |
| --- | --- | --- |
| **ADR-007**: workload bán thực (thêm mức 2+ phát lại phiên học viên thật từ log Moodle), kiểm chứng độ thực bằng hold-out, bộ bằng chứng E1–E8 cho câu hỏi "AI giúp gì", đăng ký trước ở tuần 19 | [`../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md`](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) | [`01`](01-project-overview.md) mục 5.6, [`07`](07-experiment-concepts.md) mục 11, [`08`](08-ai-rca-design.md) mục 7, [`09`](09-cases-and-workload.md) mục 4 |
| **Plan v0.4** thay plan v0.3: khung 24 tuần, Gate R, mốc M3–M6 giữ nguyên; đổi nội dung tuần 13–21 | [`../plan/plan-v0.4-24-weeks.md`](../plan/plan-v0.4-24-weeks.md) | [`01`](01-project-overview.md) mục 6 |
| **Tuần 13 đã làm** (PR #75–#79, chưa merge): proxy chèn trễ + LLM stub, k6 mức 1, export telemetry ra Parquet, data dictionary + kiểm chất lượng | `aiops-platform/faults/`, `load/`, `training/` trên nhánh PR | [`06`](06-stack-and-workflows-guide.md) phần J, [`05`](05-observability.md) mục 10, [`10`](10-naming-cheatsheet.md) mục 11 |
| **Phát hiện kỹ thuật tuần 13** (series "đứng yên" ~5 phút khi runtime ngừng, log worker `not_instrumented`…) | data dictionary v2 (PR #79) | [`05`](05-observability.md) mục 10 |

## Danh sách file

| File | Nội dung | Khi nào đọc |
| --- | --- | --- |
| [`01-project-overview.md`](01-project-overview.md) | Đề tài, hai phần lớn, góp ý giữa kỳ, ADR-006, **ADR-007**, **plan v0.4**, Gate R, tuần 13 đã làm gì, lộ trình tới cuối kỳ | **Đọc đầu tiên** |
| [`02-basic-concepts.md`](02-basic-concepts.md) | Khái niệm nền: microservice, worker, API, database, RabbitMQ, outbox, timeout, circuit breaker, token, trace/metric/log, Docker | Khi gặp từ lạ |
| [`03-refactor-v1-to-v2.md`](03-refactor-v1-to-v2.md) | Testbed v1 → v2: vì sao đổi, Đức đã làm gì (ADR-001→005, R-01→R-18), Bách thu gọn gì (ADR-006), bảng tên cũ → mới, Gate R | Muốn hiểu đợt refactor |
| [`04-testbed-architecture.md`](04-testbed-architecture.md) | Kiến trúc testbed v2: 11 runtime, hạ tầng, xác thực, gọi đồng bộ/bất đồng bộ, đồ thị phụ thuộc, **các cơ chế che hoặc làm muộn nguyên nhân** | Trước khi thiết kế case lỗi |
| [`05-observability.md`](05-observability.md) | Testbed phát ra dữ liệu gì, đi đâu, đọc thế nào, có giới hạn gì với RCA; **artifact export và kiểm chất lượng của tuần 13** | Trước khi làm phần dữ liệu |
| [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md) | **Tự dựng stack từng bước + giải thích W1–W7 kèm trace thật** (đã chạy thật trên bản clone mới); phần J: ghép lớp fault, chạy k6 mức 1, export + kiểm chất lượng (cần merge PR #75–#79) | **Gate R, điều kiện 5** |
| [`07-experiment-concepts.md`](07-experiment-concepts.md) | Thuật ngữ thực nghiệm: telemetry, workload, fault, ground truth, scenario, run, campaign, window; **workload bán thực, hold-out, E1–E8, đăng ký trước, SimpleRCA/BARO, RCAEval** | Trước tuần 14 |
| [`08-ai-rca-design.md`](08-ai-rca-design.md) | Thiết kế AI/RCA, phần nào là học máy, baseline (thêm SimpleRCA, BARO), cách chấm, RQ1–RQ6, **bộ bằng chứng E1–E8 để trả lời "AI giúp gì so với thủ công"** | Trước tuần 16, khi chuẩn bị bảo vệ |
| [`09-cases-and-workload.md`](09-cases-and-workload.md) | Case lỗi C1–C7 (MVP: C2, C3, C4, C6) kèm cơ chế gây lỗi thật của tuần 13; workload dải bốn mức 1 / 2 / **2+** / 3 | Trước tuần 14 |
| [`10-naming-cheatsheet.md`](10-naming-cheatsheet.md) | Bảng tra tên: `service.name`, `dependency_identity`, queue, metric, mã lỗi, biến môi trường; tên của `faults/`, `load/`, `training/` | Khi đọc trace/metric |
| [`11-reading-guide.md`](11-reading-guide.md) | Lộ trình đọc tài liệu gốc v2, tài liệu nào đã cũ, thứ tự ưu tiên khi tài liệu mâu thuẫn | Khi cần mở tài liệu gốc |
| [`research-defense/`](research-defense/README.md) | Giải thích dễ hiểu phần nghiên cứu đứng sau ADR-007 (baseline đơn giản mạnh, workload "đồ chơi", log Moodle, LLM agent, thử nghiệm người) kèm tài liệu tham khảo | Khi chuẩn bị trả lời phản biện |

Mỗi file kết thúc bằng **Tóm tắt** và **Câu hỏi tự kiểm tra** (đáp án ẩn, bấm để mở). Chỗ nào nhắc tới kết quả nghiên cứu đều ghi nguồn dạng "tên ngắn + năm + link" kèm khóa `[L-…]` của [`../plan/literature-matrix-v1.md`](../plan/literature-matrix-v1.md), để dùng lại khi viết báo cáo.

## Thứ tự đọc đề xuất

```text
01 tổng quan → 02 khái niệm → 03 refactor → 04 kiến trúc → 05 quan sát
   → 06 TỰ DỰNG STACK + W1–W7 (làm thật, ghi bằng chứng Gate R)
   → 07 thuật ngữ thực nghiệm → 09 case + workload → 08 AI/RCA
   → research-defense/ (khi chuẩn bị phản biện)
   (10 để tra cứu, 11 khi cần mở tài liệu gốc)
```

## Quan hệ với folder cũ `weekly-explanations/`

Folder cũ viết cho **testbed v1** (tuần 1–10). Nội dung còn đúng đã được chuyển và cập nhật sang đây; phần còn lại giữ làm lịch sử. Bảng chi tiết "file cũ nào còn dùng được" ở [`11-reading-guide.md`](11-reading-guide.md) mục 5.

## Điểm lệch giữa tài liệu và code phát hiện khi viết bộ này

Khi đọc kỹ tài liệu gốc và code để viết (17/11/2026), phát hiện các chỗ lệch dưới đây. Ghi chú trong folder này **theo code**. Phần lớn đã được sửa trong tài liệu gốc ở [PR #74](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/74) (merge 17/11/2026); cột "Trạng thái" cho biết mục nào **còn mở**.

### Nhóm 1 — Ảnh hưởng trực tiếp tới thiết kế thí nghiệm và đánh giá

| # | Điểm lệch | Vì sao quan trọng | Trạng thái |
| --- | --- | --- | --- |
| 1 | Với 4 case MVP, mỗi case một `root_cause_service` khác nhau, một bảng xếp hạng **cố định** (luôn trả cùng 3 service) đã đạt Top-3 = 75% (Top-1 = 25%). ADR-006 mục "Phương án đã loại" lại lấy lý do "xếp hạng hằng đạt Top-3 khoảng 71%" để bỏ phương án 7 case | Top-3 vẫn "bão hòa"; cần nhấn mạnh Top-1, MRR, so sánh với baseline trên cùng run, hoặc báo cáo kèm baseline xếp hạng cố định | **Đã xử lý**: ADR-006 có đính chính (PR #74); ADR-007 chốt Top-1 và MRR là chỉ số chính, luôn kèm mốc random và xếp hạng hằng |
| 2 | Luật `base-manual-auto` ("kết luận service sở hữu span lỗi/chậm sâu nhất") chưa nói ở C3 thì `ai-llm-provider` quy về `ai` (đáp án) hay để nguyên `ai-worker` (process gọi provider) | Ở C3 chi tiết này quyết định baseline đúng hay sai; phải chốt **trước** khi chạy campaign để engine không "thắng nhờ quy ước" | **Còn mở**: chốt trên validation ở tuần 17 (plan v0.4), ghi vào bản đăng ký trước ở tuần 19 |
| 3 | C2 bản viết lại (chèn trễ `course` → `course-postgres`) chưa có `scenario_id`, mã fault, `fault_target`, `fault_target_kind`; nhiều tài liệu vẫn mô tả C2 theo cơ chế cũ "export CSV giữ kết nối" | Việc của tuần 14 (manifest gây lỗi) | **Còn mở một phần**: cơ chế gây lỗi đã có (proxy `course-to-postgres`, PR #75); các tài liệu canonical có banner ADR-006 nhưng đoạn chi tiết C2 trong catalogue case vẫn tả cơ chế cũ; manifest làm ở tuần 14 |
| 4 | Job AI quá hạn "giữ chỗ" (lease) chỉ được chuyển `FAILED/WORKER_INTERRUPTED` khi command của nó được giao **lại** (ví dụ worker chết giữa chừng, RabbitMQ giao lại cho lần thử sau): `run-job.use-case.ts` gọi `failIfInterrupted` khi không giành được job. Không có tiến trình quét định kỳ. Tài liệu (resilience policy v2, contracts v2) mô tả như thể job quá lease tự chuyển trạng thái | Thời điểm `WORKER_INTERRUPTED` xuất hiện phụ thuộc lúc command được giao lại, không phải lúc hết lease: ảnh hưởng triệu chứng và ground truth của **C3** | **Đã sửa tài liệu** (PR #74); hành vi code giữ nguyên (LMS đóng băng) |
| 5 | Đồng bộ usage markdown gặp media chưa `READY` thì job đánh dấu `PARTIAL_FAILED` trong `media_db`, **không có span lỗi, không có log**, và không tự chạy lại khi media `READY` sau đó | Là mắt xích "im lặng" của **C4** | Đặc điểm của code, giữ nguyên; RCA phải tính tới |
| 6 | Khi stack khởi động **chưa có** job `MEDIA_UNUSED_CLEANUP`; admin phải tạo qua API. Trên stack thường thời gian giữ tối thiểu là 1 giờ | Kịch bản C4 phải tự tạo job và chọn thời gian giữ | Vẫn đúng; k6 mức 1 tự tạo job ở bước `setup()` (PR #76) |
| 6b | Cơ chế thật của **C4** khác catalogue: media kẹt `PENDING` không đi nhánh "không dùng" mà bị coi là **upload bỏ dở** khi quá hạn upload (`MEDIA_UPLOAD_EXPIRES_SECONDS=900`) cộng ân hạn 15 phút → `FAILED UPLOAD_ABANDONED`, xóa object. Nhánh "media `READY` không có usage" giữ mặc định 168 giờ (`cleanup-media.use-case.ts`) | Thiết kế kịch bản và ground truth của C4 phải theo nhánh này | **Đã sửa tài liệu** (catalogue case, PR #74) |
| 6c | Ở **C3**, provider LLM **chậm** (dưới 240 giây mỗi lượt, lease được gia hạn mỗi lượt) hoặc **lỗi** thì job thường kết thúc `FAILED` kèm mã lỗi của lời gọi, chưa chắc thành `WORKER_INTERRUPTED` như catalogue mô tả | Phải chọn tham số stub sao cho ra đúng triệu chứng mong muốn, và ghi đúng vào ground truth | **Đã sửa tài liệu** (PR #74) và **đã đo** ở tuần 13 (PR #75): LLM stub trễ 2000±500 ms thì job vẫn `COMPLETED`; `error_rate` = 1 thì job `FAILED` với `AI_PROVIDER_ERROR` |
| 7 | `scheduler-worker` không có span gốc cho mỗi lần chạy job; 10/11 runtime bị Docker thăm dò `/ready` mỗi 5 giây, mỗi lần tạo một trace và một access log (README observability chỉ nói bỏ qua `/health`); dashboard RED cũng chỉ loại `/health` | Trace/metric nhiễu; luật lọc nhiễu của RCA engine phải tính tới `/ready` | README đã sửa (PR #74); code giữ nguyên. Export tuần 13 lọc trace probe và trace thăm dò DB của `scheduler-worker` theo tên span gốc (PR #77) |

### Nhóm 2 — Tài liệu sai hoặc cũ

> Đã sửa trong [PR #74](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/74) (17/11/2026), **trừ mục 9** (lỗi code, cần PR code riêng; vẫn còn mở, được ghi lại ở [telemetry-data-dictionary-v2](../architecture/telemetry-data-dictionary-v2.md) mục 9 của PR #79) và **mục 20** (không phải lỗi). Cột "Đúng theo code" giữ lại để hiểu vì sao từng phải sửa.

| # | Chỗ sai (trước PR #74) | Đúng theo code |
| --- | --- | --- |
| 8 | ADR-006 quyết định 1.2 và `http-and-event-contracts-v2.md` §1.1 ghi media đọc công khai với `Cache-Control: no-store` | `stream-media.ts` đặt `public, max-age=300` (cả trước và sau R-18) |
| 9 | **Còn mở.** `notification-worker` phát command qua outbox relay với identity cứng `notification-rabbitmq` (`outbox-relay.service.ts`), trái quy ước "`<service.name>-rabbitmq`" | Span PRODUCER của worker có `service_name=notification-worker` nhưng `dependency_identity=notification-rabbitmq`. LMS đóng băng nhưng đây là sửa telemetry nên ADR-006 cho phép |
| 10 | `aiops-platform/observability/README.md` và `backend-microservice-testbed-blueprint-v2.md` (phần RED) ghi 12 runtime; `analysis-anomaly-rca-blueprint-v1.md` ghi "12 giá trị canonical" của `service.name` | 11 runtime |
| 11 | `evaluation-protocol-v1.md` ghi xếp hạng ngẫu nhiên Top-1 = 1/11, Top-3 = 3/11 | Candidate set 10 → 1/10, 3/10 |
| 12 | Analysis blueprint lúc nói "bốn loại cạnh" (không có `auth`), lúc lại dùng `auth` như loại cạnh riêng | Cần thống nhất |
| 13 | Catalogue v2: cạnh `e26` (lấy token) chỉ ghi gateway là bên gọi; `notification-worker` chỉ ghi là consumer | 6 runtime lấy token (gateway, course, media, notification-worker, scheduler-worker, ai-worker); `notification-worker` cũng phát command |
| 14 | Catalogue case ghi "gateway và mọi worker" lấy token | `media-worker` không lấy token |
| 15 | Thành phần gốc của FB: catalogue ghi `notification-rabbitmq`, fault matrix ghi `notification-worker-rabbitmq` | Nay thống nhất `notification-worker-rabbitmq` |
| 16 | Fault matrix ghi RabbitMQ có "vhost riêng cho LMS" | Compose dùng vhost mặc định `/` |
| 17 | Resilience policy v2: mã trong `passthroughStatuses` "không tính vào breaker" | Code gọi `breaker.onSuccess()` (đặt lại bộ đếm); hiện chưa service nào dùng tùy chọn này |
| 18 | `README.md` gốc, mục Quick Start: "bảy service (Auth, Student, …)"; đoạn cuối nói plan v0.2 chưa cập nhật | Identity thay Auth + Student; plan hiện hành nay là v0.4 |
| 19 | `docker-compose/README.md`: "MinIO console 9001"; "Kiểm tra Identity (qua Gateway)" nhưng lệnh gọi thẳng cổng 3001; danh sách cổng cần trống thiếu nhiều cổng | Image MinIO đang dùng không có console; xem bảng cổng ở [`06`](06-stack-and-workflows-guide.md) mục A4 |
| 19b | `data-ownership-and-fault-matrix-v2.md` và `service-catalogue-and-topology-v2.md` vẫn tả FC/C2 là "export CSV giữ kết nối" và **không có** banner ADR-006 | Nay đã có banner ADR-006 |
| 19c | `refactor-board-v1.md` ghi R-05/R-05b "chưa có PR" | Git có PR #61 chứa commit R-05; R-16/R-17 tương ứng PR #71/#70 |
| 20 | Hai đầu của cùng một cạnh đặt tên tham số khác nhau: `:courseId` (bên gọi) và `:course_id` (bên nhận) | Không phải lỗi, nhưng RCA engine ghép hai đầu phải dựa vào quan hệ cha–con của span, không so khớp chuỗi |

### Nhóm 3 — Phát hiện kỹ thuật tuần 13 (đã đo, nằm ở tài liệu của PR chưa merge)

| # | Phát hiện | Ảnh hưởng | Chi tiết |
| --- | --- | --- | --- |
| 21 | Khi runtime ngừng (`docker pause`), OTel Collector vẫn xuất giá trị cuối của mọi series thêm khoảng 5 phút: Prometheus vẫn có mẫu mỗi 5 giây nhưng giá trị đứng yên | C6 và feature: "có mẫu" không có nghĩa là "còn sống"; phải xem bộ đếm `process_cpu_time_seconds_total` có tăng không | [`05`](05-observability.md) mục 10.1 |
| 22 | 4 worker không có log nào ngoài access log của probe; sau khi lọc probe, log của worker là `not_instrumented` | Modality log không giúp được gì ở phía worker | [`05`](05-observability.md) mục 10.2 |
| 23 | Bộ đếm lỗi xuất hiện lần đầu giữa cửa sổ là series mới; `increase()`/`rate()` của Prometheus bỏ mẫu đầu, có thể trả 0 cho đợt lỗi đầu | Feature pipeline phải đọc giá trị thô, coi giá trị trước đó là 0 | [`05`](05-observability.md) mục 10.3 |
| 24 | Upload trực tiếp từ client lên MinIO (URL ký sẵn) **không đi qua proxy** chèn trễ | C4 chỉ chèn được lỗi ở phía server của `media` và `media-worker` | [`09`](09-cases-and-workload.md) mục 2.3 |
