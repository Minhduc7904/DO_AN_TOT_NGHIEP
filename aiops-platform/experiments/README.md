# experiments — experiment runner và runbook

Chạy trọn một run thí nghiệm bằng một lệnh, từ một **run spec** có phiên bản, và ghi mọi run (kể cả run lỗi hoặc bị ngắt) vào **ledger**. Runner chỉ ghép các công cụ đã có, không chứa logic workload hay fault:

| Bước | Công cụ | Kết quả trong `runs/<run_id>/` |
| --- | --- | --- |
| Preflight | runner | Từ chối khi `run_id` đã dùng, runner khác đang chạy, có container k6, RAM/đĩa thiếu |
| Reset | `docker compose down --volumes`, `up --build -d --wait` (stack đầy đủ + lớp fault, TTL token theo spec); `verifyHealth`, `collectFingerprint` của [`lms/scripts/reset-and-seed.mjs`](../../lms/scripts/reset-and-seed.mjs) | `reset.json` (fingerprint stack sau reset) |
| Dữ liệu seed R-10 | [`lms/scripts/seed-data.mjs`](../../lms/scripts/seed-data.mjs) với `data_seed` của spec (mặc định profile `small`, seed 42): tài khoản `seed-student-N`, `seed-instructor-N`, khóa `5eed…` mà workload dùng. Reset xóa volume nên phải nạp lại mỗi run | `seed-report.json` (số dòng, fingerprint) |
| Kiểm môi trường | `docker inspect` của `identity` (TTL, không bị pause); `fault-control.mjs clear`, `llm reset` | |
| Workload | [`load/run-k6.sh profile`](../load/README.md) với `PROFILE`, `WORKLOAD_SEED`, `PLAN` | `workload/` (`k6-summary.json`, `workload-manifest.json`, `actions.jsonl`, `sessions.jsonl`) |
| Lịch fault (fault run) | [`faults/fault-schedule.mjs run`](../faults/README.md), bật theo mốc `workload_start` mà `profile.js` in ra khi setup xong | `faults.jsonl` |
| Gỡ fault (luôn chạy) | `fault-control.mjs clear`, `llm reset`, `container unpause identity` nếu cần | |
| Export, chất lượng | `aiops-training export`, `quality` ([training/README](../training/README.md)) | `telemetry/` (Parquet, `manifest.json`, `quality-report.json`) |
| Ground truth | `aiops-training ground-truth` (có `verification_checks` trên artifact) | `ground-truth.json` |
| Feature | `aiops-training features` | `telemetry/features/` |

Mỗi run còn có `run-spec.json` (spec đã chuẩn hóa), `run-manifest.json` (commit, cấu hình, thời điểm từng bước, gate) và `runner.log` (đầu ra của mọi lệnh). Thư mục `runs/` không commit; ledger `ledger.jsonl` thì commit.

## Run spec (`run-spec.v1`)

```json
{
  "schema": "run-spec.v1",
  "split": "pilot",
  "repeat_index": 0,
  "workload": { "profile": "normal-mixed", "seed": 12, "plan": "data/plans/<kế hoạch>.json" },
  "fault": { "case": "C2", "align_peak": false, "start_s": 1080, "duration_s": 600 },
  "environment": { "service_token_ttl_s": 60 },
  "data_seed": { "profile": "small", "seed": 42 },
  "replacement_for_run_id": "<run_id bị thay, nếu có>",
  "notes": "…"
}
```

| Trường | Quy tắc |
| --- | --- |
| `split` | `pilot`, `train`, `validation`, `test` |
| `workload.seed` | Theo khoảng của split ([workload-design-v1 mục 11.4](../../docs/processed/architecture/workload-design-v1.md)): pilot 1–999, train 1000–1999, validation 2000–2999, test 3000–3999 |
| `workload.plan` | Tùy chọn, đường dẫn trong `aiops-platform/load/`; mặc định `data/plans/moodle-<profile>-k4-v1.json` |
| `fault` | `null` là run healthy. `case` ∈ C2, C3, C4, C6. `align_peak` đặt cửa sổ fault vào đoạn có nhiều phiên bắt đầu nhất của kế hoạch; `start_s`, `duration_s` ghi đè lịch mặc định của fault manifest (vẫn phải giữ warm-up và recovery); `manifest` đổi file fault manifest |
| `repeat_index` | Fault run của validation/test cần ≥ 1 (lần 1 cho validation, 2..R cho test; [evaluation-protocol-v1 mục 5.3](../../docs/processed/architecture/evaluation-protocol-v1.md)) |
| `environment.service_token_ttl_s` | Mặc định 60 (lớp fault đặt 60 cho mọi run thí nghiệm; C6 cần giá trị này) |
| `data_seed` | Dữ liệu seed R-10; mặc định `small`/42. Mọi run của cùng split dùng cùng giá trị ([evaluation-protocol-v1 mục 5.5](../../docs/processed/architecture/evaluation-protocol-v1.md)) |
| `run_id` | Tùy chọn; mặc định `<split>-<case|healthy>-<profile>-s<seed>-<UTC>`. Không bao giờ dùng lại |

Ví dụ ở [`specs/`](specs/).

## Gate

`run-manifest.json` → `gates`:

- `execution` (evaluation-protocol-v1 mục 8.1): `pass` khi reset và nạp dữ liệu seed thành công (run `--no-reset` không bao giờ đạt), môi trường đúng spec, k6 thoát 0 hoặc 99 (99 là threshold của profile không đạt, bình thường ở fault run), có `k6-summary.json` với cửa sổ workload và `dropped_iterations` = 0 (kể cả fault run: iteration bị bỏ nghĩa là k6 hết VU dựng sẵn, kế hoạch phiên lệch và `plan_reproducible = false`, xem [load/README](../load/README.md); fault làm phiên dài ra nên fault run cần VU dựng sẵn nhiều hơn run healthy), lịch fault thoát 0, bước gỡ fault thành công. Lý do không đạt ghi ở `reasons`.
- `data_quality`: `overall_status` của quality report (`pass | partial | fail`).
- `ground_truth`: `run_status` của `RunGroundTruth` (`valid | invalid | failed`).

`status` của run: `completed` (mọi bước đã chạy), `failed` (một bước lỗi), `aborted` (bị ngắt). Run `failed`/`aborted` hoặc gate không đạt **không xóa**; vẫn có `RunGroundTruth` nếu k6 kịp ghi tóm tắt (mục 8.1). Muốn chạy lại thì tạo spec mới có `run_id` mới và `replacement_for_run_id` (mục 8.6): runner kiểm run bị thay có trong ledger, đã không đạt gate thực thi hoặc chất lượng, và cùng split/case/`repeat_index`/profile. Không thay run vì kết quả của detector/RCA.

## Ledger (`ledger.jsonl`)

Một dòng JSON mỗi sự kiện, chỉ ghi thêm: `run.started` (split, case, `repeat_index`, profile, seed, commit, thư mục run) khi bắt đầu, `run.finished` (status, các gate, cửa sổ workload, sha256 của kế hoạch và run manifest) khi kết thúc. Run chết đột ngột (mất điện, `kill -9`) chỉ có dòng `run.started`, vẫn thấy được khi audit.

## Runbook

### 1. Chuẩn bị (một lần)

```bash
# Từ thư mục gốc repository; docker-compose/.env tạo từ .env.example (không commit)
cp docker-compose/.env.example docker-compose/.env
cd aiops-platform/training && uv sync && cd -
cd lms && pnpm install --frozen-lockfile && cd -   # seeder cần thư viện `pg`
# Kế hoạch phiên Moodle (không commit): xem aiops-platform/load/README.md mục dữ liệu
ls aiops-platform/load/data/plans/
free -h    # cột available nên ≥ 4 GB
```

Stack không cần dựng sẵn: bước reset của runner dựng lại từ volume trống. Runner xóa volume của project (`down --volumes`), kể cả Prometheus/Tempo/Loki, nên **mọi run trước phải export xong** trước khi chạy run mới (runner tự export ở cuối mỗi run).

### 2. Chạy một run

Chạy trong `tmux` hoặc `screen`: một run kéo dài hơn một giờ, mất terminal thì runner nhận SIGHUP và dừng (vẫn gỡ fault, ghi `aborted`).

```bash
node aiops-platform/experiments/run-experiment.mjs aiops-platform/experiments/specs/pilot-healthy-normal-mixed.json \
  --compose-env-file docker-compose/.env --confirm-reset aiops-lms
```

| Tham số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `--compose-env-file` | bắt buộc | File biến môi trường của Compose |
| `--confirm-reset` | bắt buộc khi reset | Phải trùng `--project`: xác nhận cho phép xóa volume |
| `--project` | `aiops-lms` | Tên project Compose (`aiops-lms` hoặc `aiops-lms-<tên>`); truyền vào `fault-control` qua `COMPOSE_PROJECT_NAME` |
| `--no-reset` | tắt | Chỉ để thử; không nạp lại dữ liệu seed, gate thực thi ghi `reset_skipped`, run không dùng cho dataset |
| `--min-available-mb` | 4000 | RAM trống tối thiểu (MemAvailable) trước khi chạy |
| `--min-disk-mb` | 5000 | Đĩa trống tối thiểu ở thư mục `runs/` |
| `--setup-timeout-s` | 600 | Chờ mốc `workload_start` trong log k6 |
| `--fault-grace-s` | 300 | Chờ lịch fault kết thúc sau khi k6 xong |
| `--export-timeout-s` | 60 | Timeout mỗi lời gọi HTTP của bước export (Prometheus, Tempo, Loki); mặc định của `aiops-training export` là 15 s, quá ngắn cho truy vấn log cả run khi máy thiếu RAM. Timeout áp cho từng lần tải trace nên khi Tempo treo, export chờ lâu hơn trước khi bỏ (vẫn trong giới hạn 3 giờ của bước) |
| `--runs-dir`, `--ledger` | `aiops-platform/experiments/runs`, `ledger.jsonl` | Đổi nơi ghi |

Runner không chuyển biến cấu hình k6 của shell (`PLAN`, `VUS`, `DURATION`…) vào k6: mọi tham số workload lấy từ spec. Một run 48 phút cộng reset (2–5 phút), setup k6 (1–2 phút), export (15–25 phút cho trace): khoảng 1,2–1,5 giờ. Lệnh in một dòng JSON tóm tắt; mã thoát 0 khi `completed`.

### 3. Đọc kết quả

```bash
tail -2 aiops-platform/experiments/ledger.jsonl
jq '{status, gates, error}' aiops-platform/experiments/runs/<run_id>/run-manifest.json
less aiops-platform/experiments/runs/<run_id>/runner.log
# Fault run cần đối chiếu ground truth độc lập (Gate M3): chạy ngay sau run, TRƯỚC khi chạy run sau,
# vì reset của run sau xóa volume Prometheus/Tempo/Loki. Ghi runs/<run_id>/raw-verification.json; thoát 0 khi đạt.
node aiops-platform/experiments/verify-raw-ground-truth.mjs aiops-platform/experiments/runs/<run_id>
```

### 4. Khi run lỗi hoặc bị ngắt

- `Ctrl+C`, SIGTERM hoặc SIGHUP: runner dừng container k6 bằng một SIGTERM (`docker stop -t 90`, để k6 kịp ghi tóm tắt), gửi SIGTERM cho lịch fault (lịch tự gỡ fault), chạy bước gỡ fault, ghi `aborted`, giữ phần artifact đã có và `RunGroundTruth`; không export. Tiến trình con chạy ở process group riêng nên tín hiệu của terminal chỉ tới runner.
- Sau khi runner chết đột ngột: kiểm `node aiops-platform/faults/fault-control.mjs status`, chạy `clear`, `llm reset`, `container unpause identity` nếu cần; xóa `runs/.runner.lock` nếu tiến trình ghi trong đó không còn.
- Không sửa hay xóa dòng ledger; chạy lại bằng spec mới (`run_id` mới, `replacement_for_run_id`).

## Test

```bash
node --test aiops-platform/experiments/*.test.mjs
```

Test thay mọi tác động ra ngoài (docker, k6, uv, đồng hồ) bằng ngữ cảnh ghi lại lời gọi; các bước dùng docker thật được kiểm chứng bằng run thật (mục bằng chứng trong PR).
