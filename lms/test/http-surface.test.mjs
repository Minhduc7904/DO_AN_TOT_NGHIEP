import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Kiểm tra quy ước hai bề mặt HTTP (ADR-004): mỗi controller nằm đúng thư mục, đúng prefix và
// khai báo cách xác thực tường minh. Đọc source thay vì chạy Nest để lỗi hiện ngay ở bước lint/test.
const servicesRoot = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'services',
);
const SURFACES = ['public', 'internal', 'open', 'shared', 'health'];
const HTTP_METHOD = /@(Get|Post|Put|Patch|Delete|All)\(/gu;

async function controllerFiles() {
  const files = [];
  for (const service of await readdir(servicesRoot)) {
    const httpRoot = path.join(servicesRoot, service, 'src', 'adapters', 'http');
    const entries = await readdir(httpRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
        files.push({ service, surface: '(gốc)', file: path.join(httpRoot, entry.name) });
      }
      if (entry.isDirectory()) {
        for (const child of await readdir(path.join(httpRoot, entry.name))) {
          if (child.endsWith('.controller.ts')) {
            files.push({
              service,
              surface: entry.name,
              file: path.join(httpRoot, entry.name, child),
            });
          }
        }
      }
    }
  }
  return files;
}

const count = (text, pattern) => [...text.matchAll(pattern)].length;

test('controller chỉ nằm trong thư mục bề mặt đã định nghĩa', async () => {
  for (const { service, surface, file } of await controllerFiles()) {
    assert.ok(SURFACES.includes(surface), `${service}: ${path.basename(file)} nằm ở "${surface}"`);
  }
});

test('controller public dùng PUBLIC_PREFIX và không khai báo InternalApi', async () => {
  for (const { surface, file } of await controllerFiles()) {
    if (surface !== 'public') continue;
    const source = await readFile(file, 'utf8');
    assert.match(source, /@Controller\((`\$\{)?PUBLIC_PREFIX/u, `${file} phải dùng PUBLIC_PREFIX`);
    assert.doesNotMatch(source, /@InternalApi\(/u, `${file} không được là internal`);
    assert.doesNotMatch(source, /@SkipAuth\(/u, `${file}: public không được bỏ qua xác thực`);
  }
});

test('controller internal dùng INTERNAL_PREFIX và khai báo InternalApi hoặc SkipAuth cho mọi route', async () => {
  for (const { surface, file } of await controllerFiles()) {
    if (surface !== 'internal') continue;
    const source = await readFile(file, 'utf8');
    assert.match(
      source,
      /@Controller\(`\$\{INTERNAL_PREFIX\}/u,
      `${file} phải dùng INTERNAL_PREFIX`,
    );
    assert.doesNotMatch(
      source,
      /@(Roles|Anonymous)\(/u,
      `${file} không được dùng decorator public`,
    );
    const classLevel =
      /@(InternalApi|SkipAuth)\([^)]*\)\s*(?:@\w+\([^)]*\)\s*)*@Controller\(/u.test(source);
    const guarded = count(source, /@(InternalApi|SkipAuth)\(/gu);
    assert.ok(
      classLevel || guarded >= count(source, HTTP_METHOD),
      `${file}: mỗi route internal cần @InternalApi({ scopes }) (hoặc @SkipAuth có chủ đích)`,
    );
  }
});

test('controller open (không token) phải khai báo SkipAuth', async () => {
  for (const { surface, file } of await controllerFiles()) {
    if (surface !== 'open') continue;
    assert.match(await readFile(file, 'utf8'), /@SkipAuth\(/u, `${file} phải có @SkipAuth`);
  }
});

test('không controller nào viết tay chuỗi prefix api/v1 hoặc internal/v1', async () => {
  for (const { file } of await controllerFiles()) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(
      source,
      /@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?(api|internal)\//u,
      file,
    );
  }
});
