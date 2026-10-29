// Sinh định danh, số ngẫu nhiên và thời gian xác định bằng biểu thức SQL.
// Mọi dòng seed có id bắt đầu bằng `5eed` để seeder nhận ra và dọn lại được, không đụng dữ liệu khác.

export const SEED_PREFIX = '5eed';
export const SEED_BASE_TIME = '2026-08-27 09:00:00+00';

// Mã bốn chữ số hex cho từng loại bản ghi; id = 5eed<mã>-0000-4000-8000-<chỉ số 12 hex>.
export const KINDS = Object.freeze({
  user: '0001',
  instructor: '0002',
  course: '0010',
  lesson: '0011',
  quiz: '0012',
  question: '0013',
  option: '0014',
  enrollment: '0015',
  progress: '0016',
  attempt: '0017',
  answer: '0018',
  media: '0020',
  mediaThumbnail: '0021',
  mediaUsage: '0022',
  thumbnailUsage: '0023',
  notification: '0030',
  bulkNotification: '0031',
  notificationBatch: '0032',
  notificationItem: '0033',
  aiInvocation: '0040',
  aiDocument: '0041',
  aiJob: '0042',
  aiModel: '0043',
  backgroundJob: '0050',
  backgroundJobRun: '0051',
});

function kindCode(kind) {
  const code = KINDS[kind];
  if (!code) throw new Error(`Loại bản ghi không hợp lệ: ${kind}`);
  return code;
}

/** Biểu thức SQL trả uuid xác định cho `kind` và chỉ số `indexSql` (số nguyên). */
export function idSql(kind, indexSql) {
  return `('${SEED_PREFIX}${kindCode(kind)}-0000-4000-8000-' || lpad(to_hex((${indexSql})::bigint), 12, '0'))::uuid`;
}

/** uuid xác định băm từ một biểu thức văn bản, dùng khi không có chỉ số tuần tự (đáp án quiz). */
export function hashedIdSql(kind, textSql) {
  const digest = `md5(${textSql})`;
  return `('${SEED_PREFIX}${kindCode(kind)}-' || substr(${digest}, 1, 4) || '-4' || substr(${digest}, 5, 3) || '-8' || substr(${digest}, 8, 3) || '-' || substr(${digest}, 11, 12))::uuid`;
}

/** Khoảng id [từ, đến) của một loại bản ghi, dùng để đếm, dọn và băm fingerprint theo chỉ mục khóa chính. */
export function kindRangeSql(kind, column = 'id') {
  const value = Number.parseInt(kindCode(kind), 16);
  const lower = `${SEED_PREFIX}${value.toString(16).padStart(4, '0')}`;
  const upper = `${SEED_PREFIX}${(value + 1).toString(16).padStart(4, '0')}`;
  return `${column} >= '${lower}-0000-0000-0000-000000000000'::uuid AND ${column} < '${upper}-0000-0000-0000-000000000000'::uuid`;
}

/** Toàn bộ id seed (mọi loại). */
export function seedRangeSql(column = 'id') {
  return `${column} >= '${SEED_PREFIX}0000-0000-0000-0000-000000000000'::uuid AND ${column} < '5eee0000-0000-0000-0000-000000000000'::uuid`;
}

/** Số nguyên không âm ổn định trong [0, modulus) từ seed và một khóa (biểu thức SQL). */
export function randomSql(seed, keySql, modulus) {
  return `((('x' || substr(md5('${seed}:' || (${keySql})::text), 1, 8))::bit(32)::bigint) % ${modulus})`;
}

/** Thời điểm cố định = mốc seed + `secondsSql` giây (không dùng now() nên fingerprint ổn định). */
export function timeSql(secondsSql) {
  return `(TIMESTAMPTZ '${SEED_BASE_TIME}' + (${secondsSql}) * INTERVAL '1 second')`;
}

export function seedEmail(prefix, index) {
  return `${prefix}-${index}@seed.test`;
}
