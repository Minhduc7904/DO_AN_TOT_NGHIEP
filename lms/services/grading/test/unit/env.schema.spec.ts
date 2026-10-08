import { validateEnvironment } from '../../src/config/env.schema.js';

describe('Grading RabbitMQ configuration', () => {
  it('provides the documented defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      GRADING_EVENT_RETRY_BATCH_SIZE: 20,
      GRADING_EVENT_RETRY_INTERVAL_MS: 5_000,
      GRADING_GRADE_COMPLETED_EXCHANGE: 'lms.events',
      GRADING_PUBLISH_CONFIRM_TIMEOUT_MS: 3_000,
      GRADING_RABBITMQ_URL: 'amqp://localhost:5672',
    });
  });

  it.each(['amqp://lms:pw@rabbitmq:5672', 'amqps://rabbitmq.example.test'])('accepts %s', (url) => {
    expect(validateEnvironment({ GRADING_RABBITMQ_URL: url }).GRADING_RABBITMQ_URL).toBe(url);
  });

  it.each([
    ['GRADING_RABBITMQ_URL', 'http://rabbitmq:5672'],
    ['GRADING_RABBITMQ_URL', 'rabbitmq:5672'],
    ['GRADING_PUBLISH_CONFIRM_TIMEOUT_MS', '499'],
    ['GRADING_PUBLISH_CONFIRM_TIMEOUT_MS', '30001'],
    ['GRADING_EVENT_RETRY_INTERVAL_MS', '999'],
    ['GRADING_EVENT_RETRY_INTERVAL_MS', '60001'],
    ['GRADING_EVENT_RETRY_BATCH_SIZE', '0'],
    ['GRADING_EVENT_RETRY_BATCH_SIZE', '101'],
    ['GRADING_GRADE_COMPLETED_EXCHANGE', '  '],
  ])('rejects %s=%s', (key, value) => {
    expect(() => validateEnvironment({ [key]: value })).toThrow('Invalid environment');
  });

  it.each([
    ['GRADING_PUBLISH_CONFIRM_TIMEOUT_MS', '500'],
    ['GRADING_PUBLISH_CONFIRM_TIMEOUT_MS', '30000'],
    ['GRADING_EVENT_RETRY_INTERVAL_MS', '1000'],
    ['GRADING_EVENT_RETRY_INTERVAL_MS', '60000'],
    ['GRADING_EVENT_RETRY_BATCH_SIZE', '1'],
    ['GRADING_EVENT_RETRY_BATCH_SIZE', '100'],
  ])('accepts the boundary %s=%s', (key, value) => {
    expect(() => validateEnvironment({ [key]: value })).not.toThrow();
  });
});
