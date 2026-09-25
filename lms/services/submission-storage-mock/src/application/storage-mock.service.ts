import { setTimeout as delay } from 'node:timers/promises';

import type { StoredObject, StorageFaultControl } from '../domain/stored-object.js';
import { StorageInjectedError } from './storage-injected-error.js';

export class StorageMockService {
  private readonly objects = new Map<string, StoredObject>();
  private fault: StorageFaultControl;

  constructor(private readonly defaults: StorageFaultControl) {
    this.fault = { ...defaults };
  }

  configure(control: StorageFaultControl): StorageFaultControl {
    this.fault = { ...control };
    return this.getControl();
  }

  reset(): StorageFaultControl {
    this.fault = { ...this.defaults };
    return this.getControl();
  }

  getControl(): StorageFaultControl {
    return { ...this.fault };
  }

  async store(objectKey: string, content: string, signal?: AbortSignal): Promise<StoredObject> {
    await this.applyFault(signal);
    signal?.throwIfAborted();
    const object: StoredObject = {
      content,
      object_key: objectKey,
      stored_at: new Date().toISOString(),
    };
    this.objects.set(objectKey, object);
    return object;
  }

  async get(objectKey: string): Promise<StoredObject | null> {
    await this.applyFault();
    return this.objects.get(objectKey) ?? null;
  }

  private async applyFault(signal?: AbortSignal): Promise<void> {
    if (this.fault.latency_ms > 0) {
      await delay(this.fault.latency_ms, undefined, { signal });
    }
    if (this.fault.error_mode === 'unavailable') throw new StorageInjectedError();
  }
}
