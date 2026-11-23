# Báo cáo pilot 4 case MVP v1

> **Task:** `task-03_pilot-mvp-fault-cases` (tuần 15).
>
> **Trạng thái:** hoàn tất, cập nhật 23/11/2026. Đợt 1 (20/11/2026) chạy C6, C2, C3, C4 theo lịch mặc định của fault manifest v1. Đợt 2 (23/11/2026) chạy run healthy đối chứng và bốn run có cửa sổ fault trùng cao điểm tải, trong đó C2 trên `healthy-spike`. Tham số chốt ở fault manifest v2 (mục 5).
>
> **Tài liệu liên quan:** [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 5.2, 5.3, 6.1, 7.3, 8.3, 8.4; [case catalogue v0](complex-case-catalogue-and-rca-result-v0.md) mục C2, C3, C4, C6; [workload-design-v1](workload-design-v1.md) mục 8.3, 8.5. Fault manifest: `aiops-platform/faults/manifests/`.

## 0. Đọc nhanh

| Case | Gate (thực thi / ground truth / chất lượng) | Triệu chứng đầu tiên sau `fault_start` | Lan ra ngoài đường request của nguyên nhân |
| --- | --- | --- | --- |
| C6 | pass / valid / partial (cả 2 run) | Lịch mặc định: 15 s (đăng nhập qua gateway lỗi), 20 s (gateway không lấy được token dịch vụ). Cao điểm: 10 s | Có: mọi route qua gateway lỗi 5xx, 889/892 và 1.158/1.163 trace lỗi không tới service đích. Nhánh worker mất token chưa xác nhận (chỉ 1 lỗi ở `ai-worker`) |
| C2 | pass / valid / partial (cả 2 run) | 10 s (`course-postgres`, `gateway → course`) | Chỉ khi có job AI: `ai-worker → course` chậm tới 1,6 s/lời gọi. Ở cao điểm spike: cạn pool, 75–81% request lỗi 504 |
| C3 | pass / valid / partial (cả 2 run) | Lịch mặc định: 275 s (job dồn ở `ai-worker`), 305 s (lời gọi LLM 32 s). Cao điểm: 70 s và 100 s | Có: job AI chờ ở `ai-worker` (message chưa ack) |
| C4 | pass / valid / partial (cả 2 run) | Lịch mặc định: 100 s (`media → MinIO`), 110 s (`gateway → media`). Cao điểm: 25 s và 35 s | Có: `media-worker` (tạo thumbnail, bất đồng bộ) gọi MinIO chậm từ 155 s. Chuỗi job dọn media không lộ |

## 1. Thiết lập

- **Runner:** task-01, mỗi run reset stack sạch và nạp dữ liệu seed `small`/42. Seed workload pilot 21–29, profile `normal-mixed@v1` (`healthy-spike@v1` cho C2 cao điểm), mức tải của task-02.
- **Run:** đặc tả ở `aiops-platform/experiments/specs/pilot-t03-*.json`, ghi trong ledger. Bảng run ở mục 7.
- **Cách đo** (code trong repo, chạy lại được trên artifact):
  - `aiops-training symptoms`: độ trễ triệu chứng (giây ghi trong báo cáo là giá trị làm tròn).
    - Cửa sổ trượt 15 s trên metric 5 s, so với 300 s ngay trước fault. Ngưỡng: latency ≥ 2 × trước fault và tăng ≥ 50 ms; counter lỗi vượt cả 3 × tốc độ trước fault lẫn cửa sổ đông nhất trước fault.
    - Persistence: cửa sổ đầu tiên vượt ngưỡng và cửa sổ 15 s **không chồng nhau** có dữ liệu kế tiếp cũng phải vượt, nên một mẫu đơn lẻ (một lỗi, một lời gọi chậm) không thành triệu chứng.
    - Độ trễ là cận trên: thời điểm ghi là cuối cửa sổ đầu tiên, sai số tối đa 15 s cộng độ trễ thu thập.
    - Trạng thái: `observed`, `not_observed` (có traffic, không vượt), `no_traffic` (không có lời gọi nào trong khoảng tìm), `no_data` (mất dữ liệu).
    - `symptoms.json` của cả 9 run được sinh lại bằng code cuối của nhánh (sau khi sửa persistence ở vòng review).
  - Đếm span: span có `start_time` trong `[fault_start, fault_end)` là "trong fault"; "cả run" là toàn artifact. Phiên "trong cửa sổ fault" là phiên có thời gian chạy giao với cửa sổ fault.
  - Tín hiệu bắt buộc của bảng 8.4: đọc trực tiếp `spans.parquet`, `logs.parquet`, `metrics.parquet` của artifact.
  - Tài nguyên: `sample-docker-stats.mjs` chạy song song mỗi run.

## 2. Từng case

### 2.1. C6 — dừng `identity` (FG)

Run `pilot-c6-normal-mixed-s22-20261120t065500z`. Fault 300 s, `docker pause identity`, TTL token dịch vụ 60 s.

- **Chuỗi nhân quả quan sát được:** `identity` ngừng chạy. Bộ đo thấy CPU đứng yên ở 20 s; series vẫn còn mẫu và quality report gắn `telemetry_silent:identity`.
- **Đăng nhập** qua gateway timeout 5 s (`gateway-identity`: 88 span lỗi trong fault, 90 cả run, p50 5.000 ms). Span lỗi đầu tiên bắt đầu ở 1,2 s; bộ đo metric thấy ở 15 s.
- **Token dịch vụ của gateway:** span lỗi đầu tiên bắt đầu ở 10 s, bộ đo metric thấy ở 20 s (`gateway-identity-token`: 891 span lỗi trong fault, 892 cả run, trả lỗi ngay, p50 0,17 ms). Sau đó mọi route qua gateway trả 5xx.
- **Request dừng ở gateway:** 889/892 trace lỗi không có span SERVER của service đích.
  - 853 trace chỉ có span của gateway.
  - 36 trace có thêm span của chính `identity`, ghi lúc 07:18:41Z, ngay sau `fault_end`: request token đã nằm chờ trong socket của `identity` suốt lúc bị `pause` và được xử lý khi chạy lại, sau khi gateway đã bỏ cuộc.
  - 3 trace sớm (17–36 s sau `fault_start`) có span `course`: lần làm mới token timeout 3 s nhưng request vẫn tới `course` bằng token cũ còn hạn, nên không bị chặn.
  - Bản nháp trước ghi 892/892 do script đối chiếu so `span_kind` phân biệt hoa thường (artifact lưu `server`, script so `SERVER`); đã sửa script và đếm lại.
- **Phía người dùng:** 295 phiên kết thúc `auth_failed`, 13 phiên `too_many_errors` (đều giao với cửa sổ fault); tỉ lệ request lỗi cả run 9,7%.
- **Tín hiệu bảng 8.4:** đủ.
  - Span CLIENT lỗi `gateway-identity-token`.
  - `lms_dependency_error_count_total{gateway-identity-token}` tăng 166 trong khoảng trễ kỳ vọng.
  - 892 dòng log `dependency.failure` của gateway, `span_id` khớp 892/892 span lỗi.
  - CPU `identity` đứng yên, có `telemetry_silent`.
  - Worker không lỗi token trong 300 s: token của chúng chưa hết hạn, hoặc chúng không gọi tới `identity`. Nhánh `<worker>-identity-token` của đường lan truyền kỳ vọng vì vậy chưa xác nhận ở pilot.
- **Khoảng yên lặng** (mục 7.3): 10 s theo span lỗi token đầu tiên, cận trên 20 s theo bộ đo metric. Ngắn hơn mức 70–74 s ở smoke. Giải thích: token dịch vụ của gateway (TTL 60 s) được làm mới theo chu kỳ, nên thời gian từ lúc `pause` tới lúc token hết hạn phân bố trong khoảng 0–60 s, tùy pha của chu kỳ. Cả hai số nằm trong giới hạn kỳ vọng tối đa TTL + 30 s = 90 s của `RunGroundTruth`.

**Run cao điểm** (`pilot-c6-normal-mixed-s29-20261123t073605z`, seed 29). Cửa sổ fault trùng cao điểm của `normal-mixed`: 281 phiên bắt đầu trong cửa sổ 300 s.

- **Cùng chuỗi nhân quả, lộ sớm hơn:** token dịch vụ của gateway lỗi ngay, span lỗi đầu tiên ở 1,2 s, bộ đo metric thấy ở 10 s (1.144 span lỗi trong fault, 1.163 cả run, p50 0,15 ms). Lần làm mới token rơi đúng sau lúc `pause`, nên khoảng yên lặng gần như bằng 0. Đăng nhập timeout 5 s (70 span lỗi trong fault), CPU `identity` đứng yên và gateway trả 5xx ở 15 s.
- **Worker:** `ai-worker` chỉ lỗi lấy token dịch vụ đúng một lần (ở 30 s), chưa đủ persistence nên không tính là triệu chứng. `notification-worker` và `scheduler-worker` không lỗi trong 300 s. Nhánh worker mất token vẫn chưa xác nhận.
- **Request dừng ở gateway:** 1.158/1.163 trace lỗi không có span SERVER của service đích. 39 trace có span của `identity` xử lý sau khi chạy lại (như run thường); 5 trace tới được `course`/`media` bằng token cũ còn hạn.
- **Tín hiệu bảng 8.4:** đủ. 1.163 dòng log `dependency.failure` của `gateway-identity-token`, `span_id` khớp 1.163/1.163 span lỗi; quality report gắn `telemetry_silent:identity`.
- **Phía người dùng:** 305 phiên `auth_failed` và 29 phiên `too_many_errors` giao với cửa sổ fault; tỉ lệ request lỗi cả run 12,5%.

### 2.2. C2 — trễ kết nối `course` → PostgreSQL (FC)

Run `pilot-c2-normal-mixed-s23-20261120t075709z`. Fault 600 s, toxic `latency` 200 ± 20 ms trên `course-to-postgres`.

- **Chuỗi nhân quả:**
  - Truy vấn của `course` chậm sau 10 s: trung bình 1,3 ms → 289 ms, span p50 0,74 ms → 205 ms, không có span lỗi.
  - `gateway → course` chậm cùng lúc, p95 phía client cả run 1,19 s.
  - Mọi operation đều chậm: 16/16 operation có lời gọi cả trước và trong fault tăng ≥ 2 lần; 11 operation chỉ xuất hiện trong fault đều ≥ 192 ms.
- **Lan ra ngoài đường request:** chỉ khi job AI rơi vào cửa sổ fault. `ai-worker` gọi `course` (lưu nội dung, tạo quiz) chậm tới 1,6 s/lời gọi, lộ ở 300 s. Phụ thuộc lúc có job nên không ổn định.
- **Tín hiệu bảng 8.4:** đủ.
  - `lms_dependency_duration_seconds` của `course-postgres` theo mọi operation.
  - `process_cpu_time_seconds_total` của `course` tăng từ 2,9 s lên 7,1 s CPU trong 300 s.
  - RSS có mẫu.
  - Thiếu độ sử dụng pool, là giới hạn đã biết.
- **Phía người dùng:** không phiên nào bỏ ngang vì chậm (2 phiên `impatient` trong cửa sổ fault). Đỉnh học viên đồng thời 176/230 VU dựng sẵn, k6 không bỏ iteration nào.

**Run cao điểm `healthy-spike`** (`pilot-c2-healthy-spike-s26-20261123t040552z`, seed 26). Cùng fault, cửa sổ fault đặt vào cao điểm: 1.877 phiên bắt đầu trong cửa sổ, đỉnh 685 học viên đồng thời.

- **Fault biến thành sập `course` phía người dùng, không chỉ chậm:**
  - Ngay phút đầu, 56% request lỗi; từ phút thứ 2 tới hết fault là 75–81%. Hầu hết là 504 `DEPENDENCY_TIMEOUT` (19.926 lần) khi gateway hết 5 s chờ `course`; p50 phía k6 5.001 ms.
  - Lỗi tập trung ở route của `course`: danh sách bài, danh sách và tạo ghi danh, tiến độ học.
  - 2.054 phiên kết thúc `too_many_errors`, đều giao với cửa sổ fault (2.030 kết thúc trước `fault_end`).
- **Cơ chế:** mỗi truy vấn chậm thêm khoảng 200 ms nên pool kết nối của `course` bão hòa. Truy vấn phải xếp hàng chờ kết nối: span `course → PostgreSQL` có p50 0,6 ms trước fault → 60,7 s trong fault, 358 span lỗi. `course` vẫn chạy tiếp truy vấn sau khi gateway đã bỏ cuộc, nên hàng đợi không giảm.
- **Hồi phục nhanh:** phút đầu sau `fault_end` còn 15% lỗi, từ phút thứ 2 về 0–0,2% và p95 42 ms, như trước fault.
- **Độ trễ triệu chứng:** `course-postgres` và `gateway → course` ở 10 s như run thường. `ai-worker → course` (ngoài đường request) lộ ở 15 s vì job AI đông hơn.
- **Tín hiệu bảng 8.4:** metric đủ như run thường; CPU `course` 14,2 s → 35,1 s trong 300 s.
- **Giới hạn trace của run này:** tải spike sinh 50.923 trace ứng viên, vượt ngân sách export 20.000 trace. 291/665 truy vấn tìm kiếm chạm giới hạn kết quả và 14.828 trace bị bỏ vì hết ngân sách, nên trace mất khoảng 43% (các run `normal-mixed` không bỏ trace nào vì ngân sách). Span 504 của gateway trong artifact dừng ở 4.957, so với 19.926 response 504 phía k6. Các số đếm từ span ở trên (span lỗi, p50) là của mẫu còn lại; kết luận cạn pool dựa trên metric và log của k6.
- **Ý nghĩa:** với cùng cường độ, mức độ của C2 phụ thuộc tải. Ở `normal-mixed` C2 chỉ là trễ; ở cao điểm spike nó thành cạn pool và timeout lan tới gateway. Dataset v0 chỉ đặt fault trên `normal-mixed` nên không bị ảnh hưởng. Nếu sau này đặt fault trên profile spike thì phải ghi triệu chứng kỳ vọng theo profile (mục 5).

### 2.3. C3 — provider LLM chậm (FD)

Run `pilot-c3-normal-mixed-s24-20261120t090256z`. Fault 600 s, `llm-stub` trễ 30 ± 5 s.

- **Traffic tới provider thưa và đến muộn:**
  - 20 phiên giảng viên goal I3 trong cả run; 9 job AI được tạo trong cửa sổ fault.
  - Job đầu tiên ở phút 22,4 của run, tức 264 s sau `fault_start`. Mỗi phiên I3 tạo khóa học, bài, upload và đồng bộ tài liệu trước, khoảng 3–4 phút sau khi bắt đầu.
  - 300 s trước fault không có lời gọi provider nào.
- **Chuỗi nhân quả:**
  - Job dồn ở `ai-worker` (message `run-ai-job` chưa ack lên 2) từ 275 s.
  - Lời gọi `POST chat/completions` hoàn tất đầu tiên ở 305 s. 11 lời gọi trong cửa sổ fault, trung bình 32,4 s.
  - Job vẫn hoàn tất vì 30 s < `AI_COMPLETION_TIMEOUT_MS` 240 s. Không có `WORKER_INTERRUPTED`.
  - Giảng viên chờ job (101 lần đọc trạng thái job), không phiên nào bỏ ngang.
- **Độ trễ triệu chứng:** do lúc job đến quyết định, không do fault. Từ khi có job, triệu chứng lộ sau khoảng 10 s (message chưa ack) và 30 s (lời gọi provider).
- **Tín hiệu bảng 8.4:** chưa kiểm được ở run này.
  - Metric `lms_dependency_duration_seconds{ai-llm-provider}` có.
  - Span CLIENT `ai-llm-provider` và CONSUMER `run-ai-job` **không có trong artifact**: Tempo bị OOM-kill giữa bước export (mục 4), artifact chỉ còn 2.722/14.016 trace. Đã đếm lại sau khi sửa lỗi so `span_kind` của script: vẫn 0 span, chỉ có 2 span CONSUMER `extract-ai-document`.
  - Run C3 cao điểm của đợt 2 có đủ (bên dưới).

**Run cao điểm** (`pilot-c3-normal-mixed-s27-20261123t052639z`, seed 27). Cửa sổ fault trùng cao điểm của `normal-mixed`: 538 phiên bắt đầu trong cửa sổ.

- **Triệu chứng lộ sớm hơn nhiều:** job dồn ở `ai-worker` (`run-ai-job` chưa ack) ở 70 s, lời gọi provider chậm ở 100 s. Ở run lịch mặc định là 275 s và 305 s. Cao điểm của phiên học viên trùng lúc giảng viên đang tạo job AI, nên job đến sớm hơn.
- **Chuỗi nhân quả:** 15 lời gọi `POST chat/completions` hoàn tất trong cửa sổ fault, trung bình 32,1 s (trước fault chỉ 1 lời gọi, 1,4 ms). Không lỗi, job vẫn hoàn tất.
- **Tín hiệu bảng 8.4:** đủ.
  - Tempo không bị kill (giới hạn 1,5 GiB): export đủ 14.079/14.079 trace.
  - Span CLIENT `ai-llm-provider`: 18 span trong fault, p50 32,0 s.
  - Span CONSUMER `run-ai-job`: 14 span trong fault, p50 33,3 s (trước fault 1 span, 53 ms). CONSUMER `extract-ai-document` không đổi (42 ms) vì bước trích văn bản không gọi LLM, đúng kỳ vọng.
  - Metric `lms_dependency_duration_seconds{ai-llm-provider}` có.
- **Phía người dùng:** request lỗi 0,08%, p95 43 ms, không phiên nào bỏ ngang trong cửa sổ fault.
- `ai-worker → course` không vượt ngưỡng ở run này. Tín hiệu ngoài đường request của C3 là job chưa ack.

### 2.4. C4 — trễ `media` → MinIO (FA)

Run `pilot-c4-normal-mixed-s25-20261120t095927z`. Fault 600 s, toxic `latency` 300 ± 30 ms trên `media-to-minio` và `media-worker-to-minio`.

- **Traffic tới MinIO thưa:** upload là thao tác hiếm của giảng viên. 300 s trước fault có 4 lượt upload; trong fault có 27 lượt (mỗi lượt gồm `stat`, `hash`, `copy`, `remove` và `get`).
- **Chuỗi nhân quả:**
  - Mọi operation của `media` tới MinIO chậm khoảng 300 ms/lời gọi (trung bình 1–3 ms → 299–308 ms; `get-object` 598 ms vì đọc hai lần). `presign-upload` không đổi (0,15 ms) vì chỉ ký URL tại chỗ, không gọi MinIO.
  - Span CLIENT `media → MinIO`: p50 1,2 ms → 302 ms, 171 span trong fault, không span lỗi.
  - Triệu chứng đầu tiên ở 100 s, `gateway → media` ở 110 s (đỉnh 0,94 s). Độ trễ này do lượt upload đầu tiên trong fault đến muộn, không do fault.
- **Lan ra ngoài đường request:** `media-worker` tạo thumbnail sau khi upload xong (bất đồng bộ qua hàng đợi) và cũng gọi MinIO chậm: `get-object` 2 ms → 603 ms, `put-object` 2,6 ms → 301 ms, lộ ở 155 s. Span p50 2,2 ms → 453 ms.
- **Chuỗi "media `PENDING` kẹt → job dọn xóa media" không lộ, đúng như dự kiến:**
  - Job dọn media (W7) chạy lúc 02:00 của ngày nén, tức phút 4 của run (span `POST /internal/v1/media/cleanup` lúc 10:04:18Z), trước cửa sổ fault 10:18–10:28Z.
  - Media chỉ bị coi là upload bỏ dở sau `MEDIA_UPLOAD_EXPIRES_SECONDS` 900 s cộng 15 phút ân hạn, dài hơn phần run còn lại.
  - Trễ 300 ms làm upload chậm đi nhưng không làm hỏng: không span lỗi, không phiên nào kết thúc bất thường trong cửa sổ fault.
  - Vì vậy mô tả kỳ vọng của C4 cần sửa thành "upload chậm và worker thumbnail chậm" (mục 5).
- **Probe cũng chậm:** `ping` của health probe tới MinIO chậm 294–299 ms ngay từ đầu fault. Probe là traffic hạ tầng nên bị loại khỏi phép đo (`noise.v1`, `exclude_operations`), không tính là triệu chứng.
- **Tín hiệu bảng 8.4:** đủ. `scheduler-worker → media` (job dọn) không có lời gọi nào trong khoảng tìm (`no_traffic`).
  - `lms_dependency_duration_seconds{media-minio}` theo từng operation, ở cả `media` và `media-worker`.
  - Span CLIENT tới MinIO của cả hai service.
  - Không có log lỗi vì fault chỉ làm chậm.
- **Phía người dùng:** tỉ lệ request lỗi cả run 0,12%, p95 43 ms; 5 phiên `auth_failed` cả run, không phiên nào giao với cửa sổ fault. Đỉnh học viên đồng thời 176/230 VU dựng sẵn, k6 không bỏ iteration nào.

**Run cao điểm** (`pilot-c4-normal-mixed-s28-20261123t063033z`, seed 28). Cửa sổ fault trùng cao điểm của `normal-mixed`: 538 phiên bắt đầu trong cửa sổ.

- **Triệu chứng lộ sớm hơn:** `media → MinIO` và `media-worker → MinIO` ở 25 s, `gateway → media` ở 35 s. Ở run lịch mặc định là 100–155 s. Cao điểm có nhiều upload hơn: 42 lượt trong fault, so với 27.
- **Cùng một kiểu chậm như run thường:** mọi operation tới MinIO khoảng 300 ms (`get-object` khoảng 600 ms), `presign-upload` không đổi. Span `media → MinIO` p50 1,1 ms → 303 ms (262 span); span `media-worker → MinIO` p50 2,2 ms → 440 ms (60 span). Không span lỗi.
- **Job dọn media:** vẫn chạy ở phút 4, trước cửa sổ fault, như dự kiến.
- **Tín hiệu bảng 8.4:** đủ. Tempo export đủ 14.036/14.036 trace.
- **Phía người dùng:** request lỗi 0,07%, p95 43 ms, không phiên nào bỏ ngang trong cửa sổ fault.

## 3. Điều kiện vào campaign (mục 5.2) và `case_verification_status`

| Điều kiện | C2 | C3 | C4 | C6 |
| --- | --- | --- | --- | --- |
| 1. Injector chạy và tái lập được | Đạt | Đạt | Đạt | Đạt |
| 2. Triệu chứng ngoài đường request | Chỉ khi có job AI (case đối chứng dễ theo ADR-006) | Đạt (job dồn ở `ai-worker`) | Đạt (`media-worker` tạo thumbnail chậm); chuỗi job dọn không lộ | Đạt |
| 3. Tín hiệu bảng 8.4 | Đạt; pool là giới hạn | Đạt (span đủ ở run cao điểm) | Đạt | Đạt |
| 4. `RunGroundTruth` hợp lệ | Đạt | Đạt | Đạt | Đạt |
| 5. Pilot đã đo và freeze tham số | Đạt (manifest v2) | Đạt (manifest v2, 900 s) | Đạt (manifest v2) | Đạt (manifest v2) |
| **`case_verification_status`** | `run` | `run` | `run` | `run` |

- `run` (evaluation-protocol-v1 mục 3.2, giá trị `run | signals_measured | hypothesis`): chuỗi nhân quả đã chạy thật trong pilot, tín hiệu đã đo, tham số đã freeze.
- **C6** ghi giới hạn: nhánh worker mất token (`<worker>-identity-token`) chưa xác nhận ở cả hai run (chỉ 1 lỗi ở `ai-worker`); triệu chứng chính ở gateway đã xác nhận.
- **C2** vào campaign với vai trò case đối chứng dễ (ADR-006): triệu chứng ngoài đường request chỉ có khi job AI rơi vào cửa sổ fault. Giới hạn: không phân biệt được "pool cạn" với "DB chậm" vì không có metric độ sử dụng pool (mục 8.4).
- **C4** vào campaign với mô tả đã sửa: bỏ chuỗi "media `PENDING` kẹt → job dọn xóa media" (không lộ được trong run 48 phút); triệu chứng ngoài đường request là `media-worker` tạo thumbnail chậm. `RunGroundTruth` của C4 vốn không ghi chuỗi job dọn.
- **C3** ghi giới hạn: độ trễ triệu chứng phụ thuộc lúc job AI đến; mô tả cũ "`course` lỗi muộn ở `ai-worker → course`" (case catalogue v0) chỉ đúng khi trễ provider vượt `AI_COMPLETION_TIMEOUT_MS` 240 s, không đúng với cường độ 30 s đã chốt. `expected_symptom` và `expected_propagation_path` của C3 trong ground truth đã sửa theo số đo: chỉ còn `ai-llm-provider → ai-worker`, vì `ai`, `course` và gateway không có triệu chứng (request lỗi 0,08%, `ai-worker → course` không vượt ngưỡng).

## 4. Sự cố môi trường trong pilot và cách xử lý

- **Grafana:**
  - Lúc khởi động, Grafana tải lại và tự nâng khoảng 16 plugin, nên phiên bản thay đổi giữa các run. Đã tắt `GF_PLUGINS_PREINSTALL_AUTO_UPDATE` từ run C2.
  - Page cache lúc khởi động đẩy working set lên 88–90% giới hạn trong khoảng 12 phút đầu, rồi tự giảm. Bộ nhớ không thu hồi được (`anon`) chỉ 220–420 MiB.
  - Tiêu chí bộ nhớ của mục 8.4 đổi sang phần không thu hồi được của cgroup v2: `anon` + `shmem` + bộ nhớ kernel (`load/README`, workload-design-v1 mục 8.4). Ngưỡng 85% không đổi.
  - Đợt 1 bộ lấy mẫu chỉ ghi working set; đợt 2 ghi `anon` (bản đầu của thay đổi này, chưa cộng `shmem` và kernel). Ở đợt 2, `anon` của Grafana tối đa 51–53% dù working set có lúc chạm 91% (run C6 cao điểm). Đo lại trên stack sau pilot: Grafana có `anon` 347 MiB, kernel 12 MiB, `shmem` 0, tổng 358 MiB không thu hồi được (47% giới hạn), nên phần cộng thêm nhỏ so với `anon`.
  - File lấy mẫu của từng run lưu ở `docker-stats.jsonl` trong thư mục run (gitignore).
  - Bộ lấy mẫu cũ cache id container theo tên, nên khi runner reset stack sau lúc bắt đầu lấy mẫu, một số container (Tempo ở run healthy) không có số `anon`. Đã sửa: đọc cgroup thất bại thì inspect lại để lấy id mới, và ghi cảnh báo khi không đọc được cgroup.
- **Lỗi của script đối chiếu tín hiệu (không thuộc repo):** script so `span_kind` phân biệt hoa thường; đã sửa và đếm lại mọi run. Ảnh hưởng duy nhất tới kết luận là số trace lỗi C6 không tới service đích (mục 2.1).
- **Tempo bị OOM-kill khi export run C3:** tải 14.016 trace, đỉnh 1.018/1.024 MiB. Đây là source outage theo mục 8.3, không phải degradation. Giới hạn đã nâng lên 1,5 GiB: với run C4 bằng `docker update` lúc run đang chạy, với các run sau trong compose. Từ run C4, mọi run tải đủ số trace đã chọn, không lỗi fetch, Tempo không bị kill.
- **Trace `truncated` ở mọi run:** ở 8 run `normal-mixed`, 16/129 truy vấn tìm kiếm chạm giới hạn kết quả, phần thiếu rơi vào các lát thời gian đông; không trace nào bị bỏ vì ngân sách (11.765–14.079 trace được chọn, ít nhất ở hai run C6 vì request dừng ở gateway). Run C2 trên `healthy-spike` mất nặng hơn nhiều (mục 2.2): 291/665 truy vấn chạm giới hạn, 14.828 trace bị bỏ vì vượt ngân sách 20.000. Đây là giới hạn đã biết của export (protocol mục 8.3). Feature pipeline v1 của task-05 gắn cờ `traces_truncated`; dataset trên profile spike sẽ cần ngân sách export lớn hơn hoặc lấy mẫu trace có chủ đích.

## 5. Tham số chốt (fault manifest v2)

File `aiops-platform/faults/manifests/fault-manifest-v2.json`, `manifest_version` 2.0.0, là mặc định của `fault-schedule.mjs` và runner. Cường độ giữ như v1; mỗi case có thêm trường `pilot`, trong đó `first_signal_lag_s` là độ trễ của tín hiệu sớm nhất ở mọi vai trò (kể cả nguyên nhân), theo lịch mặc định và cao điểm. Window 15 s × persistence 2 của bộ đo triệu chứng cộng độ trễ thu thập metric 10 s là khoảng 40 s; thời lượng phải lớn hơn độ trễ triệu chứng cộng khoảng đó.

- **C3:** thời lượng fault **900 s** thay vì 600 s. Độ trễ triệu chứng do lúc job AI đến quyết định: 70–100 s khi fault trùng cao điểm, 275–305 s theo lịch mặc định. Dataset v0 dùng lịch mặc định (`align_peak: null`).
  - Thời điểm job AI đầu tiên sau phút 18 ở 8 run `normal-mixed` của pilot (8 seed): 14, 24, 111, 230, 264, 291, 329 và 458 s. Mức 458 s thuộc run C6, nơi fault chặn đăng nhập nên giảng viên tạo job muộn; các run khác tối đa 329 s.
  - Với 600 s: job đến ở 329 s, cộng lời gọi LLM 30 s và khoảng phát hiện 40 s, triệu chứng lộ ở khoảng 400 s, còn khoảng 3 phút fault active. 900 s giữ biên khoảng 8 phút.
  - Giữ workload hiện tại, không tăng goal I3 cho mọi run: mọi run đều có job AI trong 900 s đầu từ phút 18 (3–15 job).
  - Với 900 s, cửa sổ align-peak của C3 bắt đầu muộn nhất ở giây 1380, nên không đặt được vào slot giây 1620 của run C3 cao điểm. Độ trễ 70–100 s ở mục 2.3 vì vậy không lặp lại đúng như thế với manifest v2.
- **C6:** 300 s đủ (triệu chứng ở 10–20 s).
- **C2:** 600 s đủ (triệu chứng ở 10 s, cả ở cao điểm spike). Giữ cường độ 200 ± 20 ms cho mọi profile, không chỉnh theo tải. Ghi trong manifest v2 rằng ở profile spike, triệu chứng kỳ vọng gồm cả 504 `DEPENDENCY_TIMEOUT` tại gateway.
- **C4:** 600 s đủ (triệu chứng ở 25–35 s khi trùng cao điểm, 100–155 s theo lịch mặc định). Chuỗi "media `PENDING` kẹt → job dọn xóa media" không thuộc đường lan truyền kỳ vọng (manifest v1 và `RunGroundTruth` vốn đã không ghi).
- **Warm-up, recovery, slot:** giữ như v1 (warm-up 360 s, fault mặc định ở giây 1080, recovery ≥ 600 s). Slot cao điểm dùng `--align-peak` theo kế hoạch phát lại; dataset v0 đặt fault theo lịch mặc định.
- **Spec pilot ghim manifest v1** (`fault.manifest` trong `experiments/specs/pilot-t03-*.json`) để chạy lại đúng như pilot.

## 6. Profile healthy đối chứng (workload-design-v1 mục 8.3)

Run `pilot-healthy-normal-mixed-s21-20261123t025936z`: `normal-mixed`, seed 21, không fault.

- **Bộ đo triệu chứng không báo nhầm:** chạy `aiops-training symptoms` của cả 4 case trên hai cửa sổ fault giả (lịch mặc định phút 18–28 và cửa sổ cao điểm phút 27–37; C6 dùng 300 s). 36/38 tín hiệu có traffic và đều `not_observed`; 2 tín hiệu `no_traffic` (`scheduler-worker → media`, không có lời gọi nào trong cửa sổ). Vậy các độ trễ đo ở mục 2 không phải do dao động bình thường của workload vượt ngưỡng.
- **Tiêu chí khỏe của workload-design-v1 mục 8.4:**
  - p95 phía k6 cả run 43 ms; request lỗi 0,08%; 0 dòng `unexpected_status`; k6 không bỏ iteration nào.
  - Phiên bỏ ngang: 3/1.349 phiên `auth_failed` (0,22% < 1%).
  - Bộ nhớ (theo `anon`, mục 4): Grafana tối đa 395 MiB, 51% giới hạn. Working set của `docker stats` vẫn chạm 83% vì page cache, đúng như lý do đổi cách đo ở mục 4.
  - CPU: RabbitMQ (không đặt giới hạn CPU) có các mẫu đơn lẻ 110–218% một core, khoảng 2 phút một lần, không có hai mẫu liên tiếp nên không kéo dài quá 1 phút. Run C4 cũng có cùng nhịp này, nên đây là đặc tính ổn định của stack, không do fault.
  - Chưa kiểm được p95 theo từng cửa sổ 60 s: Prometheus của run đã bị reset bởi run sau.
- **Chất lượng:** `partial` vì trace truncated như mọi run, cộng 1 bản ghi log trùng.

**Quyết định: không thêm profile đối chứng `upload media peak healthy` (C4) và `AI job healthy` (C3).**

- Mục đích của profile đối chứng là để run healthy cũng chứa đúng kiểu tải xuất hiện trong cửa sổ fault, tránh mô hình học nhầm "có upload/job AI = có fault".
- Run healthy `normal-mixed` đã chứa cả hai kiểu tải đó, vì fault run và healthy run phát lại cùng một kiểu kế hoạch:
  - Job AI: 7 lời gọi provider ở cửa sổ phút 18–28, 11 lời gọi ở cửa sổ cao điểm phút 27–37 (34 lời gọi cả run). Run C3 có 11–15 lời gọi trong cửa sổ fault.
  - Upload media: 16 lượt ở phút 18–28, 31 lượt ở phút 27–37. Run C4 có 27–42 lượt trong cửa sổ fault.
- Trên chính các cửa sổ đó, bộ đo triệu chứng của C3 và C4 không vượt ngưỡng ở run healthy (không tín hiệu nào vượt ngưỡng, ở trên).
- Dataset v0 đã có run healthy `healthy-spike` cho kiểu tải đột biến.

## 7. Run pilot

| Run | Case, profile | Commit | Gate thực thi | Ground truth | Chất lượng | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| `pilot-c6-normal-mixed-s22-20261120t065500z` | C6, `normal-mixed` | `bb63c77` | pass | valid | partial (trace truncated, `identity` silent) | Trước khi tắt tự nâng plugin của Grafana |
| `pilot-c2-normal-mixed-s23-20261120t075709z` | C2, `normal-mixed` | `fecb1fe` | pass | valid | partial (trace truncated) | |
| `pilot-c3-normal-mixed-s24-20261120t090256z` | C3, `normal-mixed` | `367574e` | pass | valid | partial (trace partial: Tempo OOM) | |
| `pilot-c4-normal-mixed-s25-20261120t095927z` | C4, `normal-mixed` | `367574e` | pass | valid | partial (trace truncated) | Tempo nâng 1,5 GiB lúc run đang chạy; Grafana working set tối đa 62,5% |
| `pilot-healthy-normal-mixed-s21-20261123t025936z` | không fault, `normal-mixed` | `af1bc86` | pass | valid | partial (trace truncated, 1 log trùng) | Đối chứng: không tín hiệu nào báo nhầm |
| `pilot-c2-healthy-spike-s26-20261123t040552z` | C2, `healthy-spike`, cao điểm | `af1bc86` | pass | valid | partial (trace truncated) | 75–81% request lỗi 504 trong fault, hồi phục sau 1–2 phút |
| `pilot-c3-normal-mixed-s27-20261123t052639z` | C3, `normal-mixed`, cao điểm | `ca0975b` | pass | valid | partial (trace truncated) | Đủ span LLM và CONSUMER; Grafana `anon` tối đa 52% |
| `pilot-c4-normal-mixed-s28-20261123t063033z` | C4, `normal-mixed`, cao điểm | `5d88761` | pass | valid | partial (trace truncated, 1 log trùng) | |
| `pilot-c6-normal-mixed-s29-20261123t073605z` | C6, `normal-mixed`, cao điểm | `dc6ed6d` | pass | valid | partial (trace truncated, `identity` silent, log trùng) | Token gateway lỗi ở 1,2 s (theo span) |
