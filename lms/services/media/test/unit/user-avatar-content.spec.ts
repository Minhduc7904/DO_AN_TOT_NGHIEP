import type { MediaObject } from '../../src/domain/media.js';
import type { GetMediaContentUseCase } from '../../src/application/use-cases/media/get-media-content.use-case.js';
import { GetUserAvatarContentUseCase } from '../../src/application/use-cases/media/get-user-avatar-content.use-case.js';
import { InMemoryUnitOfWork } from './fakes.js';

const userId = '33333333-3333-4333-8333-333333333333';

function setup(): {
  uow: InMemoryUnitOfWork;
  opened: string[];
  useCase: GetUserAvatarContentUseCase;
} {
  const uow = new InMemoryUnitOfWork();
  const opened: string[] = [];
  const content = {
    execute: (mediaId: string) => {
      opened.push(mediaId);
      return Promise.resolve({ media: { id: mediaId } as MediaObject });
    },
  } as unknown as GetMediaContentUseCase;
  return { uow, opened, useCase: new GetUserAvatarContentUseCase(uow, content) };
}

describe('GetUserAvatarContentUseCase', () => {
  it('chưa đặt avatar thì 404, usage loại khác của cùng owner không được tính', async () => {
    const { uow, useCase } = setup();
    await expect(useCase.execute(userId, undefined)).rejects.toMatchObject({ status: 404 });
    for (const usage of [
      {
        id: '00000000-0000-4000-8000-000000000001',
        mediaId: '00000000-0000-4000-8000-0000000000a1',
        ownerKind: 'COURSE',
        ownerId: userId,
        usageType: 'COURSE_THUMBNAIL',
        position: 0,
        createdBy: userId,
      },
    ]) {
      await uow.stores.usages.create(usage);
    }
    await expect(useCase.execute(userId, undefined)).rejects.toMatchObject({ status: 404 });
  });

  it('mở media của usage USER_AVATAR thuộc đúng owner', async () => {
    const { uow, opened, useCase } = setup();
    for (const usage of [
      {
        id: '00000000-0000-4000-8000-000000000002',
        mediaId: '00000000-0000-4000-8000-0000000000b2',
        ownerKind: 'USER',
        ownerId: userId,
        usageType: 'USER_AVATAR',
        position: 0,
        createdBy: userId,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        mediaId: '00000000-0000-4000-8000-0000000000c3',
        ownerKind: 'USER',
        ownerId: '99999999-9999-4999-8999-999999999999',
        usageType: 'USER_AVATAR',
        position: 0,
        createdBy: userId,
      },
    ]) {
      await uow.stores.usages.create(usage);
    }

    await useCase.execute(userId, 'bytes=0-9');

    expect(opened).toEqual(['00000000-0000-4000-8000-0000000000b2']);
  });
});
