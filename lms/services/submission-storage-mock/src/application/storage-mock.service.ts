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

  async store(objectKey: string, content: string): Promise<StoredObject> {
    await this.applyFault();
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

  private async applyFault(): Promise<void> {
    if (this.fault.latency_ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.fault.latency_ms));
    }
    if (this.fault.error_mode === 'unavailable') throw new StorageInjectedError();
  }
}
