export interface StoredObject {
  content: string;
  object_key: string;
  stored_at: string;
}

export interface StorageFaultControl {
  error_mode: 'none' | 'unavailable';
  latency_ms: number;
}
