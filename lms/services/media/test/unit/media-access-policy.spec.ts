import { MediaAccessPolicy } from '../../src/application/media-access-policy.js';
import type { GetMediaContentUseCase } from '../../src/application/use-cases/media/get-media-content.use-case.js';
import type { GetMediaThumbnailUseCase } from '../../src/application/use-cases/media/get-media-thumbnail.use-case.js';
import { ServePublicMediaUseCase } from '../../src/application/use-cases/media/serve-public-media.use-case.js';
import type { MediaObject, UsageType } from '../../src/domain/media.js';
import { MediaUrlSigner } from '../../src/domain/url-signer.js';
import { InMemoryUnitOfWork } from './fakes.js';

const NOW = new Date('2026-11-03T10:00:00Z');
const MEDIA = 'cccccccc-0000-4000-8000-000000000001';
const OTHER = 'cccccccc-0000-4000-8000-000000000002';
const OWNER = 'dddddddd-0000-4000-8000-000000000001';

const signer = new MediaUrlSigner({ key: 'khoa-thu-nghiem-chi-dung-cho-test', ttlSeconds: 900 });
const clock = { now: () => NOW };

function signed(id: string, variant: 'content' | 'thumbnail'): { exp: string; sig: string } {
  const params = new URLSearchParams(signer.query(id, variant, NOW));
  return { exp: params.get('exp')!, sig: params.get('sig')! };
}

async function setup(usageType?: UsageType): Promise<{
  policy: MediaAccessPolicy;
  serve: ServePublicMediaUseCase;
  opened: string[];
}> {
  const uow = new InMemoryUnitOfWork();
  if (usageType) {
    await uow.stores.usages.create({
      id: 'eeeeeeee-0000-4000-8000-000000000001',
      mediaId: MEDIA,
      ownerKind: usageType === 'USER_AVATAR' ? 'USER' : 'COURSE',
      ownerId: OWNER,
      usageType,
      position: 0,
      createdBy: OWNER,
    });
  }
  const opened: string[] = [];
  const opener = (kind: string) => (mediaId: string) => {
    opened.push(`${kind}:${mediaId}`);
    return Promise.resolve({ media: { id: mediaId } as MediaObject });
  };
  const policy = new MediaAccessPolicy(uow, signer, clock);
  const serve = new ServePublicMediaUseCase(
    policy,
    { execute: opener('content') } as unknown as GetMediaContentUseCase,
    { execute: opener('thumbnail') } as unknown as GetMediaThumbnailUseCase,
  );
  return { policy, serve, opened };
}

describe('MediaAccessPolicy', () => {
  it('URL trần của media chỉ có usage tầng SIGNED (hoặc chưa có usage) là 404', async () => {
    for (const usageType of [undefined, 'LESSON_ATTACHMENT', 'QUIZ_CONTENT'] as const) {
      const { policy } = await setup(usageType);
      await expect(policy.assertCanView(MEDIA, 'content', {})).rejects.toMatchObject({
        status: 404,
      });
    }
  });

  it('URL trần của media có usage tầng PUBLIC được xem', async () => {
    for (const usageType of ['COURSE_THUMBNAIL', 'COURSE_DESCRIPTION', 'USER_AVATAR'] as const) {
      const { policy } = await setup(usageType);
      await expect(policy.assertCanView(MEDIA, 'content', {})).resolves.toBe('PUBLIC');
    }
  });

  it('chữ ký hợp lệ cho xem kể cả media chưa gắn usage', async () => {
    const { policy } = await setup();
    await expect(policy.assertCanView(MEDIA, 'content', signed(MEDIA, 'content'))).resolves.toBe(
      'SIGNED',
    );
  });

  it('chữ ký sai, của media khác hoặc của variant khác là 403 MEDIA_URL_INVALID', async () => {
    const { policy } = await setup('LESSON_ATTACHMENT');
    const valid = signed(MEDIA, 'content');
    const cases = [
      { exp: valid.exp, sig: `${valid.sig.slice(0, -1)}A` },
      signed(OTHER, 'content'),
      signed(MEDIA, 'thumbnail'),
    ];
    for (const access of cases) {
      await expect(policy.assertCanView(MEDIA, 'content', access)).rejects.toMatchObject({
        status: 403,
        code: 'MEDIA_URL_INVALID',
      });
    }
  });

  it('chữ ký hết hạn là 403', async () => {
    const valid = signed(MEDIA, 'content');
    const late = new MediaAccessPolicy(new InMemoryUnitOfWork(), signer, {
      now: () => new Date(Number(valid.exp) * 1000 + 1),
    });
    await expect(late.assertCanView(MEDIA, 'content', valid)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('chữ ký sai trên media công khai vẫn được xem (quyền công khai độc lập với chữ ký)', async () => {
    const { policy } = await setup('COURSE_THUMBNAIL');
    await expect(policy.assertCanView(MEDIA, 'content', { exp: '1', sig: 'sai' })).resolves.toBe(
      'PUBLIC',
    );
  });
});

describe('ServePublicMediaUseCase', () => {
  it('không mở media khi bị từ chối; URL ký đánh dấu cache riêng tư, URL công khai thì không', async () => {
    const denied = await setup('LESSON_ATTACHMENT');
    await expect(denied.serve.serveContent(MEDIA, undefined, {})).rejects.toMatchObject({
      status: 404,
    });
    expect(denied.opened).toEqual([]);

    const content = await denied.serve.serveContent(MEDIA, undefined, signed(MEDIA, 'content'));
    expect(content.privateCache).toBe(true);
    const thumbnail = await denied.serve.serveThumbnail(
      MEDIA,
      undefined,
      signed(MEDIA, 'thumbnail'),
    );
    expect(thumbnail.privateCache).toBe(true);

    const open = await setup('COURSE_THUMBNAIL');
    expect((await open.serve.serveContent(MEDIA, undefined, {})).privateCache).toBe(false);
  });

  it('chữ ký của content không mở được thumbnail', async () => {
    const { serve, opened } = await setup('LESSON_ATTACHMENT');
    await expect(
      serve.serveThumbnail(MEDIA, undefined, signed(MEDIA, 'content')),
    ).rejects.toMatchObject({ status: 403 });
    expect(opened).toEqual([]);
  });
});
