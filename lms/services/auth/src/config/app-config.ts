export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3001;
export const AUTH_SERVICE_NAME = 'auth';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'auth-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_AUTH_DATABASE_URL =
  'postgresql://auth_user:auth-local-only@localhost:5432/auth_db';
export const DEFAULT_AUTH_JWT_SECRET = 'local-development-only-jwt-secret-change-before-production';
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
