#!/usr/bin/env node
// Sinh service mới từ lms/templates/service: pnpm new-service <name> --port <port> [--worker]
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const workspaceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templateRoot = path.join(workspaceRoot, 'templates', 'service');
const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u;

export function renderTemplate(content, values) {
  return content
    .replaceAll('__NAME__', values.name)
    .replaceAll('__UPPER__', values.upper)
    .replaceAll('__CONST__', values.upper)
    .replaceAll('__PORT__', String(values.port));
}

export function describeService(name, port) {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Tên service "${name}" phải là kebab-case ASCII`);
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`Cổng "${port}" không hợp lệ`);
  }
  return { name, port, upper: name.toUpperCase().replaceAll('-', '_') };
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else yield fullPath;
  }
}

async function generate(values, targetRoot) {
  for await (const source of walk(templateRoot)) {
    const relative = path.relative(templateRoot, source).replace(/\.tpl$/u, '');
    const target = path.join(targetRoot, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, renderTemplate(await readFile(source, 'utf8'), values));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { port: { type: 'string' } },
  });
  const [name] = positionals;
  if (!name || !values.port) {
    console.error('Cách dùng: node scripts/new-service.mjs <name> --port <port>');
    process.exit(2);
  }
  const description = describeService(name, Number(values.port));
  const targetRoot = path.join(workspaceRoot, 'services', name);
  const exists = await stat(targetRoot).then(
    () => true,
    () => false,
  );
  if (exists) {
    console.error(`services/${name} đã tồn tại`);
    process.exit(1);
  }
  await generate(description, targetRoot);
  console.log(
    `Đã tạo services/${name}. Việc tiếp theo: thêm vào pnpm install, viết model trong prisma/schema.prisma,\n` +
      `chạy "pnpm --filter @aiops-lms/${name} prisma:migrate:dev --name init" rồi thêm service vào docker-compose.`,
  );
}
