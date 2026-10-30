import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` (lúc build image) không cần kết nối; `migrate deploy` yêu cầu biến này có giá trị.
  datasource: { url: process.env['IDENTITY_DATABASE_URL'] ?? '' },
});
