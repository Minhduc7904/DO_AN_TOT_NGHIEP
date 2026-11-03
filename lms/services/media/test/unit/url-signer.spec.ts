import { MediaUrlSigner } from '../../src/domain/url-signer.js';

const ID = '5eed0000-0000-4000-8000-000000000001';
const OTHER_ID = '5eed0000-0000-4000-8000-000000000002';
const NOW = new Date('2026-11-03T10:00:00Z');

const signer = new MediaUrlSigner({ key: 'khoa-thu-nghiem-chi-dung-cho-test', ttlSeconds: 900 });
const parse = (query: string): { exp: string; sig: string } => {
  const params = new URLSearchParams(query);
  return { exp: params.get('exp') ?? '', sig: params.get('sig') ?? '' };
};

describe('ký URL media', () => {
  it('chữ ký hợp lệ xác minh được trong thời hạn', () => {
    const { exp, sig } = parse(signer.query(ID, 'content', NOW));
    expect(signer.verify(ID, 'content', exp, sig, NOW)).toBe(true);
    expect(signer.verify(ID, 'content', exp, sig, new Date(NOW.getTime() + 899_000))).toBe(true);
  });

  it('URL sống tối thiểu một TTL và không quá hai TTL', () => {
    const { exp } = signer.sign(ID, 'content', NOW);
    const lifetimeSeconds = exp - Math.floor(NOW.getTime() / 1000);
    expect(lifetimeSeconds).toBeGreaterThanOrEqual(900);
    expect(lifetimeSeconds).toBeLessThanOrEqual(1800);
  });

  it('cùng cửa sổ thì URL giống hệt (cache được), sang cửa sổ sau thì khác', () => {
    const mid = new Date(NOW.getTime() + 60_000);
    const first = signer.query(ID, 'content', mid);
    expect(signer.query(ID, 'content', new Date(mid.getTime() + 1_000))).toBe(first);
    expect(signer.query(ID, 'content', new Date(mid.getTime() + 1_800_000))).not.toBe(first);
  });

  it('hết hạn thì bị từ chối', () => {
    const { exp, sig } = parse(signer.query(ID, 'content', NOW));
    const after = new Date(Number(exp) * 1000 + 1);
    expect(signer.verify(ID, 'content', exp, sig, after)).toBe(false);
  });

  it('đổi media id, variant, exp hoặc sig đều bị từ chối', () => {
    const { exp, sig } = parse(signer.query(ID, 'content', NOW));
    expect(signer.verify(OTHER_ID, 'content', exp, sig, NOW)).toBe(false);
    expect(signer.verify(ID, 'thumbnail', exp, sig, NOW)).toBe(false);
    expect(signer.verify(ID, 'content', String(Number(exp) + 3600), sig, NOW)).toBe(false);
    expect(signer.verify(ID, 'content', exp, `${sig.slice(0, -1)}A`, NOW)).toBe(false);
  });

  it('khóa khác thì chữ ký không hợp lệ', () => {
    const { exp, sig } = parse(signer.query(ID, 'content', NOW));
    const other = new MediaUrlSigner({ key: 'mot-khoa-khac-hoan-toan-xyz', ttlSeconds: 900 });
    expect(other.verify(ID, 'content', exp, sig, NOW)).toBe(false);
  });

  it('exp phải ở dạng chuẩn và không xa hơn hai TTL', () => {
    const { exp, sig } = parse(signer.query(ID, 'content', NOW));
    expect(signer.verify(ID, 'content', `0${exp}`, sig, NOW)).toBe(false);
    const far = new MediaUrlSigner({
      key: 'khoa-thu-nghiem-chi-dung-cho-test',
      ttlSeconds: 86_400,
    });
    const farQuery = parse(far.query(ID, 'content', NOW));
    expect(signer.verify(ID, 'content', farQuery.exp, farQuery.sig, NOW)).toBe(false);
  });

  it('đúng thời điểm exp thì hết hạn; sig khác độ dài hoặc tham số lặp (mảng) đều bị từ chối', () => {
    const { exp, sig } = parse(signer.query(ID, 'content', NOW));
    expect(signer.verify(ID, 'content', exp, sig, new Date(Number(exp) * 1000))).toBe(false);
    expect(signer.verify(ID, 'content', exp, sig.slice(0, 10), NOW)).toBe(false);
    expect(signer.verify(ID, 'content', exp, [sig, sig], NOW)).toBe(false);
    expect(signer.verify(ID, 'content', [exp], sig, NOW)).toBe(false);
  });

  it('thiếu hoặc sai định dạng exp/sig đều là không hợp lệ, không ném lỗi', () => {
    expect(signer.verify(ID, 'content', undefined, undefined, NOW)).toBe(false);
    expect(signer.verify(ID, 'content', 'abc', 'xyz', NOW)).toBe(false);
    expect(signer.verify(ID, 'content', '-1', 'xyz', NOW)).toBe(false);
    expect(signer.verify(ID, 'content', '99999999999999999', 'x', NOW)).toBe(false);
  });
});
