/**
 * Bộ sinh số giả ngẫu nhiên có seed (mulberry32). Không import module k6 nên test được bằng Node và
 * dùng chung cho script k6 lẫn công cụ offline ở `tools/`.
 *
 * Mức 1: mỗi người dùng ảo (VU) có một bộ sinh riêng, seed = seed của run × 1000 + số thứ tự VU.
 * Mức 2/2+: mỗi phiên có bộ sinh riêng từ `hash32(workload_seed, scenario, iterationInTest)`
 * (workload-design-v1 mục 11.1), vì trong executor arrival-rate VU nào chạy phiên nào là không xác định.
 */
export function createRng(seed) {
  let state = Number(seed) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** Số nguyên trong [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** Số thực trong [min, max). */
    uniform(min, max) {
      return min + next() * (max - min);
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('Không chọn được từ danh sách rỗng');
      return items[Math.floor(next() * items.length)];
    },
    chance(probability) {
      return next() < probability;
    },
    /** Chuẩn tắc N(0, 1) bằng biến đổi Box–Muller (workload-design-v1 mục 11.1). */
    normal() {
      const u1 = 1 - next(); // (0, 1], tránh log(0)
      const u2 = next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    /** Log-normal e^(mu + sigma·Z). */
    lognormal(mu, sigma) {
      return Math.exp(mu + sigma * rng.normal());
    },
    /** Chọn khóa theo trọng số `{ key: weight }` (thứ tự khóa cố định nên tái lập được). */
    weighted(weights) {
      const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (entries.length === 0 || !(total > 0)) throw new RangeError('Trọng số rỗng');
      let roll = next() * total;
      for (const [key, weight] of entries) {
        roll -= weight;
        if (roll < 0) return key;
      }
      return entries[entries.length - 1][0];
    },
  };
  return rng;
}

export function vuSeed(runSeed, vuId) {
  return (Number(runSeed) * 1000 + Number(vuId)) >>> 0;
}

/** Hash FNV-1a 32 bit của các phần ghép bằng `|`; dùng làm seed theo phiên hoặc gán tài khoản. */
export function hash32(...parts) {
  const text = parts.map(String).join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
