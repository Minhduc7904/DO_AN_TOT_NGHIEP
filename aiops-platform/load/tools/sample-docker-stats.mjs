#!/usr/bin/env node
/**
 * Lấy mẫu CPU/bộ nhớ của mọi container và của máy theo chu kỳ, ghi JSON Lines cho `health-check.mjs`
 * (tiêu chí CPU/bộ nhớ của workload-design-v1 mục 8.4). Chạy nền suốt run, dừng bằng SIGINT/SIGTERM.
 *
 *   node aiops-platform/load/tools/sample-docker-stats.mjs --out results/<run_id>/docker-stats.jsonl \
 *     [--interval-s 15] [--min-available-mb 1500 --stop-image grafana/k6:1.3.0]
 *
 * Mỗi dòng container: `{ ts, name, image, cpu_perc, cpu_limit, mem_used_mib, mem_limit_mib, mem_perc,
 * mem_unreclaimable_mib, mem_unreclaimable_perc }`. `mem_used_mib` của `docker stats` là working set (gồm
 * page cache đang "active"); `mem_unreclaimable_*` đọc `memory.stat` của cgroup v2: `anon` + `shmem` +
 * bộ nhớ kernel (`kernel`, hoặc tổng `kernel_stack`, `pagetables`, `percpu`, `sock`,
 * `slab_unreclaimable` trên kernel cũ), tức phần kernel không thu hồi được khi chạm `memory.max`.
 * Grafana dùng ~220–420 MiB anon nhưng page cache lúc khởi động (cài plugin) đẩy working set lên 88–90%
 * giới hạn trong ~12 phút đầu (pilot task-03 tuần 15). Không đọc được cgroup (cgroup v1, Docker Desktop,
 * rootless) thì `null` và ghi một dòng cảnh báo `SAMPLER` cho container đó.
 * (`cpu_perc` là % của một core như `docker stats`; `cpu_limit` là số core giới hạn, 0 nếu không đặt).
 * Dòng máy: `{ ts, name: "HOST", mem_available_mb, cpu_perc }` (đọc /proc, chỉ Linux).
 * `--min-available-mb` kèm `--stop-image`: RAM trống của máy dưới ngưỡng thì dừng container của image đó
 * (bảo vệ máy khi run tìm điểm gãy đẩy tải quá xa).
 */
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const run = promisify(execFile);

const UNITS = { B: 1 / 1024 / 1024, KiB: 1 / 1024, kB: 1 / 1024, MiB: 1, MB: 1, GiB: 1024, GB: 1024 };

/** "94.59MiB" → 94.59 (MiB). */
export function parseSize(text) {
  const match = String(text).trim().match(/^([\d.]+)\s*([A-Za-z]+)$/u);
  if (!match || !(match[2] in UNITS)) return null;
  return Number(match[1]) * UNITS[match[2]];
}

const KERNEL_PARTS = ['kernel_stack', 'pagetables', 'percpu', 'sock', 'slab_unreclaimable'];

/** `memory.stat` của cgroup v2 → MiB không thu hồi được (null khi không có dòng `anon`). */
export function unreclaimableMib(memoryStat) {
  const stat = Object.fromEntries(
    String(memoryStat)
      .split('\n')
      .map((line) => line.trim().split(/\s+/u))
      .filter((parts) => parts.length === 2 && /^\d+$/u.test(parts[1]))
      .map(([key, value]) => [key, Number(value)]),
  );
  if (stat.anon === undefined) return null;
  const kernel = stat.kernel ?? KERNEL_PARTS.reduce((sum, key) => sum + (stat[key] ?? 0), 0);
  return (stat.anon + (stat.shmem ?? 0) + kernel) / 1024 / 1024;
}

/** Đường dẫn cgroup v2 của container: driver systemd (mặc định trên Linux), rồi cgroupfs. */
export const CGROUP_PATHS = [
  (id) => `/sys/fs/cgroup/system.slice/docker-${id}.scope/memory.stat`,
  (id) => `/sys/fs/cgroup/docker/${id}/memory.stat`,
];

function readUnreclaimableMib(containerId) {
  for (const path of CGROUP_PATHS) {
    try {
      return unreclaimableMib(readFileSync(path(containerId), 'utf8'));
    } catch {
      // thử đường dẫn kế tiếp
    }
  }
  return null;
}

/** Một dòng `docker stats --format '{{json .}}'` → mẫu (chưa có image/cpu_limit). */
export function parseStatsLine(line, ts) {
  const raw = JSON.parse(line);
  const [used, limit] = String(raw.MemUsage).split('/');
  return {
    ts,
    name: raw.Name,
    cpu_perc: Number.parseFloat(raw.CPUPerc),
    mem_used_mib: parseSize(used),
    mem_limit_mib: parseSize(limit),
    mem_perc: Number.parseFloat(raw.MemPerc),
  };
}

function hostSample(previous) {
  const memAvailable = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+) kB/mu);
  const cpu = readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/u).slice(1).map(Number);
  const idle = cpu[3] + (cpu[4] ?? 0);
  const total = cpu.reduce((sum, value) => sum + value, 0);
  const perc =
    previous && total > previous.total ? 100 * (1 - (idle - previous.idle) / (total - previous.total)) : null;
  return { memAvailableMb: memAvailable ? Math.floor(Number(memAvailable[1]) / 1024) : null, cpu: { idle, total }, perc };
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: 'string' },
      'interval-s': { type: 'string', default: '15' },
      'min-available-mb': { type: 'string' },
      'stop-image': { type: 'string' },
    },
  });
  if (!values.out) throw new Error('Thiếu --out');
  const intervalMs = Number(values['interval-s']) * 1000;
  const meta = new Map(); // tên container → { image, cpu_limit, id }
  const warned = new Set();
  let stopped = false;
  for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => (stopped = true));
  let previousCpu = existsSync('/proc/stat') ? hostSample(null).cpu : null;
  while (!stopped) {
    const started = Date.now();
    const ts = new Date().toISOString();
    try {
      const { stdout } = await run('docker', ['stats', '--no-stream', '--format', '{{json .}}']);
      const samples = stdout.split('\n').filter(Boolean).map((line) => parseStatsLine(line, ts));
      // Container bị tạo lại (runner reset stack khi bộ lấy mẫu đã chạy) đổi id: đọc cgroup theo id cũ
      // thất bại, nên inspect lại cả những tên đó.
      const unknown = samples
        .map((s) => s.name)
        .filter((name) => !meta.has(name) || readUnreclaimableMib(meta.get(name).id) === null);
      if (unknown.length > 0) {
        const { stdout: inspected } = await run('docker', [
          'inspect',
          '--format',
          '{{.Name}}\t{{.Config.Image}}\t{{.HostConfig.NanoCpus}}\t{{.Id}}',
          ...unknown,
        ]);
        for (const line of inspected.split('\n').filter(Boolean)) {
          const [name, image, nano, id] = line.split('\t');
          meta.set(name.replace(/^\//u, ''), { image, cpu_limit: Number(nano) / 1e9, id });
        }
      }
      const lines = samples.map((s) => {
        const { id, ...info } = meta.get(s.name) ?? {};
        const mib = id ? readUnreclaimableMib(id) : null;
        const perc = mib !== null && s.mem_limit_mib ? (100 * mib) / s.mem_limit_mib : null;
        return JSON.stringify({ ...s, ...info, mem_unreclaimable_mib: mib, mem_unreclaimable_perc: perc });
      });
      for (const s of samples) {
        if (warned.has(s.name) || readUnreclaimableMib(meta.get(s.name)?.id ?? '') !== null) continue;
        warned.add(s.name);
        lines.push(
          JSON.stringify({ ts, name: 'SAMPLER', warning: `không đọc được memory.stat cgroup v2 của ${s.name}` }),
        );
      }
      if (previousCpu) {
        const host = hostSample({ idle: previousCpu.idle, total: previousCpu.total });
        previousCpu = host.cpu;
        lines.push(JSON.stringify({ ts, name: 'HOST', mem_available_mb: host.memAvailableMb, cpu_perc: host.perc }));
        const floor = Number(values['min-available-mb']);
        if (values['stop-image'] && floor > 0 && host.memAvailableMb !== null && host.memAvailableMb < floor) {
          const { stdout: ids } = await run('docker', ['ps', '-q', '--filter', `ancestor=${values['stop-image']}`]);
          if (ids.trim()) {
            await run('docker', ['stop', '-t', '90', ...ids.trim().split('\n')]);
            lines.push(JSON.stringify({ ts, name: 'HOST', event: 'stopped_client_low_memory', mem_available_mb: host.memAvailableMb }));
          }
        }
      }
      appendFileSync(values.out, `${lines.join('\n')}\n`);
    } catch (error) {
      appendFileSync(values.out, `${JSON.stringify({ ts, name: 'SAMPLER', error: error.message })}\n`);
    }
    const wait = intervalMs - (Date.now() - started);
    for (let left = wait; left > 0 && !stopped; left -= 500) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(500, left)));
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
