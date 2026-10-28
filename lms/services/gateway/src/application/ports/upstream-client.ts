import type { UpstreamName } from '../../domain/route-table.js';

export interface UpstreamRequest {
  method: string;
  /** Path đã chuẩn hóa kèm query. */
  target: string;
  headers: Record<string, string>;
  /** Body client gửi lên, được chuyển tiếp dạng stream (multipart, JSON); `null` khi không có. */
  body: AsyncIterable<Uint8Array> | null;
  /** Hủy lời gọi upstream khi client ngắt kết nối. */
  signal: AbortSignal;
}

export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: AsyncIterable<Uint8Array> | null;
}

export interface UpstreamClient {
  /**
   * Chuyển request tới upstream. Mọi phản hồi HTTP của upstream (kể cả 4xx/5xx và mã nghiệp vụ
   * như `AI_PROVIDER_ERROR`) được trả nguyên vẹn; chỉ lỗi kết nối hoặc quá hạn mới ném
   * `AppError` dependency.
   */
  forward(upstream: UpstreamName, request: UpstreamRequest): Promise<UpstreamResponse>;
}

export const UPSTREAM_CLIENT = Symbol('UpstreamClient');
