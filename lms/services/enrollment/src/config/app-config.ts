export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3003;
export const ENROLLMENT_SERVICE_NAME = 'enrollment';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'enrollment-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_ENROLLMENT_DATABASE_URL = 'postgresql://localhost:5432/enrollment_db';
export const DEFAULT_ENROLLMENT_COURSE_BASE_URL = 'http://localhost:3002';
export const DEFAULT_ENROLLMENT_COURSE_TIMEOUT_MS = 3_000;
export const DEFAULT_ENROLLMENT_COURSE_BREAKER_THRESHOLD = 3;
export const DEFAULT_ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS = 5_000;
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
