export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3002;
export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
