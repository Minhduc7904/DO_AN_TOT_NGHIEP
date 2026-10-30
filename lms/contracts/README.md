# Published contracts

## Trách nhiệm

Chứa HTTP và event contract đã publish để service hoặc client tích hợp mà không import source nội bộ của nhau. Mỗi contract là zod schema; kiểu TypeScript suy ra bằng `z.infer` nên schema và kiểu không lệch nhau.

## Quy tắc dependency

- Contract chỉ mô tả wire format, version và compatibility rule.
- Không chứa controller, persistence model hoặc business implementation.

## HTTP contract (`@aiops-lms/contracts/http`)

| File         | Nội dung                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common.ts`  | `idSchema`, `roleSchema`, phân trang (`paginationQuerySchema`, `paginationMetaSchema`), envelope (`apiSuccessSchema`, `apiErrorSchema`, `apiResponseSchema`, `apiListResponseSchema`) |
| `auth.ts`    | Request/response DTO của `identity` (route `/api/v1/auth/*`: `registerRequestSchema`, `loginRequestSchema`, `accountDtoSchema`, `loginResponseDtoSchema`, …)                          |
| `student.ts` | Request/response DTO hồ sơ student của `identity` (route `/api/v1/students/*`)                                                                                                        |

### Envelope thống nhất

Mọi response JSON, thành công hay lỗi, có đúng bốn khóa:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "trace_id": "…", "timestamp": "2026-11-02T10:00:00.000Z", "pagination": null }
}
```

```json
{
  "success": false,
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] },
  "meta": { "trace_id": "…", "timestamp": "…", "pagination": null }
}
```

### Phân trang

Đầu vào chung: `?page=1&page_size=20` (`page` ≥ 1, `page_size` 1–100, mặc định 20). Đầu ra: `data` là mảng và `meta.pagination = { page, page_size, total, total_pages }`. Endpoint danh sách mở rộng `paginationQuerySchema` bằng bộ lọc riêng.

### Thêm DTO mới

1. Viết request/response schema trong `src/http/<service>.ts` và export ở `src/http/index.ts`.
2. Controller parse input bằng `parseInput(schema, input)` và trả DTO qua presenter có kiểu trả về là `…Dto`.
3. Thêm test contract: response mẫu của service phải qua `apiResponseSchema(dtoSchema).parse`.
