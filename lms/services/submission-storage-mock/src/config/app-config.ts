export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3005;
export const STORAGE_MOCK_SERVICE_NAME = 'submission-storage';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'submission-storage-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_STORAGE_MOCK_LATENCY_MS = 0;
export const DEFAULT_STORAGE_MOCK_ERROR_MODE = 'none';
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
