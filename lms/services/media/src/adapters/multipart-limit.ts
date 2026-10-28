/**
 * Giới hạn multipart đọc từ môi trường khi module nạp (decorator `FileInterceptor` cần giá trị
 * ngay lúc định nghĩa class). Giá trị mặc định khớp `MEDIA_MULTIPART_MAX_BYTES` trong env schema.
 */
export const MEDIA_MULTIPART_MAX_BYTES = {
  value: Number(process.env['MEDIA_MULTIPART_MAX_BYTES'] ?? 26_214_400),
};
