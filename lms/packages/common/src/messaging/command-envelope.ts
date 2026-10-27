import { randomUUID } from 'node:crypto';

import { z } from 'zod';

export const COMMAND_EXCHANGE = 'lms.commands';

export const commandEnvelopeSchema = z.object({
  message_id: z.uuid(),
  command_name: z.string().min(1),
  schema_version: z.number().int().min(1),
  occurred_at: z.iso.datetime(),
  producer: z.object({ service_name: z.string().min(1), service_version: z.string().min(1) }),
  correlation: z.object({
    traceparent: z.string().nullable(),
    tracestate: z.string().nullable(),
    correlation_id: z.string().nullable(),
  }),
  payload: z.unknown(),
});

export type CommandEnvelope<TPayload = unknown> = Omit<
  z.infer<typeof commandEnvelopeSchema>,
  'payload'
> & { payload: TPayload };

/** Queue của consumer: `<worker service.name>--<command-kebab>-v<schema_version>`. */
export function buildQueueName(
  workerServiceName: string,
  commandKebab: string,
  schemaVersion: number,
): string {
  return `${workerServiceName}--${commandKebab}-v${schemaVersion}`;
}

export interface BuildEnvelopeInput<TPayload> {
  commandName: string;
  schemaVersion: number;
  payload: TPayload;
  producer: { serviceName: string; serviceVersion: string };
  correlationId?: string | undefined;
  traceparent?: string | undefined;
  tracestate?: string | undefined;
  messageId?: string | undefined;
  occurredAt?: Date | undefined;
}

export function buildCommandEnvelope<TPayload>(
  input: BuildEnvelopeInput<TPayload>,
): CommandEnvelope<TPayload> {
  return {
    message_id: input.messageId ?? randomUUID(),
    command_name: input.commandName,
    schema_version: input.schemaVersion,
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    producer: {
      service_name: input.producer.serviceName,
      service_version: input.producer.serviceVersion,
    },
    correlation: {
      traceparent: input.traceparent ?? null,
      tracestate: input.tracestate ?? null,
      correlation_id: input.correlationId ?? null,
    },
    payload: input.payload,
  };
}
