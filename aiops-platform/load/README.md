# load — workload k6

Module tạo traffic giả lập người dùng thật đi qua Gateway, để telemetry của thí nghiệm có "tải nền" giống một LMS đang được dùng. Kế hoạch: [plan v0.4 tuần 13–14](../../docs/processed/plan/plan-v0.4-24-weeks.md); thiết kế hành vi người dùng: [workload-design-v1](../../docs/processed/architecture/workload-design-v1.md); nguồn traffic học viên: [ADR-007](../../docs/processed/adr/adr-007-semi-real-workload-and-ai-evidence-v1.md).

| Mức | Nội dung | Trạng thái |
| --- | --- | --- |
| Mức 1 | Mỗi hành trình W1–W7 chạy thao tác cơ bản, mỗi hành trình một nhóm người dùng ảo (VU) cố định, nghỉ đều giữa hai thao tác | **Có** (`scenarios/level-1.js`) |
| Mức 2 | Giảng viên, admin, job lịch: máy trạng thái, thời gian nghỉ log-normal, phản ứng theo phản hồi, nhịp tải theo đường cong trong ngày | Tuần 14 (task-03) |
| Mức 2+ | Học viên: phát lại phiên thật từ log Moodle (mục "Dữ liệu phiên thật" bên dưới) | Công cụ dữ liệu **có** (`tools/`); scenario k6 tuần 14 (task-02) |

## Chuẩn bị

1. Stack đầy đủ **cộng lớp fault** (cần `llm-stub` cho W6), xem [`../faults/README.md`](../faults/README.md):

   ```bash
   docker compose --env-file docker-compose/.env \
     -f docker-compose/compose.full.yaml -f aiops-platform/faults/compose.faults.yaml up -d --wait
   ```

2. Dữ liệu seed R-10 profile `small` (tài khoản `seed-student-N@seed.test`, `seed-instructor-N@seed.test`, mật khẩu `seed-password`):

   ```bash
   cd lms && pnpm run seed:data -- --environment local --compose-env-file ../docker-compose/.env \
     --non-interactive --yes --profile small --seed 42
   ```

3. Docker. Máy **không cần cài k6**: script chạy image `grafana/k6:1.3.0`.

## Chạy

Từ thư mục gốc repository:

```bash
aiops-platform/load/run-k6.sh level-1                      # 2 phút, 1 VU mỗi hành trình
DURATION=10m VUS=2 aiops-platform/load/run-k6.sh level-1    # 10 phút, 2 VU mỗi hành trình
JOURNEYS=w3,w4 VUS_W3=4 aiops-platform/load/run-k6.sh level-1 --quiet
RUN_ID=healthy-normal-r1 SEED=7 aiops-platform/load/run-k6.sh level-1
```

Container k6 dùng network của host (`--network host`): bước upload trực tiếp đi tới URL presigned của MinIO ký cho `MINIO_PUBLIC_URL` (`http://localhost:9000`), chỉ host mới gọi được địa chỉ đó.

Kết quả ghi vào `aiops-platform/load/results/<RUN_ID>/k6-summary.json` (thư mục `results/` không commit):

| Trường | Ý nghĩa |
| --- | --- |
| `run_id`, `seed`, `workload_level` | Định danh run và seed của bộ sinh số |
| `started_at`, `finished_at` | Cửa sổ thời gian UTC của run (dùng cho export telemetry, task-04) |
| `journeys.<wN>` | Số lượt, số request, tỉ lệ lỗi HTTP ngoài mong đợi, p95 thời gian phản hồi, tỉ lệ check đạt |
| `thresholds_ok` | `true` khi mọi ngưỡng đạt |

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `RUN_ID` | `k6-<scenario>-<thời gian UTC>` | Định danh run; nên đặt rõ cho run thí nghiệm |
| `SEED` | `1` | Seed của bộ sinh số; mỗi VU dùng `SEED × 1000 + số VU` |
| `DURATION` | `2m` | Thời lượng mỗi hành trình |
| `JOURNEYS` | `w1,…,w7` | Các hành trình chạy |
| `VUS`, `VUS_W1`…`VUS_W7` | `1` | Số VU chung và riêng từng hành trình |
| `THINK_MIN_S`, `THINK_MAX_S` | `1`, `3` | Nghỉ đều giữa hai thao tác (mức 1) |
| `W5_MAX_BATCHES_PER_VU` | `1` | Số đợt gửi hàng loạt tối đa mỗi VU (mỗi đợt gửi tới **mọi** học viên) |
| `W7_PAUSE_S`, `W7_RETENTION_HOURS` | `30`, `168` | Nghỉ giữa hai lần dọn media; tuổi tối thiểu của media bị dọn |
| `LLM_PROVIDER_URL` | `http://llm-stub:8080/v1` | Địa chỉ provider mà `ai-worker` gọi tới (trong network Compose) |
| `SEED_STUDENTS`, `SEED_INSTRUCTORS` | `1000`, `10` | Số tài khoản seed (profile `small`) |
| `ASYNC_TIMEOUT_S` | `60` | Thời gian tối đa chờ việc bất đồng bộ |
| `BASE_URL` | `http://127.0.0.1:3000` | Gateway |

## Các hành trình mức 1

| Hành trình | Người dùng | Thao tác |
| --- | --- | --- |
| W1 `w1_auth` | Học viên | 20% đăng ký mới, còn lại học viên seed đăng nhập; `/auth/me`, `/students/me`, làm mới token |
| W2 `w2_course_authoring` | Giảng viên seed | Tạo khóa học, 2 bài học, quiz 2 câu; xuất bản quiz và khóa học; tìm kiếm, tổng hợp; mỗi 10 lượt xuất CSV một lần |
| W3 `w3_enroll_and_learn` | Học viên seed (đổi sau mỗi 5 lượt) | Duyệt danh mục, xem chi tiết, ghi danh (409 nếu đã ghi danh), đọc bài, cập nhật tiến độ, làm và nộp quiz đã xuất bản |
| W4 `w4_media_upload` | Giảng viên seed | Upload ảnh trực tiếp lên MinIO, đọc nội dung, chờ thumbnail, xem thư viện, đặt làm avatar |
| W5 `w5_notification` | Admin, rồi học viên nhận | Gửi thông báo đơn kèm email; tối đa `W5_MAX_BATCHES_PER_VU` đợt hàng loạt (xác suất 20% mỗi lượt); học viên mở inbox, đánh dấu đã đọc |
| W6 `w6_ai_lesson` | Giảng viên seed | Tạo bài học, đính kèm tài liệu TXT cần trích xuất, đồng bộ tài liệu AI, chờ `EXTRACTED`, chạy luân phiên `SYNTHESIZE_LESSON`/`GENERATE_QUIZ` tới khi kết thúc |
| W7 `w7_media_cleanup` | Admin | Kích hoạt job `MEDIA_UNUSED_CLEANUP` (tạo ở `setup()`), chờ run kết thúc, xem tổng hợp media; nghỉ `W7_PAUSE_S` |

`setup()` chạy một lần trước run: tạo provider AI trỏ tới LLM stub, model, gán ba task AI và kiểm tra health (`ONLINE`); tạo job dọn media thủ công cho W7.

**Mã HTTP mong đợi và phản ứng mức 1.** Mỗi thao tác khai báo các mã coi là bình thường (ví dụ ghi danh `201`/`409`). Mã ngoài danh sách được k6 tính vào `http_req_failed` và làm lượt hiện tại dừng lại; `401` làm VU bỏ phiên đăng nhập để lượt sau đăng nhập lại. Retry có backoff, bỏ ngang theo độ kiên nhẫn là việc của mức 2.

**Ngưỡng của run** (mỗi hành trình): có lượt chạy và request; `http_req_failed` bằng 0; p95 < 10 s; với W4, W6, W7, mọi bước chờ bất đồng bộ đạt. Trên stack có fault, ngưỡng có thể không đạt — đó là hành vi mong muốn, không phải lỗi script.

Mỗi request gắn tag `journey` và `name` là METHOD + route mẫu (không chứa ID), cùng tag `run_id` của run.

## Giới hạn

- Dữ liệu do workload tạo (khóa học, media, thông báo) không bị xóa sau run; reset bằng `lms/test/testbed-reset/` khi cần trạng thái sạch.
- Media seed không có object trong MinIO nên W4 và W6 luôn upload tệp thật.
- Mỗi đợt gửi hàng loạt sinh một email cho từng học viên (profile `small` khoảng 1000 email); Mailpit giữ tối đa 5000 thư.
- Mức 1 không ghi nhật ký từng thao tác và không có backoff: khi một dependency lỗi nhanh (ví dụ C6), VU lặp lại liên tục và tạo bão request. Dùng mức 2/2+ cho run thí nghiệm.

## Dữ liệu phiên thật cho mức 2+ (`tools/`)

Học viên ở mức 2+ phát lại **phiên thật** từ log Moodle Unistudium 2022 ([ADR-007](../../docs/processed/adr/adr-007-semi-real-workload-and-ai-evidence-v1.md), [workload-design-v1](../../docs/processed/architecture/workload-design-v1.md) mục 13). Nguồn: Milani, Biondi, Franzoni, *Unistudium 2022: students groups logs on moodle*, Zenodo, DOI [10.5281/zenodo.13763175](https://zenodo.org/records/13763175), giấy phép CC BY 4.0. Log và mọi file sinh ra nằm trong `data/` (gitignore, **không commit**).

```bash
aiops-platform/load/tools/fetch-moodle-log.sh          # tải zip, kiểm md5 + sha256, giải nén vào data/moodle/
node aiops-platform/load/tools/moodle-to-sessions.mjs  # cắt phiên, ánh xạ, chia đoạn xây / hold-out → data/sessions/
node aiops-platform/load/tools/build-replay-plan.mjs --source moodle  --profile normal-mixed --k 4
node aiops-platform/load/tools/build-replay-plan.mjs --source assumed --profile normal-mixed --k 4
```

| Công cụ | Làm gì | Đầu ra |
| --- | --- | --- |
| `fetch-moodle-log.sh` | Tải `Unistudium_students_groups_logs_2022.zip` từ Zenodo; từ chối file khi md5 hoặc sha256 lệch | `data/moodle/` |
| `moodle-to-sessions.mjs` | Cắt phiên khi nghỉ > 30 phút; ánh xạ sự kiện Moodle → trạng thái (mục 13.2); gộp sự kiện phụ, sự kiện trùng (Phụ lục B); chia **đoạn xây** ngày 0–59 và **hold-out** ngày 60–90 | `moodle-build-v1.json`, `moodle-holdout-v1.json` (định dạng `sessions.v1`), `moodle-stats-v1.json` |
| `build-replay-plan.mjs` | Tạo kế hoạch phát lại cho k6 (`replay-plan.v1`): chọn ngày theo profile, chồng `k` ngày, nén lịch bắt đầu phiên (một ngày → `--run-seconds` 2.880), kẹp think time ở `--think-cap-s` 300 | `data/plans/<nguồn>-<profile>-k<k>-v1.json` |

Ba nguồn của `build-replay-plan.mjs` (dùng cho so sánh ở mục 10.4 của thiết kế):

| `--source` | Phiên lấy từ đâu | Giờ bắt đầu |
| --- | --- | --- |
| `moodle` (mức 2+) | Phiên thật của `k` ngày trong đoạn xây: `normal-mixed` lấy `k` ngày có số phiên gần trung vị nhất; `healthy-spike` lấy ngày cao điểm và `k − 1` ngày đông kế tiếp. Id người dùng gắn hậu tố ngày nên hai ngày không dùng chung tài khoản | Giờ thật trong log (giữ cả độ dao động của quá trình đến) |
| `assumed` (mức 2 thuần) | Máy trạng thái **giả định** của học viên (`params/student-assumed-v1.json`, chép từ mục 3–5 của thiết kế), seed `--seed` | Chia đều theo `w(h)` giả định (mục 7.3) |
| `learned` (sinh thêm kiểu WESSBAS) | Ma trận chuyển và phân vị think time theo trạng thái **học từ đoạn xây** (mục 13.8) | Chia đều theo dáng giờ của đoạn xây |

Với `assumed`/`learned`, số phiên mặc định bằng số phiên của kế hoạch `moodle` cùng profile và `k`. Hold-out **không** được dùng để chọn ngày hay tham số nào; chỉ dùng để kiểm chứng (task-04 tuần 14).

Kết quả chuyển đổi trên log thật (18/11/2026, CSV sha256 `66bfe766…aa06`): 208.109 dòng, phủ **95,19%** (198.095 dòng: 171.892 thao tác riêng, 18.476 sự kiện phụ, 7.727 trùng; bỏ 10.014, trong đó `access_prevented` 8.961); 34.248 phiên thô, **34.247** phiên có thao tác — khớp workload-design-v1 mục 2.3. Đoạn xây 24.538 phiên (60 ngày, trung vị 308,5 phiên/ngày, ngày đông nhất 1.376 là ngày 40); hold-out 9.709 phiên (31 ngày).

| Kế hoạch (`k` = 4) | Ngày | Phiên | Thao tác | Think kẹp ở 300 s |
| --- | --- | ---: | ---: | ---: |
| `moodle-normal-mixed` | 30, 43, 52, 42 | 1.246 | 5.557 | 9,3% |
| `moodle-healthy-spike` | 40, 46, 39, 26 | 4.221 | 26.373 | 12,0% |
| `assumed-normal-mixed` (seed 1) | — | 1.246 | 5.189 | 0% (mô hình đã cắt [1; 300] s) |
| `learned-normal-mixed` (seed 1) | — | 1.246 | 5.939 | 9,9% |

`k` = 4 là giá trị khởi đầu; pilot ở tuần 15 chốt `k` theo tải mục tiêu (mục 13.5) và RAM của máy.

## Mức 2+: phát lại phiên học viên (`scenarios/student-replay.js`)

```bash
# Kế hoạch tạo bằng tools/build-replay-plan.mjs (mục trên). Một ngày nén 48 phút:
RUN_ID=replay-normal-r1 WORKLOAD_SEED=1001 PLAN=data/plans/moodle-normal-mixed-k4-v1.json \
  aiops-platform/load/run-k6.sh student-replay
# Chạy thử 5 phút quanh 10h sáng của ngày nén (giây 1.140–1.440 của kế hoạch):
WINDOW_START_S=1140 WINDOW_S=300 aiops-platform/load/run-k6.sh student-replay
```

- **Lịch:** executor `ramping-arrival-rate` (mô hình mở). Tốc độ không đổi trong mỗi ô 30 s và bằng đúng số phiên bắt đầu trong ô của kế hoạch, nên giờ bắt đầu thật của log được giữ ở độ phân giải 30 s (= 15 phút của ngày thật). Đây là quá trình đến **thật** của log, không phải xấp xỉ Poisson; đặc tính dao động của nó được kiểm ở báo cáo độ thực (task-04).
- **Một iteration = một phiên.** Iteration thứ i phát phiên thứ i (theo giờ bắt đầu). Kế hoạch phiên (tài khoản seed, profile dùng để rút kiên nhẫn, kiên nhẫn, `slow_limit`, có làm mới token giữa phiên hay không) chỉ phụ thuộc `WORKLOAD_SEED` và có `plan_hash`. **Điều kiện tái lập:** `dropped_iterations` = 0; nếu k6 bỏ iteration vì hết VU thì các phiên sau đó chạy lệch giờ và phiên cuối kế hoạch không được phát, nên tóm tắt ghi `plan_reproducible = false` và run đó không dùng làm dữ liệu thí nghiệm. Mặc định `STUDENT_PRE_VUS`, `STUDENT_MAX_VUS` tính từ đỉnh phiên đồng thời của kế hoạch (`peakConcurrency`: think time không nén nên ở giờ đỉnh nhiều phiên dài chồng nhau; VU dựng thêm giữa run chậm và làm k6 bỏ iteration): dựng sẵn `⌈1,15 × đỉnh⌉ + 10`, tối đa thêm `max(50, ⌈0,3 × đỉnh⌉)`. Run `w14-t04-moodle-r1` đo được 176 phiên đồng thời, ước lượng 191.
- **Tài khoản:** gán theo phiên (`accountAssignment`, workload-design mục 13.4): không có hai phiên chạy cùng lúc trên một tài khoản (khoảng đệm 30 s); phiên giữ tài khoản của phiên trước cùng người dùng nếu tài khoản đó đã rảnh, tài khoản mới lấy theo hoán vị có seed. Hai phiên cùng lúc trên một tài khoản làm phiên này nộp lượt làm quiz phiên kia đang làm (409 `QUIZ_ATTEMPT_ALREADY_SUBMITTED`), kể cả phiên của cùng một người vì lịch bắt đầu bị nén còn think time thì không. Tóm tắt ghi `distinct_users`, `virtual_people` (số cặp người dùng – tài khoản), `accounts_reused` và `accounts_overlapping` (phải là 0; khác 0 nghĩa là đỉnh phiên đồng thời vượt số tài khoản seed).
- **Đầu phiên:** log Moodle chèn `LOGIN` (`POST /auth/student/login`, `GET /auth/me`) và `DASH` (`GET /student/enrollments`, `GET /notifications/me?status=UNREAD`); phiên của mô hình giả định chỉ chèn `LOGIN` (có `REGISTER` với 1% phiên người mới).
- **Trạng thái → request** theo workload-design-v1 mục 5.2; điều kiện chặn theo mục 5.5. Khóa học của phiên là một khóa học viên đã ghi danh (chọn ổn định theo người dùng của log); chưa ghi danh khóa nào thì ghi danh vào khóa ánh xạ từ khóa Moodle A–D (bốn khóa **seed** — id tiền tố `5eed` — nhỏ nhất, nên không đổi khi các run trước đã tạo khóa mới; ghi `course_map` trong tóm tắt). `VIEW_MEDIA` cần kho media của run (task-03); không có kho thì bỏ qua.
- **Phản ứng với phản hồi** (`lib/reaction.js`, `lib/client.js`, tham số `params/reaction-v1.json`): chậm hơn kiên nhẫn đếm `slow_count`, chậm hơn 2 × kiên nhẫn bỏ ngang (`impatient`); 0/429/502/503/504 thử lại tối đa 2 lần kiểu Full Jitter với thao tác an toàn để lặp, thao tác tạo mới chỉ "tự bấm lại" một lần với xác suất 0,5 sau một think time loại điều hướng; hết lượt thì thao tác thất bại (`error_count` + 1) và phiên đi tiếp; 401 làm mới token rồi đăng nhập lại một lần (`auth_failed` nếu vẫn hỏng); 500 bỏ qua thao tác (0,5) hoặc rời đi (`exit`); 4xx ngoài danh sách mong đợi ghi `unexpected_status`, bỏ thao tác, quay về `DASH`; 3 lỗi thì `too_many_errors`; think time vượt hạn run thì `run_end`; phát hết phiên thì `exit`.
- **Nhật ký** (workload-design-v1 mục 11.2): `run-k6.sh` ghi log JSON của k6 vào `results/<RUN_ID>/k6-log.jsonl` rồi tách thành `actions.jsonl` (một request: `ts`, `session_key`, `role`, `profile`, `state`, `method`, `endpoint` dạng mẫu, `status`, `error_code`, `duration_ms`, `think_before_ms`, `retry_index`, `outcome`) và `sessions.jsonl` (một phiên: kế hoạch, số thao tác/request, `end_reason`, bộ đếm, `plan_hash`, `source_session_id`).

### Bằng chứng mức 2+ (18/11/2026)

Kế hoạch `moodle-normal-mixed-k4-v1`, đoạn `WINDOW_START_S=1140 WINDOW_S=300` (quanh 10h sáng của ngày nén, đỉnh 80 phiên/phút), stack đầy đủ + lớp fault, không bật fault:

| Run | `WORKLOAD_SEED` | Phiên | Request | `dropped_iterations` | Lỗi HTTP ngoài mong đợi | p95 | Kết thúc phiên |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| `w14-t02-replay-repro-a` | 101 | 269 | 2.313 | 0 | 0 | 42,5 ms | 196 `completed`, 73 `run_end` |
| `w14-t02-replay-repro-b` | 101 | 269 | 2.317 | 0 | 4 lần EOF ở `PUT …/progress`, đều thử lại thành công | 42,7 ms | như run a |
| `w14-t02-replay-repro-c` (120 s) | 202 | 104 | 872 | 0 | 0 | 42,8 ms | 62 `completed`, 42 `run_end` |

- Không có dòng `unexpected_status`; `run_end` nhiều vì think time thật dài hơn đoạn chạy thử 5 phút.
- **Tái lập:** run a và b có `plan_hash` trùng 269/269 phiên; chuỗi (trạng thái, endpoint) trùng hoàn toàn 265/269 phiên (98,5%, ngưỡng mục 10.3 là ≥ 90%); 4 phiên khác nhau vì lần thử lại sau EOF. Seed khác (run c): 0/104 `plan_hash` trùng.
- EOF ở `PUT /api/v1/student/lessons/:lesson_id/progress` (k6 báo `status 0`) xuất hiện lẻ tẻ khi tải ổn định, nhiều khả năng do Gateway đóng kết nối keep-alive đúng lúc k6 dùng lại; client xử lý như lỗi mạng (thử lại có backoff). Chưa điều tra sâu vì LMS đóng băng.
- Lần chạy đầu với 40 VU dựng sẵn bị bỏ 13 iteration ở đỉnh, nên mặc định nâng lên 120/300 (nay thay bằng số VU tính từ kế hoạch, xem trên).

## Profile healthy: học viên + giảng viên + admin + job lịch (`scenarios/profile.js`)

Hai profile bắt buộc của workload-design-v1 mục 8.1–8.2, chạy trên một ngày nén 48 phút:

```bash
RUN_ID=<run_id mới> PROFILE=normal-mixed  WORKLOAD_SEED=7 aiops-platform/load/run-k6.sh profile
RUN_ID=<run_id mới> PROFILE=healthy-spike WORKLOAD_SEED=7 aiops-platform/load/run-k6.sh profile
# Chạy thử 3 phút quanh 10h sáng của ngày nén (lịch giảng viên/admin cắt theo cùng cửa sổ):
RUN_ID=<run_id mới> PROFILE=normal-mixed WINDOW_START_S=1140 WINDOW_S=180 aiops-platform/load/run-k6.sh profile
```

| Scenario k6 | Vai trò | Mức | Lịch |
| --- | --- | --- | --- |
| `students` | Học viên | 2+ | Phát lại kế hoạch `data/plans/moodle-<PROFILE>-k4-v1.json` như `student-replay.js` |
| `instructors` | Giảng viên, mục tiêu I1–I4 | 2 | `ramping-arrival-rate` theo trọng số giờ (`params/staff-assumed-v1.json`, 90 phiên/ngày) |
| `admin_adhoc` | Admin A1–A2 | 2 | Một phiên mỗi giờ hành chính (8h–18h) |
| `admin_batch_<i>` | Admin gửi thông báo hàng loạt (A3) | 2 | Một lần lúc 8h và 19h của ngày nén |
| `admin_cleanup_<i>` | Kích hoạt job dọn media (A4) | 2 | Một lần lúc 2h |

- **Setup** cấu hình provider AI trỏ tới `llm-stub`, tạo kho media dùng chung cho giảng viên, tạo job dọn media (retention 168 h) và ánh xạ khóa Moodle → khóa seed. Request của setup thử lại tối đa 3 lần (cách 1 s) khi gặp lỗi tạm thời: 401 `SERVICE_TOKEN_INVALID`, và với method idempotent thêm mất kết nối hoặc 502–504; request đo tải không thử lại kiểu này.
- **VU dựng sẵn của giảng viên và admin:** `instructors` 30 (tối đa 60; `INSTRUCTOR_PRE_VUS`, `INSTRUCTOR_MAX_VUS`), `admin_adhoc` 6 (tối đa 10). Run healthy đo được đỉnh 14 phiên giảng viên và 2 phiên admin đồng thời. Run C2 pilot với mức cũ (15 và 2) bỏ 1 phiên `admin_adhoc`: VU dựng thêm giữa run không kịp, nên mức dựng sẵn để khoảng 2 lần đỉnh đo được. Tóm tắt ghi `dropped_iterations` và số VU theo từng scenario.
- **Ngưỡng:** `dropped_iterations` = 0 (điều kiện tái lập của phần học viên) và tỉ lệ request lỗi < 0,5%. Vượt ngưỡng thì k6 thoát mã 99; run như vậy không dùng làm dữ liệu.
- **Kết quả:** ngoài `actions.jsonl`, `sessions.jsonl` còn có `k6-summary.json` (tóm tắt theo scenario, `planned_peak_concurrency`, `plan_reproducible`) và `workload-manifest.json` (mục 11.2: version profile, hash tham số và kế hoạch, seed, cửa sổ, mốc thời gian workload). `end_reason` của giảng viên/admin theo mục 6.1: `goal_done`, `exit` (kể cả khi bỏ chờ việc nền; nhật ký thao tác vẫn ghi `background_wait_timeout`), `run_end`, `too_many_errors`, `auth_failed`.
- **`RUN_ID` phải mới cho mỗi lần chạy.** `run-k6.sh` từ chối `RUN_ID` đã có thư mục kết quả: tên provider, job và idempotency key phía server theo `run_id`, và export telemetry, ground truth cũng đánh khóa theo nó.
- **Tài nguyên:** `healthy-spike` cần dựng sẵn khoảng 1.000 VU học viên (đỉnh đồng thời ước lượng 914 phiên), nên chạy khi máy còn nhiều RAM trống.

### Bằng chứng profile (18/11/2026)

| Run | Cấu hình | Kết quả |
| --- | --- | --- |
| `w14-t03-normal-mixed-r1` | Cả ngày, 120 VU học viên dựng sẵn (đặt tay), code trước review | **Không đạt:** `dropped_iterations` = 42 (k6 thoát 99). 13.679 request, lỗi 0,12%, p95 43 ms; cả sáu scenario có traffic (học viên 1.203 phiên, giảng viên 90, admin 11 + 2 đợt gửi + 1 lần dọn). Nguyên nhân: giờ đỉnh cần khoảng 180 VU, VU dựng thêm giữa run không kịp. Dẫn tới việc tính VU từ kế hoạch |
| `w14-t03-smoke-merge-2` | `WINDOW_START_S=1140 WINDOW_S=180`, code sau review, VU tính từ kế hoạch (đỉnh 85 → 108 dựng sẵn) | `dropped_iterations` = 0; 1.590 request, lỗi 0,06% (1 EOF ở `POST /auth/refresh`, thử lại thành công), p95 44 ms. Học viên 174 phiên (`exit` 114, `run_end` 60), giảng viên 9 (`goal_done` 3, `run_end` 6), admin 1. Khóa A–D ánh xạ đúng 4 khóa seed |

| `w14-t03-normal-mixed-r2`, `w14-t03-healthy-spike-r2` | Cả ngày, `main` sau merge #88 (81fce39), `WORKLOAD_SEED=7` | normal-mixed đạt; **healthy-spike không đạt:** 39 dòng `unexpected_status` (409 `QUIZ_ATTEMPT_ALREADY_SUBMITTED` khi lưu câu trả lời quiz) và Tempo chạm 88% giới hạn 512 MiB. Nguyên nhân 409: hai phiên chạy cùng lúc trên một tài khoản seed |
| `w14-t03-healthy-spike-r3`, `w14-t03-normal-mixed-r3` | Gán tài khoản theo người dùng, có xét giờ chạy; Tempo 1 GiB | spike vẫn 35 dòng 409: cả 30 phiên lỗi chồng lên phiên của **cùng** người dùng (lịch nén, think time không nén). normal-mixed hỏng ở setup: một 401 `SERVICE_TOKEN_INVALID` (TTL 60 s) không được thử lại |
| `w14-t03-healthy-spike-r4`, `w14-t03-normal-mixed-r4` | Code cuối của nhánh: gán tài khoản theo phiên, setup thử lại lỗi tạm thời, Tempo 1 GiB | **Đạt cả hai**, bảng dưới |

Tiêu chí "khỏe" mục 8.4 của run r4 (`docker stats` mỗi 15 s; p95 Gateway từ Prometheus, `histogram_quantile(0.95, …http_server_request_duration_seconds_bucket{service_name="gateway"}[60s])` theo bước 60 s trong cửa sổ workload):

| Tiêu chí | Ngưỡng | `normal-mixed-r4` | `healthy-spike-r4` |
| --- | --- | --- | --- |
| p95 Gateway, cửa sổ 60 s lớn nhất (48 cửa sổ) | < 1 s / < 2 s | 0,058 s | 0,058 s |
| Phản hồi ngoài danh sách mong đợi | < 0,5% | 0,14% | 0,08% |
| Phiên bỏ ngang (`impatient`, `too_many_errors`, `auth_failed`) | < 1% | 0,22% (3 `auth_failed`) | 0,02% (1 `auth_failed`) |
| `dropped_iterations` | 0 | 0 | 0 |
| CPU container > 80% kéo dài quá 1 phút | không | không (RabbitMQ lên ~216% một CPU trong một mẫu mỗi khoảng 4 phút; không có giới hạn CPU) | như normal |
| Bộ nhớ container < 85% giới hạn; không restart/OOM | — | cao nhất Grafana 83,8%, Tempo 45,6%; không restart/OOM | cao nhất Grafana 82,7%, Tempo 39,9%; không restart/OOM |
| Dòng `unexpected_status` | 0 | 0 | 0 |

- **Quy mô:** normal-mixed 1.349 phiên (học viên 1.245, giảng viên 90, admin 14), 13.866 request; healthy-spike 4.324 phiên (học viên 4.220), 51.260 request. Cả sáu scenario có traffic ở cả hai profile. `plan_reproducible = true`, `accounts_overlapping` = 0 (spike: 2.153 người dùng, 3.692 người ảo trên 1.000 tài khoản).
- **VU và k6:** VU dựng sẵn 230 (normal, đỉnh ước lượng 191) và 1.062 (spike, đỉnh 914). RAM của k6 ở đỉnh 396 MiB và 3,07 GiB; RAM trống của máy thấp nhất 6,5 GB và 5,1 GB (≥ 4 GB theo mục 8.4 bước 3). CPU của k6 vượt 80% chỉ lúc khởi tạo VU, trước `workload_start`.
- **Lỗi còn lại đều có nguyên nhân đã biết:** 401 `SERVICE_TOKEN_INVALID` rải rác (token service–service TTL 60 s đặt cho mọi run để run healthy và fault cùng cấu hình; gây các phiên `auth_failed`); status 0 (EOF) ở `PUT …/progress`, `POST …/submit`, thử lại thành công; 1 lần 503 `DEPENDENCY_UNAVAILABLE` ở `POST …/ai-jobs` (job AI giảng viên).
- Grafana đứng sát ngưỡng 85% (giới hạn 512 MiB) dù không ai mở dashboard trong run; cần theo dõi ở pilot tuần 15.

## Chấm tiêu chí "khỏe" (`tools/health-check.mjs`)

Tiêu chí của [workload-design-v1 mục 8.4](../../docs/processed/architecture/workload-design-v1.md) (bảng ở đầu `tools/health.mjs`). Cần mẫu CPU/bộ nhớ lấy trong lúc run:

```bash
# Song song với run (dừng bằng Ctrl+C hoặc kill sau run)
node aiops-platform/load/tools/sample-docker-stats.mjs --out aiops-platform/load/results/<run_id>-stats.jsonl
# Sau run (Prometheus giữ 24 giờ)
node aiops-platform/load/tools/health-check.mjs aiops-platform/load/results/<run_id> \
  --stats aiops-platform/load/results/<run_id>-stats.jsonl [--phase deadline] --out health.json
```

- p95 Gateway theo cửa sổ 60 s lấy từ Prometheus; phản hồi ngoài mong đợi là request có `outcome` `retried`, `failed` hoặc `unexpected_status` trong `actions.jsonl` (bỏ dòng `WAIT`); phiên bỏ ngang đếm theo giờ bắt đầu phiên.
- CPU quy theo giới hạn CPU của container (Docker báo % của một core; không đặt giới hạn thì so với một core); chỉ xét container của project (`aiops-lms-*`), container k6 dùng để phân biệt nguyên nhân phía máy.
- Restart/OOM đọc bằng `docker inspect` của container trong project.

## Tìm điểm gãy `λ_knee` (`scenarios/knee.js`)

Theo workload-design-v1 mục 8.4 bước 1: chỉ học viên pha `normal`, tốc độ bắt đầu phiên không đổi trong mỗi bậc 3 phút, bắt đầu từ `KNEE_START_RATE` (mặc định 0,2) và tăng 0,2 phiên/s mỗi bậc (`KNEE_RATE_STEP`, `KNEE_STEP_S`) tới `KNEE_MAX_RATE` (mặc định 6: 30 bậc, 90 phút). Cả lịch là **một** scenario `ramping-arrival-rate` (stage dài 0 s để nhảy bậc) nên mọi bậc dùng chung một bể VU, dựng sẵn theo đỉnh phiên đồng thời của cả lịch (`STUDENT_PRE_VUS`, `STUDENT_MAX_VUS` để ghi đè). Không tách mỗi bậc thành một scenario: phiên dở của bậc trước phải chạy tiếp nên scenario nào cũng kéo tới cuối run, và k6 dựng sẵn tổng VU của mọi bậc (`k6 inspect --execution-requirements` báo 11.948 VU cho 30 bậc). k6 chỉ báo tổng `dropped_iterations`; theo bậc thì suy từ số phiên bắt đầu trong bậc so với số dự kiến (lệch ±1 ở biên bậc không tính). Phiên lấy lần lượt từ kế hoạch `normal-mixed` (phiên thật của log Moodle), dùng vòng khi hết; tài khoản gán theo lịch của bậc như mục 13.4 (`lib/knee.js`).

```bash
# Stack đầy đủ + lớp fault (TTL token 60 s như run thí nghiệm), dữ liệu seed small/42
node aiops-platform/load/tools/sample-docker-stats.mjs --out aiops-platform/load/results/w15-t02-knee-r1-stats.jsonl \
  --min-available-mb 1500 --stop-image grafana/k6:1.3.0 &
RUN_ID=w15-t02-knee-r1 WORKLOAD_SEED=21 aiops-platform/load/run-k6.sh knee --quiet
kill %1
node aiops-platform/load/tools/health-check.mjs aiops-platform/load/results/w15-t02-knee-r1 \
  --stats aiops-platform/load/results/w15-t02-knee-r1-stats.jsonl --steps --out knee-health.json
```

`--steps` chấm từng bậc đã chạy hết (bỏ 60 s đầu mỗi bậc làm khoảng chuyển tiếp; bậc không có request ghi nguyên nhân `no_data`) và in `λ_knee` = tốc độ của bậc khỏe cuối cùng trước bậc đầu tiên không khỏe, tiêu chí bị vi phạm và nguyên nhân: `client` (k6 bỏ iteration, container k6 hết CPU, RAM máy dưới 1,5 GB) hoặc `system` (stack). Phiên trung bình bận khoảng 208 s, nên trên khoảng 4,6 phiên/s số phiên đồng thời vượt 1.000 tài khoản học viên của seed `small`; tóm tắt ghi `accounts_overlapping` theo bậc và bậc có 409 do dùng chung tài khoản được xếp nguyên nhân `client` (`seed_accounts_exhausted`). Muốn đo cao hơn thì nạp thêm học viên seed và đặt `SEED_STUDENTS` tương ứng, ghi rõ vì dữ liệu lớn hơn làm phép đo thận trọng hơn. Lưới an toàn: lỗi tích lũy quá 30% thì k6 tự dừng; bộ lấy mẫu dừng k6 khi RAM trống của máy dưới ngưỡng.

## Bằng chứng (17/11/2026)

Stack đầy đủ + lớp fault, seed `small` (`--seed 42`), `RUN_ID=k6-level1-evidence-20261117`, mặc định (2 phút, 1 VU mỗi hành trình):

| Hành trình | Lượt | Request | Lỗi HTTP ngoài mong đợi | p95 (ms) | Check |
| --- | ---: | ---: | ---: | ---: | --- |
| W1 | 19 | 80 | 0 | 47 | — |
| W2 | 13 | 106 | 0 | 16 | — |
| W3 | 11 | 104 | 0 | 18 | — |
| W4 | 20 | 161 | 0 | 15 | 100% |
| W5 | 16 | 94 | 0 | 46 | — |
| W6 | 16 | 175 | 0 | 20 | 100% |
| W7 | 4 | 17 | 0 | 37 | 100% |

`thresholds_ok=true`. Trong cửa sổ run (09:43:00–09:45:10 UTC), Tempo có trace cho từng hành trình, truy vấn tuần tự: `POST /api/v1/auth/student/login` 34, `POST …/quizzes` 12, `POST /api/v1/student/attempts/:attempt_id/submit` 6, `POST /api/v1/media/:media_id/upload-complete` 35, `POST /api/v1/notifications` 15, `ai-llm-provider POST chat/completions` 15, `POST /internal/v1/media/cleanup` 4 (gốc ở `scheduler-worker`). Tempo không khởi động lại trong lúc truy vấn.

## Test

```bash
node --test 'aiops-platform/load/**/*.test.mjs'
```

Test bằng Node cho phần không phụ thuộc k6: mã hóa UTF-8, base64, body multipart (đọc lại bằng parser multipart thật của Node) và bộ sinh số có seed. Phần gọi HTTP được kiểm bằng run thật ở mục bằng chứng. Công cụ `tools/` có test trên log tổng hợp nhỏ (không cần tải dữ liệu thật): cắt phiên, ánh xạ và gộp sự kiện, chia hold-out, chọn ngày, nén lịch, kẹp think time, sinh Markov tái lập theo seed.
