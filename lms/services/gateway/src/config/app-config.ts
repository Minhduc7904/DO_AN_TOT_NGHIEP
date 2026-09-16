export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3000;
export const DEFAULT_AUTH_BASE_URL = 'http://localhost:3001';
export const DEFAULT_COURSE_BASE_URL = 'http://localhost:3002';
export const DEFAULT_JWT_SECRET = 'local-development-only-jwt-secret-change-before-production';
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000;
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'gateway-local-1';
export const GATEWAY_SERVICE_NAME = 'gateway';
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
