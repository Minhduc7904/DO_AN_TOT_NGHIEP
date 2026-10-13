import { connect, type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';

export const RABBITMQ_CONNECT = Symbol('RABBITMQ_CONNECT');

export type RabbitMqChannel = Pick<
  Channel,
  | 'ack'
  | 'assertExchange'
  | 'assertQueue'
  | 'bindQueue'
  | 'cancel'
  | 'close'
  | 'consume'
  | 'nack'
  | 'on'
  | 'prefetch'
>;
export type RabbitMqConnection = Pick<ChannelModel, 'close' | 'createChannel' | 'on'>;
export type RabbitMqConnect = (url: string) => Promise<RabbitMqConnection>;
export type RabbitMqConsumeMessage = ConsumeMessage;

export const connectRabbitMq: RabbitMqConnect = async (url) => connect(url);
