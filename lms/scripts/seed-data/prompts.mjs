// Giao diện hỏi đáp trong terminal: chọn DB, nhập số lượng từng bảng, xác nhận.
import { checkbox, confirm, number } from '@inquirer/prompts';

import { DATABASES } from './catalogue.mjs';
import { createContext, limitsOf, suggestCount } from './planner.mjs';
import { formatNumber } from './progress.mjs';

const STATUS_TEXT = Object.freeze({
  ok: 'sẵn sàng',
  unreachable: 'không kết nối được',
  unmigrated: 'chưa migrate',
});

export function describeProbe(database, probe) {
  const seeded = Object.values(probe.existing).reduce((sum, value) => sum + value, 0);
  const detail = probe.status === 'ok' ? `${formatNumber(seeded)} dòng seed hiện có` : probe.detail;
  return `${STATUS_TEXT[probe.status]} · ${detail}`;
}

/** Bước 1: chọn các database cần seed (DB không dùng được bị khóa kèm lý do). */
export async function chooseDatabases(probes, ask = checkbox) {
  return ask({
    message: 'Chọn các database cần seed (Space để chọn, Enter để tiếp tục)',
    choices: DATABASES.map((database) => {
      const probe = probes[database.key];
      return {
        value: database.key,
        short: database.label,
        name: `${database.label.padEnd(16)} ${describeProbe(database, probe)}`,
        checked: probe.status === 'ok',
        disabled: probe.status === 'ok' ? false : describeProbe(database, probe),
      };
    }),
    validate: (choices) => choices.length > 0 || 'Chọn ít nhất một database.',
  });
}

/**
 * Bước 2: nhập số lượng từng mục của các DB đã chọn, theo thứ tự cha trước con để mỗi lần nhập biết
 * trần/sàn dựa trên số vừa nhập. Mục dẫn xuất chỉ hiển thị số tự tính.
 */
export async function chooseCounts({
  selected,
  existing,
  profileName,
  seed,
  passwordHash,
  ask = number,
  log = console.log,
}) {
  const counts = {};
  const context = createContext({ seed, passwordHash, counts, existing, selected });
  for (const database of DATABASES) {
    if (!selected.includes(database.key)) continue;
    log(`\n${database.label}: nhập số dòng cho từng bảng`);
    for (const dataset of database.datasets) {
      if (dataset.derived) {
        const value = formatNumber(dataset.count(context));
        log(`  ${dataset.label}: tự tính ${dataset.estimated ? '≈ ' : ''}${value} dòng`);
        continue;
      }
      const { min, max } = limitsOf(dataset, context);
      const range = Number.isFinite(max)
        ? `${formatNumber(min)} đến ${formatNumber(max)}`
        : `từ ${formatNumber(min)}`;
      const missing = (dataset.needs ?? []).filter((need) => context.get(need) === 0);
      const value = await ask({
        message: `${dataset.label} (${range})`,
        default: suggestCount(dataset, context, profileName),
        min,
        ...(Number.isFinite(max) ? { max } : {}),
        step: 1,
        required: true,
        validate: (input) =>
          missing.length > 0 && input > 0
            ? `Cần có dữ liệu ở: ${missing.join(', ')}. Nhập 0 hoặc quay lại chọn thêm database.`
            : true,
      });
      counts[dataset.key] = value;
    }
  }
  return counts;
}

export function askConfirm(message, ask = confirm) {
  return ask({ message, default: false });
}
