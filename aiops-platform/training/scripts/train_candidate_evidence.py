"""Căn cứ train cho detection-candidates.v2: phân vị điểm (gộp mọi (cửa sổ, service), nội suy
tuyến tính) và số incident/giờ trên 4 run train khỏe cho từng ứng viên ngưỡng, cửa sổ 60 s.

Chạy từ aiops-platform/training (cần anomaly/, incident/ của task-01, task-03 tuần 16):
  uv run python <file> <runs_dir> <dataset> <out_dir>
Chỉ đọc run train (split train, case rỗng) của dataset; không chạm validation.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

runs_dir, dataset, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
manifest = json.loads(dataset.read_text())
train = sorted(
    s["run_id"] for s in manifest["slots"]
    if s.get("run_id") and s["split"] == "train" and not s.get("case")
)
out.mkdir(parents=True, exist_ok=True)
model = out / "iforest-w60.joblib"
dev = json.loads(Path("configs/detector-dev-v1.json").read_text())
v2 = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else None


def run(*args):
    result = subprocess.run(["uv", "run", "aiops-training", *args], capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(result.stderr[-500:])
    return result.stdout


incident_cfg = out / "incident-step1.json"
incident_cfg.write_text(json.dumps({"incident_config_version": "evidence-step1", "incident": {
    "persistence_windows": 5, "recovery_windows": 5, "merge_gap_seconds": 120,
    "correlation_window_seconds": 300, "max_chain_gap_seconds": 120}}))


def scores(detector, config, model_arg=()):
    values, hours, incidents = [], 0.0, 0
    for run_id in train:
        features = runs_dir / run_id / "telemetry" / "features"
        target = out / config.stem / run_id
        run("detect", str(features), "--detector", detector, "--config", str(config), *model_arg,
            "--out", str(target))
        table = pq.read_table(target / f"anomalies-{detector}.parquet").to_pylist()
        post = [r for r in table if not r["warmup"]]
        values += [r["score"] for r in post
                   if r["score"] is not None and r["flagged"] is not None
                   and r["reason"] != "telemetry_silent"]
        start = min(r["window_start"] for r in post)
        end = max(r["window_end"] for r in post)
        hours += (end - start).total_seconds() / 3600
        record = json.loads(run("incidents", str(target / f"anomalies-{detector}.parquet"),
                                "--config", str(incident_cfg)))
        incidents += record["incidents"]
    return np.array(values, dtype=float), incidents, hours


def config_with(name, section):
    cfg = json.loads(json.dumps(dev))
    cfg["detector_config_version"] = f"evidence-{name}"
    cfg["detectors"].update(section)
    path = out / f"{name}.json"
    path.write_text(json.dumps(cfg))
    return path


report = {"train_runs": train, "window_s": 60, "incident_config": json.loads(incident_cfg.read_text())}
quant = [0.99, 0.995, 0.999]
# Isolation Forest và fused: phân vị trên điểm, rồi incident/giờ ở từng ngưỡng phân vị.
for name, detector, section, model_arg in [
    ("iforest", "iforest", {"iforest": dev["detectors"]["iforest"]}, ("--model", str(model))),
    ("fused-equal", "fused", {"fused": {"threshold": 3, "weights": {"metrics": 1/3, "traces": 1/3, "logs": 1/3}}}, ()),
    ("fused-442", "fused", {"fused": {"threshold": 3, "weights": {"metrics": 0.4, "traces": 0.4, "logs": 0.2}}}, ()),
]:
    base = config_with(name, section)
    values, _, _ = scores(detector, base, model_arg)
    qs = {str(q): float(np.quantile(values, q, method="linear")) for q in quant}
    rows = {}
    for q, threshold in qs.items():
        sec = json.loads(json.dumps(section))
        sec[detector]["threshold"] = threshold
        cfg = config_with(f"{name}-q{q}", sec)
        _, incidents, hours = scores(detector, cfg, model_arg)
        rows[q] = {"threshold": threshold, "incidents": incidents, "per_hour": incidents / hours}
    report[name] = {"n_windows": int(values.size), "quantiles": qs, "train": rows}
# robust z (lưới v1) và ngưỡng tĩnh (3 bộ).
rows = {}
for z in (3, 4, 5):
    cfg = config_with(f"robust_z-{z}", {"robust_z": {"threshold": z}})
    _, incidents, hours = scores("robust_z", cfg)
    rows[str(z)] = {"incidents": incidents, "per_hour": incidents / hours}
report["robust_z"] = {"train": rows}
if v2:
    rows = {}
    for name, thresholds in v2["step2"]["static"]["threshold_sets"].items():
        cfg = config_with(f"static-{name}", {"static": {"thresholds": thresholds}})
        _, incidents, hours = scores("static", cfg)
        rows[name] = {"incidents": incidents, "per_hour": incidents / hours}
    report["static"] = {"train": rows}
report["train_hours"] = hours
(out / "train-evidence.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps(report, indent=1, ensure_ascii=False))
