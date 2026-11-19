#!/usr/bin/env node
/**
 * Lấy mẫu CPU/bộ nhớ của mọi container và của máy theo chu kỳ, ghi JSON Lines cho `health-check.mjs`
 * (tiêu chí CPU/bộ nhớ của workload-design-v1 mục 8.4). Chạy nền suốt run, dừng bằng SIGINT/SIGTERM.
 *
 *   node aiops-platform/load/tools/sample-docker-stats.mjs --out results/<run_id>/docker-stats.jsonl \
 *     [--interval-s 15] [--min-available-mb 1500 --stop-image grafana/k6:1.3.0]
 *
 * Mỗi dòng container: `{ ts, name, image, cpu_perc, cpu_limit, mem_used_mib, mem_limit_mib, mem_perc }`
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
  const meta = new Map(); // tên container → { image, cpu_limit }
  let stopped = false;
  for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => (stopped = true));
  let previousCpu = existsSync('/proc/stat') ? hostSample(null).cpu : null;
  while (!stopped) {
    const started = Date.now();
    const ts = new Date().toISOString();
    try {
      const { stdout } = await run('docker', ['stats', '--no-stream', '--format', '{{json .}}']);
      const samples = stdout.split('\n').filter(Boolean).map((line) => parseStatsLine(line, ts));
      const unknown = samples.map((s) => s.name).filter((name) => !meta.has(name));
      if (unknown.length > 0) {
        const { stdout: inspected } = await run('docker', [
          'inspect',
          '--format',
          '{{.Name}}\t{{.Config.Image}}\t{{.HostConfig.NanoCpus}}',
          ...unknown,
        ]);
        for (const line of inspected.split('\n').filter(Boolean)) {
          const [name, image, nano] = line.split('\t');
          meta.set(name.replace(/^\//u, ''), { image, cpu_limit: Number(nano) / 1e9 });
        }
      }
      const lines = samples.map((s) => JSON.stringify({ ...s, ...(meta.get(s.name) ?? {}) }));
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
