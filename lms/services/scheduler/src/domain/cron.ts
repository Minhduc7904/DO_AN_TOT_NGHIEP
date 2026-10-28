/**
 * Bộ phân tích biểu thức CRON 5 trường (`phút giờ ngày-trong-tháng tháng ngày-trong-tuần`) theo UTC.
 *
 * Hỗ trợ `*`, danh sách `a,b`, khoảng `a-b`, bước (dấu gạch chéo kèm n, ví dụ `a-b/n`), tên tháng/thứ ba chữ cái
 * (`JAN`, `MON`) và macro `@hourly @daily @midnight @weekly @monthly @yearly @annually`. Ngày-trong-
 * tháng và ngày-trong-tuần theo luật của cron: nếu cả hai cùng bị giới hạn (không bắt đầu bằng `*`)
 * thì chỉ cần một trong hai khớp. Không hỗ trợ `L`, `W`, `#`, `?`, giây và múi giờ.
 */

export class InvalidCronExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCronExpressionError';
  }
}

export interface CronSchedule {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly daysOfMonth: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  /** 0 = Chủ nhật … 6 = Thứ bảy. */
  readonly daysOfWeek: ReadonlySet<number>;
  /** Trường ngày-trong-tháng bắt đầu bằng `*` (không giới hạn). */
  readonly domWildcard: boolean;
  readonly dowWildcard: boolean;
}

const MACROS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: readonly string[];
  /** Giá trị đầu tiên của `names` (tháng bắt đầu từ 1, thứ từ 0). */
  nameOffset?: number;
}

const FIELDS: readonly FieldSpec[] = [
  { name: 'phút', min: 0, max: 59 },
  { name: 'giờ', min: 0, max: 23 },
  { name: 'ngày-trong-tháng', min: 1, max: 31 },
  { name: 'tháng', min: 1, max: 12, names: MONTH_NAMES, nameOffset: 1 },
  { name: 'ngày-trong-tuần', min: 0, max: 7, names: DAY_NAMES, nameOffset: 0 },
];

function parseValue(token: string, field: FieldSpec): number {
  const upper = token.toUpperCase();
  const named = field.names?.indexOf(upper) ?? -1;
  if (field.names && named >= 0) return named + (field.nameOffset ?? 0);
  if (!/^\d+$/u.test(token)) {
    throw new InvalidCronExpressionError(`Giá trị "${token}" không hợp lệ ở trường ${field.name}`);
  }
  const value = Number(token);
  if (value < field.min || value > field.max) {
    throw new InvalidCronExpressionError(
      `Giá trị ${value} ngoài khoảng ${field.min}–${field.max} ở trường ${field.name}`,
    );
  }
  return value;
}

function parseField(text: string, field: FieldSpec): Set<number> {
  const values = new Set<number>();
  for (const part of text.split(',')) {
    if (part === '') {
      throw new InvalidCronExpressionError(`Trường ${field.name} có phần tử rỗng`);
    }
    const [rangeText = '', stepText, ...extra] = part.split('/');
    if (extra.length > 0) {
      throw new InvalidCronExpressionError(`Trường ${field.name} có quá nhiều dấu "/"`);
    }
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/u.test(stepText) || Number(stepText) < 1) {
        throw new InvalidCronExpressionError(
          `Bước "${stepText}" ở trường ${field.name} không hợp lệ`,
        );
      }
      step = Number(stepText);
    }

    let start: number;
    let end: number;
    if (rangeText === '*') {
      start = field.min;
      end = field.max;
    } else {
      const [from = '', to, ...rest] = rangeText.split('-');
      if (rest.length > 0) {
        throw new InvalidCronExpressionError(`Khoảng "${rangeText}" ở trường ${field.name} sai`);
      }
      start = parseValue(from, field);
      // `a/n` nghĩa là từ a đến hết khoảng của trường.
      end = to === undefined ? (stepText === undefined ? start : field.max) : parseValue(to, field);
      if (start > end) {
        throw new InvalidCronExpressionError(
          `Khoảng "${rangeText}" ở trường ${field.name} bị ngược`,
        );
      }
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

export function parseCron(expression: string): CronSchedule {
  const trimmed = expression.trim().replace(/\s+/gu, ' ');
  const text = MACROS[trimmed.toLowerCase()] ?? trimmed;
  const parts = text.split(' ');
  if (parts.length !== 5) {
    throw new InvalidCronExpressionError(
      'Biểu thức CRON phải có đúng 5 trường: phút giờ ngày-trong-tháng tháng ngày-trong-tuần',
    );
  }
  const [minute, hour, dom, month, dow] = parts as [string, string, string, string, string];
  const [minuteSpec, hourSpec, domSpec, monthSpec, dowSpec] = FIELDS as [
    FieldSpec,
    FieldSpec,
    FieldSpec,
    FieldSpec,
    FieldSpec,
  ];
  // 7 cũng là Chủ nhật.
  const daysOfWeek = new Set([...parseField(dow, dowSpec)].map((day) => day % 7));
  return {
    minutes: parseField(minute, minuteSpec),
    hours: parseField(hour, hourSpec),
    daysOfMonth: parseField(dom, domSpec),
    months: parseField(month, monthSpec),
    daysOfWeek,
    domWildcard: dom.startsWith('*'),
    dowWildcard: dow.startsWith('*'),
  };
}

function dayMatches(schedule: CronSchedule, date: Date): boolean {
  const domMatch = schedule.daysOfMonth.has(date.getUTCDate());
  const dowMatch = schedule.daysOfWeek.has(date.getUTCDay());
  if (schedule.domWildcard && schedule.dowWildcard) return true;
  if (schedule.domWildcard) return dowMatch;
  if (schedule.dowWildcard) return domMatch;
  return domMatch || dowMatch;
}

/** Biểu thức không bao giờ khớp (ví dụ 30/2) bị loại sau ngần này năm. */
const SEARCH_YEARS = 8;

/**
 * Thời điểm chạy đầu tiên **sau** `after` (UTC, tròn phút), hoặc `null` nếu không có trong
 * `SEARCH_YEARS` năm tới.
 */
export function nextCronFire(schedule: CronSchedule, after: Date): Date | null {
  const limit = after.getUTCFullYear() + SEARCH_YEARS;
  let cursor = new Date(
    Date.UTC(
      after.getUTCFullYear(),
      after.getUTCMonth(),
      after.getUTCDate(),
      after.getUTCHours(),
      after.getUTCMinutes() + 1,
    ),
  );
  while (cursor.getUTCFullYear() <= limit) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const day = cursor.getUTCDate();
    const hour = cursor.getUTCHours();
    if (!schedule.months.has(month + 1)) {
      cursor = new Date(Date.UTC(year, month + 1, 1));
    } else if (!dayMatches(schedule, cursor)) {
      cursor = new Date(Date.UTC(year, month, day + 1));
    } else if (!schedule.hours.has(hour)) {
      cursor = new Date(Date.UTC(year, month, day, hour + 1));
    } else if (!schedule.minutes.has(cursor.getUTCMinutes())) {
      cursor = new Date(cursor.getTime() + 60_000);
    } else {
      return cursor;
    }
  }
  return null;
}
