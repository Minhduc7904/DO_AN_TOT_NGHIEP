// Kết nối PostgreSQL và kiểm tra từng database trước khi seed.
import { readFileSync } from 'node:fs';

import pg from 'pg';

import { countStatement, wipeStatement } from './catalogue.mjs';

export const ALLOWED_HOSTS = Object.freeze(new Set(['localhost', '127.0.0.1', '::1', 'postgres']));
const DEFAULT_CONNECTION = Object.freeze({
  host: 'localhost',
  port: 5432,
  user: 'lms',
  password: 'lms-local-only',
});

/** Đọc file env kiểu `KEY=VALUE` (bỏ dòng trống và chú thích, gỡ cặp nháy ngoài cùng). */
export function parseEnvFile(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const value = line.slice(separator + 1).trim();
    values[line.slice(0, separator).trim()] = /^(['"]).*\1$/u.test(value)
      ? value.slice(1, -1)
      : value;
  }
  return values;
}

/** Thứ tự ưu tiên: cờ dòng lệnh, file env compose (`POSTGRES_*`), mặc định của compose local. */
export function resolveConnection({ flags = {}, envFile } = {}) {
  const fromFile = envFile ? parseEnvFile(envFile) : {};
  const port = flags.port ?? fromFile.POSTGRES_PORT ?? DEFAULT_CONNECTION.port;
  return {
    host: flags.host ?? DEFAULT_CONNECTION.host,
    port: Number(port),
    user: flags.user ?? fromFile.POSTGRES_USER ?? DEFAULT_CONNECTION.user,
    password: flags.password ?? fromFile.POSTGRES_PASSWORD ?? DEFAULT_CONNECTION.password,
  };
}

/** Seeder ghi hàng loạt nên chỉ chạy trên Postgres local hoặc trong network compose. */
export function assertLocalHost(host) {
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `Host "${host}" không được phép: seeder chỉ chạy với ${[...ALLOWED_HOSTS].join(', ')}.`,
    );
  }
}

/** Cấu hình `pg.Client` cho một database; `<KEY>_DATABASE_URL` trong môi trường (nếu có) được ưu tiên. */
export function clientConfig(database, connection, env = process.env) {
  const url = env[`${database.key.toUpperCase()}_DATABASE_URL`];
  if (url) {
    assertLocalHost(new URL(url).hostname.replace(/^\[|\]$/gu, ''));
    return { connectionString: url };
  }
  assertLocalHost(connection.host);
  return { ...connection, database: database.dbName };
}

export function defaultCreateClient(database, connection, env = process.env) {
  return new pg.Client(clientConfig(database, connection, env));
}

// Ngữ cảnh giả chỉ để lấy tên bảng và cột mà catalogue ghi; giá trị không quan trọng.
const SCHEMA_PROBE_CONTEXT = Object.freeze({
  seed: 0,
  passwordHash: 'x',
  get: () => 1,
  capacities: () => ({ progresses: 1, attempts: 1 }),
});

function requiredColumns(database) {
  const columns = new Map(database.wipe.map((table) => [table, new Set(['id'])]));
  for (const dataset of database.datasets) {
    for (const statement of dataset.statements(SCHEMA_PROBE_CONTEXT, 1, 1)) {
      const set = columns.get(statement.table) ?? new Set();
      for (const column of Object.keys(statement.columns)) set.add(column);
      columns.set(statement.table, set);
    }
  }
  return columns;
}

/**
 * Kết nối thử một database: bảng và cột đã migrate chưa, và đang có bao nhiêu dòng seed.
 * Trạng thái: `ok`, `unreachable` (không kết nối được), `unmigrated` (thiếu bảng/cột).
 */
export async function probeDatabase(database, createClient) {
  const client = createClient(database);
  try {
    await client.connect();
  } catch (error) {
    return { status: 'unreachable', detail: error.message, existing: {} };
  }
  try {
    const wanted = requiredColumns(database);
    const result = await client.query(
      'SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ANY($1)',
      [[...wanted.keys()]],
    );
    const present = new Map();
    for (const row of result.rows) {
      present.set(row.table_name, (present.get(row.table_name) ?? new Set()).add(row.column_name));
    }
    const missing = [];
    for (const [table, columns] of wanted) {
      const have = present.get(table);
      if (!have) missing.push(`bảng ${table}`);
      else for (const column of columns) if (!have.has(column)) missing.push(`${table}.${column}`);
    }
    if (missing.length > 0) {
      return {
        status: 'unmigrated',
        detail: `chưa migrate service ${database.key} (thiếu ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', ...' : ''})`,
        existing: {},
      };
    }
    const existing = {};
    for (const dataset of database.datasets) {
      existing[dataset.key] = (await client.query(countStatement(dataset))).rows[0].count;
    }
    return { status: 'ok', detail: '', existing };
  } finally {
    await client.end();
  }
}

export { wipeStatement };
