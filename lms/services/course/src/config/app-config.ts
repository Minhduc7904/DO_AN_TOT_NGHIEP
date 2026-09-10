export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3002;
export const COURSE_SERVICE_NAME = 'course';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'course-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
