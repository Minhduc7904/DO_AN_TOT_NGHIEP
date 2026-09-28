export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3006;
export const NOTIFICATION_SERVICE_NAME = 'notification';
export const DEFAULT_SERVICE_VERSION = '0.1.0';
export const DEFAULT_SERVICE_INSTANCE_ID = 'notification-local-1';
export const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';
export const DEFAULT_NOTIFICATION_RABBITMQ_URL = 'amqp://lms:lms-local-only@localhost:5672';
export const DEFAULT_GRADE_COMPLETED_EXCHANGE = 'lms.events';
export const DEFAULT_GRADE_COMPLETED_QUEUE = 'notification.grade-completed.v1';
export const DEFAULT_NOTIFICATION_CONSUMER_PREFETCH = 1;
export const DEFAULT_NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED = false;
export const DEFAULT_NOTIFICATION_CONSUMER_SLOWDOWN_MS = 0;
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
