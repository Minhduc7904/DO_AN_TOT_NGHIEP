# training — RCA engine (Python)

Phần chính của đề tài: từ telemetry của một run thí nghiệm đi tới phát hiện bất thường và xếp hạng nguyên nhân gốc. Thiết kế: [analysis blueprint v1](../../docs/processed/architecture/analysis-anomaly-rca-blueprint-v1.md); schema dữ liệu: [telemetry and ground-truth schema v1](../../docs/processed/architecture/telemetry-and-ground-truth-schema-v1.md).

| Module | Trạng thái |
| --- | --- |
| `telemetry/adapters` — export Prometheus, Tempo, Loki theo run | **Có** (tuần 13) |
| `telemetry/validation` — data-quality check (`TelemetryQualityReport`) | **Có** (tuần 13) |
| `features`, `anomaly`, `incident`, `graph`, `rca`, `evaluation` | Tuần 14 trở đi |

## Cài đặt

Cần [uv](https://docs.astral.sh/uv/) (repo dùng 0.12.5) và Python 3.12.

```bash
cd aiops-platform/training
uv sync            # tạo .venv từ uv.lock
uv run pytest      # test không cần stack
uv run ruff check . && uv run ruff format --check .
```

## Export telemetry của một run

Chạy **ngay sau run** vì Prometheus, Tempo, Loki của testbed chỉ giữ dữ liệu 24 giờ (lệnh từ chối cửa sổ đã quá 24 giờ).

```bash
cd aiops-platform/training
# Lấy cửa sổ từ tóm tắt k6 (cộng thêm 30 giây cuối vì telemetry tới trễ)
uv run aiops-training export --k6-summary ../load/results/<run_id>/k6-summary.json

# Hoặc tự khai báo cửa sổ
uv run aiops-training export --run-id r1 --start 2026-11-17T09:43:00Z --end 2026-11-17T09:45:40Z
```

Kết quả ở `artifacts/<run_id>/` (không commit):

| Tệp | Nội dung |
| --- | --- |
| `metrics.parquet` | Mỗi dòng một điểm của một series Prometheus, bước 5 giây: counter tích lũy, gauge, bucket/sum/count của histogram (giữ giá trị thô để tự tính rate và percentile) |
| `spans.parquet` | Mỗi dòng một span của các trace trong cửa sổ (trừ trace nhiễu) |
| `logs.parquet` | Mỗi dòng một log (trừ access log của probe `/ready`, `/health`) |
| `manifest.json` | `run_id`, cửa sổ UTC, sha256 và số dòng từng tệp, truy vấn đã dùng, thống kê cắt bớt và lỗi |

Cột của từng bảng khai báo ở `src/aiops_training/telemetry/schema.py` (`telemetry.v2`); ý nghĩa từng cột: [telemetry data dictionary v2](../../docs/processed/architecture/telemetry-data-dictionary-v2.md).

### Tùy chọn

| Tham số | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `--out` | `artifacts` | Thư mục kết quả |
| `--prometheus-url`, `--tempo-url`, `--loki-url` | `http://127.0.0.1:9090`, `:3200`, `:3100` | Backend (cổng loopback của stack) |
| `--step-seconds` | `5` | Bước lấy mẫu metric (bằng chu kỳ scrape) |
| `--max-traces` | `60000` | Giới hạn số trace tải về; vượt thì chọn cách đều theo thời gian và ghi số bị bỏ (`dropped_by_budget`). Trước 23/11/2026 là `20000`: run `healthy-spike` (~38.000 trace không nhiễu) bị bỏ 47% |
| `--trace-delay-ms` | `20` | Nghỉ giữa hai lần tải trace |
| `--include-noise-traces` | tắt | Giữ cả trace nhiễu (probe, thăm dò DB của `scheduler-worker`) |
| `--include-probe-logs` | tắt | Giữ cả access log của probe |
| `--timeout-seconds` | `15` | Timeout mỗi lời gọi HTTP |

## Kiểm chất lượng artifact

```bash
uv run aiops-training quality artifacts/<run_id>      # ghi artifacts/<run_id>/quality-report.json
```

In bảng mỗi runtime một dòng (số metric, nhịp tim, gap, span, log, cờ) và trả `pass`/`partial`/`fail` (mã thoát 1 chỉ khi `fail`). Định nghĩa từng trường, cờ `telemetry_silent` và quy tắc trạng thái: [telemetry data dictionary v2](../../docs/processed/architecture/telemetry-data-dictionary-v2.md) mục 8.

## Ground truth của run (`RunGroundTruth`)

```bash
uv run aiops-training ground-truth \
  --k6-summary ../load/results/<RUN_ID>/k6-summary.json \
  --case C2 --fault-log ../load/results/<RUN_ID>/faults.jsonl \
  --fault-manifest ../faults/manifests/fault-manifest-v2.json \
  --artifact artifacts/<RUN_ID> --out artifacts/<RUN_ID>/ground-truth.json
```

Bỏ `--case`, `--fault-log` cho run healthy. Bản ghi theo [telemetry-and-ground-truth-schema-v1](../../docs/processed/architecture/telemetry-and-ground-truth-schema-v1.md) mục 8; `fault_start`/`fault_end` lấy từ nhật ký của `fault-schedule.mjs` (không suy ra từ bất thường). Có `--artifact` thì chạy `verification_checks` (mục 9.2 của tài liệu): fault bật thành công mà không thấy triệu chứng tối thiểu thì `run_status = invalid`. Mã thoát 0 khi `valid`.

## Đặc trưng theo cửa sổ (feature pipeline v1)

```bash
uv run aiops-training features ../experiments/runs/<RUN_ID>/telemetry   # → .../telemetry/features/
# Baseline healthy: fit chỉ trên run train healthy của dataset, áp cho mọi run, kiểm leakage.
# Cửa sổ chỉ giữ tới (mốc bắt đầu truy vấn − 10 s): mốc từ query_started_at của manifest export,
# hoặc run-manifest.json của runner; không có thì truyền --query-started-at <ISO-8601>.
# fit/check đọc <runs-dir>/<run_id>/telemetry/features; manifest export phải nằm ở thư mục cha.
uv run aiops-training fit-baseline --dataset ../experiments/datasets/dataset-v0.json --runs-dir ../experiments/runs --out baselines/dataset-v0.json
uv run aiops-training apply-baseline ../experiments/runs/<RUN_ID>/telemetry/features --baseline baselines/dataset-v0.json
uv run aiops-training check-leakage --dataset ../experiments/datasets/dataset-v0.json --runs-dir ../experiments/runs --baseline baselines/dataset-v0.json
```

Cửa sổ 60 s bước 15 s:

- `service_windows.parquet`: RED, CPU, bộ nhớ, tỉ lệ lỗi trace/log, cờ thiếu modality, `traces_truncated`, `telemetry_silent`, `warmup`;
- `edge_windows.parquet`: số lời gọi, tỉ lệ lỗi/timeout, độ trễ trung bình/p95/p99 theo cạnh;
- `queue_windows.parquet`: message sẵn sàng/chưa ack và consumer theo hàng đợi RabbitMQ (cạnh async).

`feature_config_version` (`feature.v1`) và `noise_filter_version` (`noise.v1`) ghi trong `features-manifest.json`, áp như nhau cho mọi run. `apply-baseline` ghi thêm `baseline-apply.json` (sha256 của baseline đã dùng). Cột `run_id` chỉ là khóa (tên run mã hóa split và case), detector phải bỏ. Cột, bộ lọc nhiễu, quy tắc thời điểm, baseline và kiểm leakage: [telemetry-data-dictionary-v2](../../docs/processed/architecture/telemetry-data-dictionary-v2.md) mục 9.

## Detector bất thường (`anomaly/`)

Bốn loại điểm theo (cửa sổ, service), cùng đầu ra, để E1 chỉ đổi detector (evaluation-protocol-v1 mục 17.8):

| `--detector` | Đầu vào | Điểm | Vượt ngưỡng khi |
| --- | --- | --- | --- |
| `static` | Giá trị thô | max(giá trị / ngưỡng) với tín hiệu tăng; max(ngưỡng / giá trị) với `consumers` | điểm > 1 |
| `robust_z` | z của baseline healthy | max z có hướng | điểm > `threshold` |
| `iforest` | Vector z theo service, model fit trên train khỏe | −`score_samples` ∈ (0, 1] | điểm > `threshold` |
| `fused` | z theo modality | trung bình có trọng số của max(0, max z) từng modality có dữ liệu | điểm > `threshold` |

```bash
# Isolation Forest: một model mỗi service, chỉ từ run train khỏe (case rỗng) của dataset.
uv run aiops-training fit-iforest --dataset ../experiments/datasets/dataset-v0.json --runs-dir ../experiments/runs \
  --features-subdir telemetry/features --config configs/detector-dev-v1.json \
  --out models/iforest-w60.joblib   # + models/iforest-w60.joblib.json
# Chạy trên thư mục feature đã apply-baseline; ghi anomalies-<detector>.parquet + .json (lineage).
uv run aiops-training detect ../experiments/runs/<RUN_ID>/telemetry/features --detector robust_z --config configs/detector-dev-v1.json
uv run aiops-training detect ../experiments/runs/<RUN_ID>/telemetry/features --detector iforest --config configs/detector-dev-v1.json --model models/iforest-w60.joblib
```

Quy tắc dùng chung (chi tiết ở docstring `anomaly/signals.py`, `anomaly/detectors.py`, `anomaly/iforest.py`):

- **Tín hiệu** (`signals.v1`): triệu chứng lỗi, độ trễ, hàng đợi ứ, mất consumer. Không dùng tín hiệu tải (`request_rate`, `call_count`, CPU, bộ nhớ). Trace chỉ dùng `trace_error_rate`, không dùng số đếm tuyệt đối (bảng F, hệ quả (c)).
- **Quy về service:** cạnh theo phía gọi, hàng đợi theo consumer. `consumers` chỉ xét hàng đợi thường; hàng đợi dead-letter không có consumer theo thiết kế.
- **`telemetry_silent`:** luôn vượt ngưỡng ở cả bốn loại điểm (`reason = telemetry_silent`), không đi qua z.
- **Cửa sổ không dữ liệu:** `flagged` rỗng chỉ khi service không có giá trị triệu chứng nào. Mỗi dòng ghi thêm `top_key` (tín hiệu làm cửa sổ vượt) và `observed_keys` (tín hiệu có giá trị) để lifecycle áp luật cửa sổ không dữ liệu theo từng tín hiệu.
- **Điểm hợp nhất:** chỉ fallback khi modality thật sự không có dữ liệu; trọng số chuẩn hóa lại trên modality còn lại.
- **Isolation Forest:** vector = max z có hướng của từng tín hiệu trên các thực thể của service; chiều thiếu điền 0 (median của train). Hyperparameter và seed đọc từ config detector (`detectors.iforest`). Artifact ghi thứ tự feature, baseline (scaler, phải fit trên đúng các run fit model), hyperparameter, seed, run fit, `window_s`, phiên bản và sha256 config, code commit, sha256 model. `detect` từ chối khi thiếu `baseline-apply.json`, khi bảng z sinh từ manifest feature khác bản hiện có, hoặc khi model khác `window_s`, khác baseline, khác bộ tín hiệu.

`configs/detector-dev-v1.json` chỉ là giá trị phát triển để kiểm code chạy đúng. Ngưỡng dùng cho validation và test khai báo ở `detection-candidates.v2` và chọn ở task-06 tuần 16.

Số đo (25/11/2026, `/usr/bin/time`, baseline luật thang đo v2): `fit-iforest` trên 4 run train 6,9–7,0 s, RSS 255–266 MB (cửa sổ 60 s: 668 cửa sổ mỗi service; 30 s: tương tự); `detect` trên một run 48 phút (2.101–2.123 cặp cửa sổ–service) 2–11 s, RSS 230–270 MB mỗi detector. Chạy hết chuỗi feature → detector → incident → harness trên 4 fault run pilot (C2, C3, C4, C6) và 1 run pilot khỏe với config phát triển: ngưỡng tĩnh, robust z, fused khớp 4/4 fault run, không báo giả; Isolation Forest ngưỡng 0,6 báo giả 4,4 lần/giờ. Pilot chỉ dùng để kiểm code, không để chọn ngưỡng.

## Incident lifecycle (`incident/`)

```bash
# Gom cửa sổ bất thường của một detector thành incident; ghi incidents-<detector>.json cạnh đầu vào.
uv run aiops-training incidents <dir>/anomalies-robust_z.parquet --config configs/incident-dev-v1.json
```

- **Máy trạng thái theo service** `NORMAL → SUSPECTED → OPEN → RECOVERING → RESOLVED`, persistence **theo từng khóa bằng chứng**: mỗi cửa sổ vượt cộng vào chuỗi của các tín hiệu mà detector coi là bất thường (`evidence_keys`); chuỗi của một tín hiệu chỉ đứt khi một cửa sổ quan sát được tín hiệu đó (`observed_keys`) mà nó bình thường. Cửa sổ không quan sát được tín hiệu (cạnh thưa của C3 giữa hai lời gọi) hay không có dữ liệu thì bỏ qua. Bằng chứng của các tín hiệu khác nhau không cộng dồn; hai cửa sổ vượt liên tiếp của cùng tín hiệu cách nhau quá `max_chain_gap_seconds` thì chuỗi bắt đầu lại. Đầu vào phải là `anomaly-record.v2` (có cột bằng chứng). Mở đợt khi một chuỗi đủ `persistence_windows`; hồi phục sau `recovery_windows` cửa sổ không vượt có dữ liệu.
- **Thời điểm:** `detected_at` = `window_end` của cửa sổ hoàn tất persistence + `available_after_s` (10 s); `estimated_start_time` = `window_end` của cửa sổ vượt đầu tiên − bước 15 s; `resolved_at` rỗng nếu chưa hồi phục tới cuối run.
- **Gộp (tạm thời, theo thời gian; đồ thị v2 thay ở tuần 17):** đợt mở trước khi incident đang xét hồi phục + `merge_gap_seconds`, hoặc trong `correlation_window_seconds` kể từ `detected_at` của incident, nhập vào incident đó.
- **Record `incident-record.v1`:** `threshold` của detector; `incident_id` xác định (băm run, detector, ngưỡng, phiên bản và sha256 nội dung config detector/incident, window/persistence, cửa sổ mở); `open_at_run_end`, `duration_s` để chẩn đoán incident gộp quá rộng, `affected_services`, `first_symptom`, `trigger_reason`, `peak_score` (vô cùng ghi `peak_score_infinite`), từng đợt và timeline trỏ tới (service, tín hiệu, thực thể, cửa sổ, điểm), lineage tới detector, feature, baseline, model.

`configs/incident-dev-v1.json` chỉ là giá trị phát triển; tham số incident khai báo ở `detection-candidates.v2`.

## Cách export bảo vệ Tempo

Tempo của testbed bị giới hạn 512 MiB và từng bị OOM khi nhận truy vấn dồn dập. Adapter:

1. tìm trace theo lát 30 giây, chia đôi lát khi kết quả chạm giới hạn 1000;
2. loại trace nhiễu theo tên span gốc ngay ở bước tìm, không tải về (số bị loại ghi ở `stats.traces.noise_excluded`);
3. tải từng trace **tuần tự**, nghỉ 20 ms giữa hai lần;
4. trace lỗi (thường do Tempo khựng vài giây) được dời xuống cuối và tải lại một lượt sau 10 giây; 5 lỗi liên tiếp thì dừng hẳn (`aborted`) để không dội thêm tải;
5. mọi trường hợp cắt bớt đều ghi trong manifest (`dropped_by_budget`, `search_limit_hit`, `fetch_errors`, `error_samples`), không bỏ âm thầm.

Một nguồn lỗi không chặn hai nguồn còn lại: modality đó có trạng thái `error` trong `modality_availability`, thông điệp lỗi ở `errors`, và lệnh trả mã 1.

## Bằng chứng (17/11/2026)

Run `k6-level1-evidence-20261117` (k6 mức 1, 2 phút, stack đầy đủ + lớp fault), cửa sổ 09:43:01–09:45:37 UTC:

| Modality | Bản ghi | Ghi chú |
| --- | ---: | --- |
| Metrics | 152 608 | 16 họ metric, 4 769 series; 11/11 runtime |
| Traces | 8 943 span | 1 725 trace ứng viên, 1 004 trace nhiễu bị loại, 721/721 trace tải về; 11/11 runtime |
| Logs | 1 649 | 1 trang; 307 access log probe bị loại; 7 runtime (4 worker chỉ có log probe) |

Thời gian chạy 82 giây; Tempo không khởi động lại. Ở một lần chạy trước, 4/721 trace bị `ReadTimeout` do Tempo khựng (gọi lại thủ công chỉ mất 0,1 s) — từ đó có cơ chế tải lại ở cuối.

## Giới hạn

- Tải trace mất khoảng 0,1 s mỗi trace: run 30 phút với tải mức 1 (~6 trace/s không tính nhiễu) cần khoảng 15–20 phút export.
- Chưa chuẩn hóa sang bảng feature (tuần 14).
- Bộ đếm lỗi mới xuất hiện giữa cửa sổ có điểm đầu không nằm trong `rate()` của Prometheus; artifact giữ giá trị thô nên feature stage tự xử lý.
