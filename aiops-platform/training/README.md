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
# Cửa sổ 30 s (tuần 16): thư mục riêng features-w30/, baseline riêng; baseline lệch cửa sổ bị từ chối.
uv run aiops-training features ../experiments/runs/<RUN_ID>/telemetry --window-s 30   # → .../telemetry/features-w30/
uv run aiops-training fit-baseline --dataset ../experiments/datasets/dataset-v0.json --runs-dir ../experiments/runs \
  --features-subdir telemetry/features-w30 --out baselines/dataset-v0-w30.json
uv run aiops-training check-leakage --dataset ../experiments/datasets/dataset-v0.json --runs-dir ../experiments/runs \
  --features-subdir telemetry/features-w30 --baseline baselines/dataset-v0-w30.json
```

Baseline dùng cho detector từ tuần 16: `baselines/dataset-v0-w60.json` và `baselines/dataset-v0-w30.json`, luật thang đo v2 (thang đo không nhỏ hơn sàn theo đơn vị). `baselines/dataset-v0.json` (luật v1) giữ để tái lập tuần 15.

Cửa sổ 60 s bước 15 s:

- `service_windows.parquet`: RED, CPU, bộ nhớ, tỉ lệ lỗi trace/log, cờ thiếu modality, `traces_truncated`, `telemetry_silent`, `warmup`;
- `edge_windows.parquet`: số lời gọi, tỉ lệ lỗi/timeout, độ trễ trung bình/p95/p99 theo cạnh;
- `queue_windows.parquet`: message sẵn sàng/chưa ack và consumer theo hàng đợi RabbitMQ (cạnh async).

`feature_config_version` (`feature.v1`) và `noise_filter_version` (`noise.v1`) ghi trong `features-manifest.json`, áp như nhau cho mọi run. `apply-baseline` ghi thêm `baseline-apply.json` (sha256 của baseline đã dùng). Cột `run_id` chỉ là khóa (tên run mã hóa split và case), detector phải bỏ. Cột, bộ lọc nhiễu, quy tắc thời điểm, baseline và kiểm leakage: [telemetry-data-dictionary-v2](../../docs/processed/architecture/telemetry-data-dictionary-v2.md) mục 9.

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
