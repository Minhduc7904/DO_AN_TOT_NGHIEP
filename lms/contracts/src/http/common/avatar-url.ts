import { PUBLIC_PREFIX } from './prefix.js';

/**
 * URL công khai (qua Gateway) của avatar một tài khoản, dựng thuần từ id nên service nào cũng tính được mà không
 * gọi `media`. Luôn có giá trị: tài khoản chưa đặt avatar thì GET trả `404`.
 */
export const userAvatarUrl = (userId: string): string =>
  `/${PUBLIC_PREFIX}/media/avatars/${userId}`;
