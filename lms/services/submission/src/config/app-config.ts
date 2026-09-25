export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3004;
export const SUBMISSION_SERVICE_NAME = 'submission';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'submission-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_SUBMISSION_DATABASE_URL = 'postgresql://localhost:5432/submission_db';
export const DEFAULT_SUBMISSION_COURSE_BASE_URL = 'http://localhost:3002';
export const DEFAULT_SUBMISSION_ENROLLMENT_BASE_URL = 'http://localhost:3003';
export const DEFAULT_SUBMISSION_STORAGE_BASE_URL = 'http://localhost:3005';
export const DEFAULT_SUBMISSION_DEPENDENCY_TIMEOUT_MS = 3_000;
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
