/**
 * Thống kê mô tả dùng chung cho công cụ offline (không phụ thuộc thư viện ngoài).
 */

/** Phân vị nội suy tuyến tính trên mảng đã sắp (cùng cách với `numpy.quantile` mặc định). */
export function quantileSorted(sorted, p) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

export function sortedNumbers(values) {
  return Float64Array.from(values).sort();
}

export function summarize(values) {
  if (values.length === 0) return { n: 0 };
  const sorted = sortedNumbers(values);
  let sum = 0;
  for (const value of sorted) sum += value;
  const round = (value) => Math.round(value * 1000) / 1000;
  return {
    n: sorted.length,
    mean: round(sum / sorted.length),
    p25: round(quantileSorted(sorted, 0.25)),
    p50: round(quantileSorted(sorted, 0.5)),
    p75: round(quantileSorted(sorted, 0.75)),
    p90: round(quantileSorted(sorted, 0.9)),
    p99: round(quantileSorted(sorted, 0.99)),
    max: sorted[sorted.length - 1],
  };
}

/** Bảng `points` phân vị cách đều từ 0 tới 1 (ví dụ 101 điểm) để lấy mẫu lại theo hàm ngược. */
export function quantileTable(values, points = 101) {
  const sorted = sortedNumbers(values);
  return Array.from({ length: points }, (_, index) => quantileSorted(sorted, index / (points - 1)));
}

/** Lấy mẫu từ bảng phân vị với `u` đều trong [0, 1): nội suy giữa hai phân vị kề nhau. */
export function sampleQuantileTable(table, u) {
  const position = u * (table.length - 1);
  const low = Math.floor(position);
  const high = Math.min(low + 1, table.length - 1);
  return table[low] + (table[high] - table[low]) * (position - low);
}

/** Fit log-normal bằng trung bình và độ lệch chuẩn mẫu của log trên các giá trị ≥ `min`. */
export function lognormalFit(values, min = 1) {
  const logs = values.filter((value) => value >= min).map(Math.log);
  const mu = logs.reduce((sum, value) => sum + value, 0) / logs.length;
  const variance = logs.reduce((sum, value) => sum + (value - mu) ** 2, 0) / (logs.length - 1);
  return { mu, sigma: Math.sqrt(variance), median: Math.exp(mu), n: logs.length };
}

/** Đếm cặp chuyển trạng thái (kể cả `START` đầu phiên và `EXIT` cuối phiên), chuẩn hóa theo hàng. */
export function transitionMatrix(sessions) {
  const counts = {};
  const add = (from, to) => {
    counts[from] ??= {};
    counts[from][to] = (counts[from][to] ?? 0) + 1;
  };
  for (const session of sessions) {
    let previous = 'START';
    for (const action of session.actions) {
      add(previous, action.state);
      previous = action.state;
    }
    add(previous, 'EXIT');
  }
  const matrix = {};
  for (const [from, row] of Object.entries(counts)) {
    const total = Object.values(row).reduce((sum, value) => sum + value, 0);
    matrix[from] = Object.fromEntries(
      Object.entries(row)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([to, value]) => [to, value / total]),
    );
    matrix[from]._n = total;
  }
  return matrix;
}

/** Tỉ lệ từng giá trị `key(item)` trên tổng. */
export function shares(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  const total = items.length;
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => [name, value / total]),
  );
}
