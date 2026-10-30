-- Avatar áp dụng cho mọi role (student, instructor, admin): owner STUDENT thành USER, usage STUDENT_AVATAR thành USER_AVATAR.
ALTER TYPE "media_usage_owner_kind" RENAME VALUE 'STUDENT' TO 'USER';
ALTER TYPE "media_usage_type" RENAME VALUE 'STUDENT_AVATAR' TO 'USER_AVATAR';

-- Partial unique index mà Prisma không biểu diễn được: mỗi tài khoản một avatar (đổi tên cho khớp).
DROP INDEX "media_usages_one_student_avatar_key";
CREATE UNIQUE INDEX "media_usages_one_user_avatar_key" ON "media_usages"("owner_id") WHERE "usage_type" = 'USER_AVATAR';
