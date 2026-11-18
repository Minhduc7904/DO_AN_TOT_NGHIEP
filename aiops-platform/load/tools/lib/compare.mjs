/**
 * Phép đo so sánh hai phân phối/chuỗi cho báo cáo độ thực (ADR-007 mục 2, workload-design-v1 mục
 * 10.4). Không phụ thuộc thư viện ngoài; mỗi hàm có test trên dữ liệu biết trước đáp án.
 *
 * - KS hai mẫu: thống kê D = sup |F1 − F2| (NIST/SEMATECH e-Handbook 1.3.5.16).
 * - Jensen–Shannon divergence cơ số 2 (nằm trong [0, 1]).
 * - Index of dispersion = phương sai / trung bình của số đếm theo ô (Poisson ≈ 1).
 * - Hurst theo phương pháp phương sai gộp (aggregated variance): Var(X^(m)) ∝ m^(2H − 2)
 *   (Feitelson 2015, chương 7, [L-Feitelson] https://www.cs.huji.ac.il/~feit/wlmod/).
 */
import { quantileSorted, sortedNumbers } from './stats.mjs';

export function ksTwoSample(a, b) {
  const x = sortedNumbers(a);
  const y = sortedNumbers(b);
  if (x.length === 0 || y.length === 0) return null;
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < x.length && j < y.length) {
    const value = Math.min(x[i], y[j]);
    while (i < x.length && x[i] <= value) i += 1;
    while (j < y.length && y[j] <= value) j += 1;
    d = Math.max(d, Math.abs(i / x.length - j / y.length));
  }
  return d;
}

/** JSD (log2) giữa hai bảng đếm `{ khóa: số }`. */
export function jensenShannon(p, q) {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  const sp = Object.values(p).reduce((sum, value) => sum + value, 0);
  const sq = Object.values(q).reduce((sum, value) => sum + value, 0);
  if (sp === 0 || sq === 0) return null;
  let total = 0;
  for (const key of keys) {
    const a = (p[key] ?? 0) / sp;
    const b = (q[key] ?? 0) / sq;
    const m = (a + b) / 2;
    if (a > 0) total += 0.5 * a * Math.log2(a / m);
    if (b > 0) total += 0.5 * b * Math.log2(b / m);
  }
  return total;
}

export function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  return sx === 0 || sy === 0 ? null : sxy / Math.sqrt(sx * sy);
}

function meanVariance(values) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(values.length - 1, 1);
  return { mean, variance };
}

export function dispersionIndex(counts) {
  const { mean, variance } = meanVariance(counts);
  return mean === 0 ? null : variance / mean;
}

export function peakToMean(counts) {
  const { mean } = meanVariance(counts);
  return mean === 0 ? null : Math.max(...counts) / mean;
}

/**
 * Hurst theo phương sai gộp: với m = 1, 2, 4, … (mỗi mức còn ≥ 8 khối), hồi quy log Var(X^(m)) theo
 * log m, độ dốc β → H = 1 + β/2. Chuỗi độc lập (Poisson) cho H ≈ 0,5; tự tương đồng cho H → 1.
 */
export function hurstAggregatedVariance(counts) {
  const xs = [];
  const ys = [];
  for (let m = 1; counts.length / m >= 8; m *= 2) {
    const blocks = [];
    for (let start = 0; start + m <= counts.length; start += m) {
      blocks.push(counts.slice(start, start + m).reduce((s, v) => s + v, 0) / m);
    }
    const { variance } = meanVariance(blocks);
    if (variance <= 0) continue;
    xs.push(Math.log(m));
    ys.push(Math.log(variance));
  }
  if (xs.length < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return 1 + num / den / 2;
}

export function median(values) {
  return quantileSorted(sortedNumbers(values), 0.5);
}

/** Lệch tương đối của trung vị so với tham chiếu: (m − m_ref) / m_ref. */
export function medianRelativeDiff(values, reference) {
  const ref = median(reference);
  const value = median(values);
  if (ref === null || value === null || ref === 0) return null;
  return (value - ref) / ref;
}

/** Đếm số phần tử theo ô `binS` giây trên `[0, totalS)`. */
export function binCounts(times, totalS, binS) {
  const counts = Array.from({ length: Math.ceil(totalS / binS) }, () => 0);
  for (const time of times) {
    if (time >= 0 && time < totalS) counts[Math.floor(time / binS)] += 1;
  }
  return counts;
}
