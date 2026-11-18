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
- Chưa ghi nhật ký từng thao tác của VU (mức 2).

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
