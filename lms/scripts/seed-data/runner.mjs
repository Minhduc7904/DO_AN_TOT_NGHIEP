// Nạp dữ liệu cho từng database: dọn dữ liệu seed cũ rồi nạp theo chunk, tất cả trong MỘT transaction
// mỗi DB. Lỗi ở bất kỳ bước nào thì DB đó rollback, DB đã xong trước đó giữ nguyên.
import { createHash } from 'node:crypto';

import { fingerprintStatement, wipeStatement } from './catalogue.mjs';

export const DEFAULT_CHUNK_SIZE = 20_000;

function insertStatement(statement) {
  const columns = Object.keys(statement.columns);
  return `INSERT INTO ${statement.table} (${columns.join(', ')}) SELECT ${columns
    .map((column) => statement.columns[column])
    .join(', ')} ${statement.from}`;
}

// Khóa ngoại một cột chưa có chỉ mục ở bảng con (ví dụ quiz_attempt_answers.selected_option_id): mỗi dòng cha
// bị xóa phải quét cả bảng con, nên dọn hàng triệu dòng sẽ kéo dài hàng chục phút nếu thiếu chỉ mục.
const UNINDEXED_FOREIGN_KEYS = `SELECT c.conrelid::regclass::text AS child, a.attname AS column_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND c.confrelid = ANY($1::regclass[])
    AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])`;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function seedItem({ item, context, client, chunkSize, progress, clock }) {
  const { dataset, count, units } = item;
  progress.start(dataset.key, dataset.label, units);
  const startedAt = clock();
  try {
    for (const statement of dataset.prepare?.(context) ?? []) await client.query(statement);
    const size = dataset.chunk ?? chunkSize;
    let rows = 0;
    for (let from = 1; from <= units; from += size) {
      const to = Math.min(from + size - 1, units);
      const statements = dataset.statements(context, from, to);
      // Câu đầu là bảng chính (quyết định số dòng báo cáo); các câu sau là dữ liệu đi kèm.
      for (const [index, statement] of statements.entries()) {
        const result = await client.query(insertStatement(statement));
        if (index === 0) rows += result.rowCount;
      }
      progress.update(dataset.key, { done: to, rows });
    }
    if (!dataset.estimated && rows !== count) {
      throw new Error(`dự kiến ${count} dòng nhưng nạp được ${rows} dòng (quy tắc phân bổ lệch)`);
    }
    progress.done(dataset.key, rows);
    return {
      key: dataset.key,
      label: dataset.label,
      table: dataset.table,
      rows,
      ms: clock() - startedAt,
    };
  } catch (error) {
    progress.fail(dataset.key, error.message);
    throw error;
  }
}

async function fingerprintDatabase(client, database) {
  const datasets = [];
  for (const dataset of database.datasets) {
    const { count, hash } = (await client.query(fingerprintStatement(dataset))).rows[0];
    datasets.push({ key: dataset.key, rows: count, hash });
  }
  return {
    datasets,
    hash: sha256(datasets.map((entry) => `${entry.key}:${entry.rows}:${entry.hash}`).join('|')),
  };
}

/**
 * Seed một database. `items` là các mục của DB này theo thứ tự catalogue (`count`, `units`).
 * Trả về số dòng đã dọn, số dòng đã nạp, thời gian và fingerprint của dữ liệu seed.
 */
export async function seedDatabase({
  database,
  items,
  context,
  client,
  chunkSize = DEFAULT_CHUNK_SIZE,
  progress,
  clock = Date.now,
}) {
  const startedAt = clock();
  await client.query('BEGIN');
  try {
    // Chỉ mục tạm nằm trong transaction này: xóa xong thì bỏ, lỗi thì rollback nên không để lại dấu vết.
    const missing = (await client.query(UNINDEXED_FOREIGN_KEYS, [database.wipe])).rows;
    const temporaryIndexes = [];
    for (const [position, { child, column_name: column }] of missing.entries()) {
      const name = `seed_tmp_fk_${position}`;
      await client.query(`CREATE INDEX ${name} ON ${child} (${column})`);
      temporaryIndexes.push(name);
    }
    const wiped = [];
    for (const table of database.wipe) {
      const result = await client.query(wipeStatement(table));
      wiped.push({ table, rows: result.rowCount });
    }
    for (const name of temporaryIndexes) await client.query(`DROP INDEX ${name}`);
    progress.note(
      `  Đã dọn dữ liệu seed cũ: ${wiped.map((entry) => `${entry.table} ${entry.rows}`).join(', ')}`,
    );
    const seeded = [];
    for (const item of items) {
      if (item.count === 0) {
        progress.skip(item.dataset.key, item.dataset.label);
        continue;
      }
      seeded.push(await seedItem({ item, context, client, chunkSize, progress, clock }));
    }
    await client.query('COMMIT');
    const fingerprint = await fingerprintDatabase(client, database);
    return { key: database.key, ms: clock() - startedAt, wiped, seeded, fingerprint };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Seed lần lượt các DB; dừng ở DB lỗi và nêu rõ các DB đã xong. */
export async function runSeed({
  plan,
  selected,
  createClient,
  chunkSize,
  progress,
  clock = Date.now,
  databases,
}) {
  const startedAt = clock();
  const results = [];
  for (const database of databases.filter((entry) => selected.includes(entry.key))) {
    progress.note(`\n▶ ${database.label}`);
    const client = createClient(database);
    await client.connect();
    try {
      results.push(
        await seedDatabase({
          database,
          items: plan.items.filter((item) => item.dataset.db === database.key),
          context: plan.context,
          client,
          chunkSize,
          progress,
          clock,
        }),
      );
    } catch (error) {
      error.completedDatabases = results.map((result) => result.key);
      throw error;
    } finally {
      await client.end();
    }
    progress.reset();
  }
  return {
    ms: clock() - startedAt,
    databases: results,
    fingerprint: sha256(
      results.map((result) => `${result.key}:${result.fingerprint.hash}`).join('|'),
    ),
  };
}
