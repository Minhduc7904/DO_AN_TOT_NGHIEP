/** Hai bề mặt HTTP của mọi service: public chỉ do Gateway gọi, internal dành cho service-to-service. */
export const PUBLIC_PREFIX = 'api/v1';
export const INTERNAL_PREFIX = 'internal/v1';

/** Đường dẫn JWKS của auth (không xác thực, không nằm dưới `/api`). */
export const JWKS_PATH = '.well-known/jwks.json';
