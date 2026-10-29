// Hiển thị tiến độ nạp: nhiều dòng cập nhật tại chỗ khi chạy trong terminal (TTY), hoặc in từng dòng
// khi không có TTY (CI, pipe) để log đọc được.
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const BAR_WIDTH = 20;
const REDRAW_INTERVAL_MS = 80;

const numberFormat = new Intl.NumberFormat('vi-VN');
const decimalFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const shortFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export const formatNumber = (value) => numberFormat.format(value);

export function formatDuration(milliseconds) {
  const seconds = milliseconds / 1000;
  return `${(seconds < 1 ? shortFormat : decimalFormat).format(seconds)}s`;
}

export function renderBar(ratio, width = BAR_WIDTH) {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

/** Một dòng trạng thái của một mục; hàm thuần để test. */
export function renderLine(item, frame = 0) {
  const label = item.label.padEnd(44);
  if (item.state === 'done') {
    return `  ✔ ${label} ${formatNumber(item.rows)} dòng · ${formatDuration(item.ms)} · thành công`;
  }
  if (item.state === 'failed') return `  ✖ ${label} lỗi: ${item.message}`;
  if (item.state === 'skipped') return `  – ${label} bỏ qua (0 dòng)`;
  if (item.state === 'waiting') return `  · ${label} đang chờ`;
  const ratio = item.units > 0 ? item.done / item.units : 0;
  const percent = String(Math.floor(ratio * 100)).padStart(3);
  const rate =
    item.ms > 0 ? ` · ${formatNumber(Math.round((item.rows * 1000) / item.ms))} dòng/s` : '';
  return `  ${FRAMES[frame % FRAMES.length]} ${label} ${renderBar(ratio)} ${percent}% ${formatNumber(item.rows)} dòng${rate}`;
}

export function createProgress({
  stream = process.stdout,
  tty = stream.isTTY,
  clock = Date.now,
} = {}) {
  const items = new Map();
  let frame = 0;
  let drawn = 0;
  let lastDraw = 0;

  function lines() {
    return [...items.values()].map((item) => renderLine(item, frame));
  }

  function draw(force) {
    if (!tty) return;
    const now = clock();
    if (!force && now - lastDraw < REDRAW_INTERVAL_MS) return;
    lastDraw = now;
    frame += 1;
    if (drawn > 0) stream.write(`\u001b[${drawn}A`);
    const current = lines();
    for (const line of current) stream.write(`\u001b[2K\r${line}\n`);
    drawn = current.length;
  }

  function clearBlock() {
    if (tty && drawn > 0) stream.write(`\u001b[${drawn}A\u001b[J`);
    drawn = 0;
  }

  return {
    /** In một dòng thường phía trên khối tiến độ (tiêu đề DB, thông báo dọn). */
    note(message) {
      clearBlock();
      stream.write(`${message}\n`);
      draw(true);
    },
    start(key, label, units) {
      items.set(key, {
        key,
        label,
        units,
        done: 0,
        rows: 0,
        ms: 0,
        state: 'running',
        startedAt: clock(),
      });
      if (!tty) stream.write(`[seed] ${label} bắt đầu (${formatNumber(units)} đơn vị)\n`);
      draw(true);
    },
    update(key, patch) {
      const item = items.get(key);
      Object.assign(item, patch, { ms: clock() - item.startedAt });
      draw(false);
    },
    done(key, rows) {
      const item = items.get(key);
      Object.assign(item, { state: 'done', rows, done: item.units, ms: clock() - item.startedAt });
      if (tty) draw(true);
      else stream.write(`${renderLine(item)}\n`);
    },
    fail(key, message) {
      const item = items.get(key);
      Object.assign(item, { state: 'failed', message });
      if (tty) draw(true);
      else stream.write(`${renderLine(item)}\n`);
    },
    skip(key, label) {
      items.set(key, { key, label, state: 'skipped' });
      if (tty) draw(true);
      else stream.write(`${renderLine(items.get(key))}\n`);
    },
    /** Kết thúc một DB: giữ lại các dòng đã hiển thị và bắt đầu khối mới cho DB sau. */
    reset() {
      draw(true);
      items.clear();
      drawn = 0;
    },
  };
}
