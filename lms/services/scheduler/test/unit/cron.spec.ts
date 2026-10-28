import { InvalidCronExpressionError, nextCronFire, parseCron } from '../../src/domain/cron.js';

const next = (expression: string, after: string): string | null =>
  nextCronFire(parseCron(expression), new Date(after))?.toISOString() ?? null;

describe('parseCron + nextCronFire (UTC)', () => {
  it('chạy mỗi phút: luôn là phút kế tiếp, kể cả khi `after` đang đúng mốc', () => {
    expect(next('* * * * *', '2026-10-28T08:00:30Z')).toBe('2026-10-28T08:01:00.000Z');
    expect(next('* * * * *', '2026-10-28T08:01:00Z')).toBe('2026-10-28T08:02:00.000Z');
  });

  it('mốc giờ cố định và bước phút', () => {
    expect(next('0 3 * * *', '2026-10-28T08:00:00Z')).toBe('2026-10-29T03:00:00.000Z');
    expect(next('0 3 * * *', '2026-10-28T02:59:59Z')).toBe('2026-10-28T03:00:00.000Z');
    expect(next('*/15 * * * *', '2026-10-28T08:07:00Z')).toBe('2026-10-28T08:15:00.000Z');
    expect(next('*/15 * * * *', '2026-10-28T08:45:00Z')).toBe('2026-10-28T09:00:00.000Z');
    expect(next('5-10/2 9 * * *', '2026-10-28T09:05:00Z')).toBe('2026-10-28T09:07:00.000Z');
  });

  it('danh sách và khoảng', () => {
    expect(next('0 8,20 * * *', '2026-10-28T08:00:00Z')).toBe('2026-10-28T20:00:00.000Z');
    expect(next('30 9 * * 1-5', '2026-10-30T10:00:00Z')).toBe('2026-11-02T09:30:00.000Z');
  });

  it('ngày trong tuần: 0 và 7 đều là Chủ nhật, hỗ trợ tên', () => {
    // 2026-10-28 là Thứ tư; Chủ nhật kế tiếp là 2026-11-01.
    expect(next('0 0 * * 0', '2026-10-28T00:00:00Z')).toBe('2026-11-01T00:00:00.000Z');
    expect(next('0 0 * * 7', '2026-10-28T00:00:00Z')).toBe('2026-11-01T00:00:00.000Z');
    expect(next('0 0 * * sun', '2026-10-28T00:00:00Z')).toBe('2026-11-01T00:00:00.000Z');
    expect(next('0 0 * * MON-WED', '2026-10-28T00:00:00Z')).toBe('2026-11-02T00:00:00.000Z');
  });

  it('ngày-trong-tháng và ngày-trong-tuần cùng bị giới hạn thì khớp một trong hai', () => {
    // Ngày mùng 1 hoặc Thứ hai: 01/11/2026 là Chủ nhật nên khớp theo ngày, sau đó là Thứ hai 02/11.
    expect(next('0 0 1 * 1', '2026-10-28T00:00:00Z')).toBe('2026-11-01T00:00:00.000Z');
    expect(next('0 0 1 * 1', '2026-11-01T00:00:00Z')).toBe('2026-11-02T00:00:00.000Z');
  });

  it('tháng, tên tháng và năm nhuận', () => {
    expect(next('0 0 1 jan *', '2026-10-28T00:00:00Z')).toBe('2027-01-01T00:00:00.000Z');
    expect(next('0 0 29 2 *', '2026-10-28T00:00:00Z')).toBe('2028-02-29T00:00:00.000Z');
    expect(next('0 0 31 * *', '2026-11-01T00:00:00Z')).toBe('2026-12-31T00:00:00.000Z');
  });

  it('macro', () => {
    expect(next('@hourly', '2026-10-28T08:10:00Z')).toBe('2026-10-28T09:00:00.000Z');
    expect(next('@daily', '2026-10-28T08:10:00Z')).toBe('2026-10-29T00:00:00.000Z');
    expect(next('@weekly', '2026-10-28T08:10:00Z')).toBe('2026-11-01T00:00:00.000Z');
    expect(next('@monthly', '2026-10-28T08:10:00Z')).toBe('2026-11-01T00:00:00.000Z');
    expect(next('@yearly', '2026-10-28T08:10:00Z')).toBe('2027-01-01T00:00:00.000Z');
  });

  it('chuẩn hóa khoảng trắng thừa', () => {
    expect(next('  0   3  * *   * ', '2026-10-28T08:00:00Z')).toBe('2026-10-29T03:00:00.000Z');
  });

  it('biểu thức không bao giờ khớp trả null', () => {
    expect(next('0 0 30 2 *', '2026-10-28T00:00:00Z')).toBeNull();
  });

  it('chuỗi chạy liên tiếp luôn tăng ngặt và đúng bước', () => {
    const schedule = parseCron('*/20 */6 * * *');
    let cursor = new Date('2026-10-28T00:00:00Z');
    const fires: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      cursor = nextCronFire(schedule, cursor) as Date;
      fires.push(cursor.toISOString());
    }
    expect(fires).toEqual([
      '2026-10-28T00:20:00.000Z',
      '2026-10-28T00:40:00.000Z',
      '2026-10-28T06:00:00.000Z',
      '2026-10-28T06:20:00.000Z',
      '2026-10-28T06:40:00.000Z',
      '2026-10-28T12:00:00.000Z',
      '2026-10-28T12:20:00.000Z',
      '2026-10-28T12:40:00.000Z',
    ]);
  });

  it.each([
    ['', 'đúng 5 trường'],
    ['* * * *', 'đúng 5 trường'],
    ['* * * * * *', 'đúng 5 trường'],
    ['60 * * * *', 'ngoài khoảng'],
    ['* 24 * * *', 'ngoài khoảng'],
    ['* * 0 * *', 'ngoài khoảng'],
    ['* * * 13 *', 'ngoài khoảng'],
    ['* * * * 8', 'ngoài khoảng'],
    ['*/0 * * * *', 'Bước'],
    ['*/x * * * *', 'Bước'],
    ['5-1 * * * *', 'bị ngược'],
    ['a * * * *', 'không hợp lệ'],
    ['1,,2 * * * *', 'rỗng'],
    ['1-2-3 * * * *', 'sai'],
    ['1/2/3 * * * *', '"/"'],
    ['? * * * *', 'không hợp lệ'],
    ['L * * * *', 'không hợp lệ'],
  ])('từ chối "%s"', (expression, message) => {
    expect(() => parseCron(expression)).toThrow(InvalidCronExpressionError);
    expect(() => parseCron(expression)).toThrow(message);
  });
});
