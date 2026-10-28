import type { ServiceClient } from '../../domain/service-client.js';

export interface ServiceClientRepository {
  findById(clientId: string): Promise<ServiceClient | null>;
  /** Tạo mới hoặc ghi đè toàn bộ client (dùng khi bootstrap). */
  upsert(client: ServiceClient): Promise<void>;
}

export const SERVICE_CLIENT_REPOSITORY = Symbol('ServiceClientRepository');
