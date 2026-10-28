/** Client xác thực dịch vụ: một service xin token cho service đích bằng client-credentials. */
export interface ServiceClient {
  clientId: string;
  secretHash: string;
  /** Service đích (`aud`) client được xin token. */
  allowedAudiences: readonly string[];
  /** Quyền tối đa client có thể được cấp. */
  allowedScopes: readonly string[];
  active: boolean;
}

export type ScopeGrant =
  { granted: true; scopes: string[] } | { granted: false; reason: 'audience' | 'scope' };

/**
 * Quyết định scope cấp cho một lần xin token: audience phải được phép; scope yêu cầu phải là tập
 * con của scope được phép (bỏ trống thì cấp toàn bộ scope được phép).
 */
export function grantScopes(
  client: ServiceClient,
  audience: string,
  requested: string | undefined,
): ScopeGrant {
  if (!client.allowedAudiences.includes(audience)) return { granted: false, reason: 'audience' };
  const wanted = requested?.split(/\s+/u).filter(Boolean) ?? [];
  if (wanted.length === 0) return { granted: true, scopes: [...client.allowedScopes] };
  if (!wanted.every((scope) => client.allowedScopes.includes(scope))) {
    return { granted: false, reason: 'scope' };
  }
  return { granted: true, scopes: [...new Set(wanted)] };
}
