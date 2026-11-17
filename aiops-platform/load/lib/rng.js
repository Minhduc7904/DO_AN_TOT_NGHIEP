/**
 * Bộ sinh số giả ngẫu nhiên có seed (mulberry32). Không import module k6 nên test được bằng Node.
 * Mỗi người dùng ảo (VU) có một bộ sinh riêng, seed = seed của run × 1000 + số thứ tự VU, để cùng
 * seed cho cùng chuỗi lựa chọn trên từng VU.
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
  return {
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
  };
}

export function vuSeed(runSeed, vuId) {
  return (Number(runSeed) * 1000 + Number(vuId)) >>> 0;
}
