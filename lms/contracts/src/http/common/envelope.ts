import { z } from 'zod';

/** UUID dùng cho mọi định danh tài nguyên. */
export const idSchema = z.uuid();

export const ROLES = ['student', 'instructor', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type RoleDto = z.infer<typeof roleSchema>;

// ---------------------------------------------------------------------------------------------
// Phân trang: một quy ước cho mọi endpoint danh sách.
// ---------------------------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Query phân trang chuẩn: `?page=1&page_size=20`. Endpoint danh sách mở rộng schema này. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Phần phân trang trong `meta` của response danh sách. */
export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  page_size: z.number().int().min(1).max(MAX_PAGE_SIZE),
  total: z.number().int().min(0),
  total_pages: z.number().int().min(0),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function buildPaginationMeta(query: PaginationQuery, total: number): PaginationMeta {
  return {
    page: query.page,
    page_size: query.page_size,
    total,
    total_pages: Math.ceil(total / query.page_size),
  };
}

// ---------------------------------------------------------------------------------------------
// Envelope phản hồi: success và lỗi có cùng bốn khóa `success`, `data`, `error`, `meta`.
// ---------------------------------------------------------------------------------------------

export const responseMetaSchema = z.object({
  trace_id: z.string(),
  timestamp: z.iso.datetime(),
  /** Chỉ có ở response danh sách; `null` ở mọi response khác. */
  pagination: paginationMetaSchema.nullable(),
});
export type ResponseMeta = z.infer<typeof responseMetaSchema>;

export const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().nullable(),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

export function apiSuccessSchema<TData extends z.ZodType>(data: TData) {
  return z.object({
    success: z.literal(true),
    data,
    error: z.null(),
    meta: responseMetaSchema,
  });
}

export const apiErrorSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: errorBodySchema,
  meta: responseMetaSchema,
});

export type ApiSuccess<TData> = {
  success: true;
  data: TData;
  error: null;
  meta: ResponseMeta;
};
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiResponse<TData> = ApiSuccess<TData> | ApiError;

/** Response một tài nguyên hoặc một kết quả. */
export function apiResponseSchema<TData extends z.ZodType>(data: TData) {
  return z.union([apiSuccessSchema(data), apiErrorSchema]);
}

/** Response danh sách: `data` là mảng, `meta.pagination` luôn có. */
export function apiListResponseSchema<TItem extends z.ZodType>(item: TItem) {
  return apiResponseSchema(z.array(item));
}
