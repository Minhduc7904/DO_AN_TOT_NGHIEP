/** Port thuần TypeScript mà domain/application của mọi service được phép dùng. */
export const ROLES = ['student', 'instructor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

export interface Principal {
  id: string;
  role: Role;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface OutboundCommand<TPayload = unknown> {
  /** Tên command, ví dụ `media.thumbnail.generate`. */
  commandName: string;
  schemaVersion: number;
  /** Routing key = tên queue của consumer. */
  routingKey: string;
  payload: TPayload;
}

/** Ghi command vào outbox trong cùng transaction với thay đổi nghiệp vụ. */
export interface CommandOutbox {
  enqueue<TPayload>(command: OutboundCommand<TPayload>): Promise<void>;
}

export const systemClock: Clock = { now: () => new Date() };
