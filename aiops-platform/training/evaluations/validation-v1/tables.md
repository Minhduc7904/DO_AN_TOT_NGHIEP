# Bảng chọn cấu hình phát hiện trên validation (sinh tự động)

Sinh bằng `uv run aiops-training select-detectors report`; không sửa tay.

## Ledger

- Số dòng ledger: 64; lần chấm: 27; dùng lại: 1; lựa chọn: 5.
- Commit của các lần chấm: `175e1cf`, `4b2c3dd`, `d5f4c35` (đều chứa merge commit `f57c322` của PR #103).
- Lần chấm đầu: 2026-11-25T08:19:33.817772Z (`w30-p3-z3`).

## Bước 1: 12 tổ hợp robust z

| Hạng | Tổ hợp | W (s) | P | Ngưỡng | late_tolerance (s) | Fault khớp | Báo động giả | Giờ | BĐG/giờ | Đạt ≤ 1/giờ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `w30-p4-z5` **(chọn)** | 30 | 4 | 5,000 | 75 | 4/4 | 0 | 3,54 | 0 | có |
| 2 | `w60-p5-z5` | 60 | 5 | 5,000 | 120 | 4/4 | 0 | 3,49 | 0 | có |
| 3 | `w60-p6-z5` | 60 | 6 | 5,000 | 135 | 4/4 | 0 | 3,47 | 0 | có |
| 4 | `w60-p6-z4` | 60 | 6 | 4,000 | 135 | 4/4 | 0 | 3,47 | 0 | có |
| 5 | `w30-p3-z5` | 30 | 3 | 5,000 | 60 | 4/4 | 1 | 3,56 | 0,28 | có |
| 6 | `w30-p4-z4` | 30 | 4 | 4,000 | 75 | 4/4 | 1 | 3,54 | 0,28 | có |
| 7 | `w60-p5-z4` | 60 | 5 | 4,000 | 120 | 4/4 | 1 | 3,49 | 0,29 | có |
| 8 | `w60-p6-z3` | 60 | 6 | 3,000 | 135 | 4/4 | 1 | 3,47 | 0,29 | có |
| 9 | `w30-p3-z4` | 30 | 3 | 4,000 | 60 | 4/4 | 2 | 3,56 | 0,56 | có |
| 10 | `w30-p4-z3` | 30 | 4 | 3,000 | 75 | 4/4 | 2 | 3,54 | 0,56 | có |
| 11 | `w60-p5-z3` | 60 | 5 | 3,000 | 120 | 4/4 | 3 | 3,49 | 0,86 | có |
| 12 | `w30-p3-z3` | 30 | 3 | 3,000 | 60 | 4/4 | 4 | 3,56 | 1,12 | không |

Luật: cap_met; hòa cuối theo threshold_desc; tổ hợp chọn `w30-p4-z5`, đạt điều kiện: có.

## Bước 2a: tham số incident

| Hạng | Tổ hợp | W (s) | P | Ngưỡng | late_tolerance (s) | Fault khớp | Báo động giả | Giờ | BĐG/giờ | Đạt ≤ 1/giờ | tie_rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `merge300-chain120` **(chọn)** | 30 | 4 | 5,000 | 75 | 4/4 | 0 | 3,54 | 0 | có | 1 |
| 2 | `merge300-chain300` | 30 | 4 | 5,000 | 75 | 4/4 | 0 | 3,54 | 0 | có | 2 |
| 3 | `merge120-chain120` | 30 | 4 | 5,000 | 75 | 4/4 | 0 | 3,54 | 0 | có | 3 |
| 4 | `merge120-chain300` | 30 | 4 | 5,000 | 75 | 4/4 | 0 | 3,54 | 0 | có | 4 |

Luật: cap_met; hòa cuối theo tie_rank_asc; tổ hợp chọn `merge300-chain120`, đạt điều kiện: có.

## Ngưỡng phân vị trên train

| Điểm@phân vị | Ngưỡng |
| --- | --- |
| `fused-equal@0.99` | 0,7720 |
| `fused-equal@0.995` | 1,3750 |
| `fused-equal@0.999` | 1,7691 |
| `fused-w442@0.99` | 0,9362 |
| `fused-w442@0.995` | 1,6500 |
| `fused-w442@0.999` | 2,1229 |
| `iforest@0.99` | 0,7440 |
| `iforest@0.995` | 0,7800 |
| `iforest@0.999` | 0,8420 |

Cửa sổ 30 s; iforest: 7436 điểm, fused-equal: 7436 điểm, fused-w442: 7436 điểm; baseline `08ddaefb4c0e`, model `7df97006fd97`.

## Bước 2b: Ngưỡng tĩnh

| Hạng | Tổ hợp | W (s) | P | Ngưỡng | late_tolerance (s) | Fault khớp | Báo động giả | Giờ | BĐG/giờ | Đạt ≤ 1/giờ | tie_rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `static-loose` **(chọn)** | 30 | 4 | bộ ngưỡng | 75 | 4/4 | 0 | 3,54 | 0 | có | 1 |
| 2 | `static-medium` | 30 | 4 | bộ ngưỡng | 75 | 4/4 | 0 | 3,54 | 0 | có | 2 |
| 3 | `static-strict` | 30 | 4 | bộ ngưỡng | 75 | 4/4 | 0 | 3,54 | 0 | có | 3 |

Luật: cap_met; hòa cuối theo tie_rank_asc; tổ hợp chọn `static-loose`, đạt điều kiện: có.

## Bước 2b: Isolation Forest

| Hạng | Tổ hợp | W (s) | P | Ngưỡng | late_tolerance (s) | Fault khớp | Báo động giả | Giờ | BĐG/giờ | Đạt ≤ 1/giờ | tie_rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `iforest-q0.995` **(chọn)** | 30 | 4 | 0,780 | 75 | 4/4 | 1 | 3,54 | 0,28 | có | 2 |
| 2 | `iforest-q0.99` | 30 | 4 | 0,744 | 75 | 4/4 | 1 | 3,54 | 0,28 | có | 3 |
| 3 | `iforest-q0.999` | 30 | 4 | 0,842 | 75 | 2/4 | 0 | 3,54 | 0 | có | 1 |

Luật: cap_met; hòa cuối theo tie_rank_asc; tổ hợp chọn `iforest-q0.995`, đạt điều kiện: có.

## Bước 2b: Điểm hợp nhất

| Hạng | Tổ hợp | W (s) | P | Ngưỡng | late_tolerance (s) | Fault khớp | Báo động giả | Giờ | BĐG/giờ | Đạt ≤ 1/giờ | tie_rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `fused-equal-q0.999` **(chọn)** | 30 | 4 | 1,769 | 75 | 4/4 | 0 | 3,54 | 0 | có | 1 |
| 2 | `fused-w442-q0.999` | 30 | 4 | 2,123 | 75 | 4/4 | 0 | 3,54 | 0 | có | 2 |
| 3 | `fused-equal-q0.995` | 30 | 4 | 1,375 | 75 | 4/4 | 1 | 3,54 | 0,28 | có | 3 |
| 4 | `fused-w442-q0.995` | 30 | 4 | 1,650 | 75 | 4/4 | 1 | 3,54 | 0,28 | có | 4 |
| 5 | `fused-equal-q0.99` | 30 | 4 | 0,772 | 75 | 3/4 | 5 | 3,54 | 1,41 | không | 5 |
| 6 | `fused-w442-q0.99` | 30 | 4 | 0,936 | 75 | 3/4 | 5 | 3,54 | 1,41 | không | 6 |

Luật: cap_met; hòa cuối theo tie_rank_asc; tổ hợp chọn `fused-equal-q0.999`, đạt điều kiện: có.

## E1 sơ bộ trên validation

| Chỉ số | Ngưỡng tĩnh | Robust z | Isolation Forest | Điểm hợp nhất |
| --- | --- | --- | --- | --- |
| Tổ hợp | `static-loose` | `merge300-chain120` | `iforest-q0.995` | `fused-equal-q0.999` |
| Ngưỡng | bộ `static-loose` | 5,000 | 0,780 | 1,769 |
| Đạt ≤ 1 BĐG/giờ | có | có | có | có |
| Fault run khớp | 4/4 | 4/4 | 4/4 | 4/4 |
| TP / FP / FN (gộp) | 4 / 0 / 0 | 4 / 0 / 0 | 4 / 1 / 0 | 4 / 0 / 0 |
| Precision / Recall / F1 | 1 / 1 / 1 | 1 / 1 / 1 | 0,80 / 1 / 0,89 | 1 / 1 / 1 |
| Báo động giả (số / giờ) | 0 / 3,54 | 0 / 3,54 | 1 / 3,54 | 0 / 3,54 |
| BĐG/giờ | 0 | 0 | 0,28 | 0 |
| Run khỏe `normal-mixed`: FP / giờ; FPR | 0 / 0,72 giờ; FPR 0/1 | 0 / 0,72 giờ; FPR 0/1 | 1 / 0,72 giờ; FPR 1/1 | 0 / 0,72 giờ; FPR 0/1 |
| Run khỏe `healthy-spike`: FP / giờ; FPR | 0 / 0,72 giờ; FPR 0/1 | 0 / 0,72 giờ; FPR 0/1 | 0 / 0,72 giờ; FPR 0/1 | 0 / 0,72 giờ; FPR 0/1 |
| Đoạn cao điểm 600 s: BĐG / giờ | 0 / 0,167 giờ | 0 / 0,167 giờ | 0 / 0,167 giờ | 0 / 0,167 giờ |
| Delay C2 (s) — trùng cao điểm | 76 | 61 | 76 | 61 |
| Delay C3 (s) | 737 | 737 | 737 | 737 |
| Delay C4 (s) | 117 | 117 | 117 | 117 |
| Delay C6 (s) | 78 | 63 | 78 | 63 |
| Incident trong khoảng đánh giá | 4 | 4 | 5 | 4 |

## FP và FN của E1

| Detector | Loại | Run | detected_at (UTC) | Triệu chứng đầu | Service | Điểm đỉnh | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Isolation Forest | FP | normal-mixed (`fp_healthy_run`) | 09:53:40 | scheduler-worker: `edge.duration_p95@scheduler-worker|scheduler-postgres` | scheduler-worker | 0,842 | run khỏe |
