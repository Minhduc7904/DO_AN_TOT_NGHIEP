export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3002;
export const COURSE_SERVICE_NAME = 'course';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'course-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_COURSE_DATABASE_URL = 'postgresql://localhost:5432/course_db';
export const DEFAULT_COURSE_REDIS_URL = 'redis://localhost:6379';
export const DEFAULT_COURSE_CACHE_TTL_SECONDS = 60;
export const DEFAULT_COURSE_CACHE_TIMEOUT_MS = 300;
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
