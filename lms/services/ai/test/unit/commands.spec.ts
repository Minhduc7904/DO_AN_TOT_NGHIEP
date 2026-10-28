import { buildQueueName } from '@aiops-lms/common/messaging';
import {
  AI_COMMANDS,
  AI_WORKER,
  aiCommandFixtures,
  documentExtractPayloadSchema,
  jobRunPayloadSchema,
} from '@aiops-lms/contracts/commands';

const schemas = {
  documentExtract: documentExtractPayloadSchema,
  jobRun: jobRunPayloadSchema,
} as const;

describe('command của ai-worker (contract)', () => {
  it.each(Object.keys(schemas) as (keyof typeof schemas)[])(
    '%s: fixture hợp lệ và queue theo quy ước canonical',
    (key) => {
      expect(schemas[key].safeParse(aiCommandFixtures[key]).success).toBe(true);
      const command = AI_COMMANDS[key];
      const kebab = command.queue.replace(`${AI_WORKER}--`, '').replace(/-v\d+$/u, '');
      expect(command.queue).toBe(buildQueueName(AI_WORKER, kebab, command.version));
      expect(command.name).toMatch(/^ai\.[a-z]+\.[a-z]+$/u);
    },
  );

  it('queue không trùng nhau', () => {
    const queues = Object.values(AI_COMMANDS).map((command) => command.queue);
    expect(new Set(queues).size).toBe(queues.length);
  });

  it('payload thiếu trường hoặc sai kiểu bị từ chối', () => {
    expect(documentExtractPayloadSchema.safeParse({}).success).toBe(false);
    expect(
      documentExtractPayloadSchema.safeParse({
        ...aiCommandFixtures.documentExtract,
        media_id: 'x',
      }).success,
    ).toBe(false);
    expect(
      documentExtractPayloadSchema.safeParse({
        ...aiCommandFixtures.documentExtract,
        media_type: 'KHAC',
      }).success,
    ).toBe(false);
    expect(jobRunPayloadSchema.safeParse({ job_id: 'khong-phai-uuid' }).success).toBe(false);
  });
});
