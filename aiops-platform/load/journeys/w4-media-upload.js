import { api, waitFor } from '../lib/api.js';
import { PNG_1X1 } from '../lib/bytes.js';
import { runIteration, seedInstructorSession, think, uploadMedia } from './session.js';

const J = 'w4';

/**
 * W4 — upload media: upload ảnh trực tiếp lên MinIO, đọc lại nội dung, chờ `media-worker` sinh
 * thumbnail, xem thư viện và đặt ảnh làm avatar. Media của dòng seed không có object nên luôn upload
 * tệp thật.
 */
export function w4MediaUpload() {
  runIteration(J, ({ rng }) => {
    const { token, id } = seedInstructorSession(J);
    const { mediaId } = uploadMedia(J, token, {
      content: PNG_1X1,
      fileName: 'anh-k6.png',
      mimeType: 'image/png',
    });
    think(rng);

    api('GET', `/api/v1/media/${mediaId}/content`, {
      journey: J,
      name: 'GET /api/v1/media/:media_id/content',
    });
    waitFor(J, 'thumbnail READY', () => {
      const library = api('GET', '/api/v1/media/library?page_size=20', {
        journey: J,
        name: 'GET /api/v1/media/library',
        token,
      }).data;
      const entry = library.find((item) => item.id === mediaId);
      return entry && entry.thumbnail_status !== 'PENDING' ? entry : null;
    });
    api('GET', `/api/v1/media/${mediaId}/thumbnail`, {
      journey: J,
      name: 'GET /api/v1/media/:media_id/thumbnail',
    });
    think(rng);

    api('POST', '/api/v1/media/usages', {
      journey: J,
      token,
      expected: [201],
      body: { media_id: mediaId, owner_kind: 'USER', owner_id: id, usage_type: 'USER_AVATAR' },
    });
    api('GET', `/api/v1/media/avatars/${id}`, {
      journey: J,
      name: 'GET /api/v1/media/avatars/:user_id',
    });
    think(rng);
  });
}
