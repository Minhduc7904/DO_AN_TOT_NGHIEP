export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3007;
export const GRADING_SERVICE_NAME = 'grading';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'grading-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_GRADING_DATABASE_URL = 'postgresql://localhost:5432/grading_db';
export const DEFAULT_GRADING_SUBMISSION_BASE_URL = 'http://localhost:3004';
export const DEFAULT_GRADING_DEPENDENCY_TIMEOUT_MS = 3_000;
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
