import type { Account } from '../../domain/account.js';

/** JSON `snake_case` theo contract v2; không bao giờ trả mật khẩu băm. */
export function presentAccount(account: Account): Record<string, unknown> {
  return {
    id: account.id,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    status: account.status,
    created_at: account.createdAt.toISOString(),
  };
}
