/** Đường dẫn công khai qua Gateway; client chỉ thấy các URL này, không thấy bucket hay object key. */
export const PUBLIC_MEDIA_BASE = '/api/v1/media';

export const mediaContentUrl = (mediaId: string): string =>
  `${PUBLIC_MEDIA_BASE}/${mediaId}/content`;
export const mediaThumbnailUrl = (mediaId: string): string =>
  `${PUBLIC_MEDIA_BASE}/${mediaId}/thumbnail`;
