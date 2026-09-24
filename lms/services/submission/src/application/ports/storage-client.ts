export abstract class StorageClient {
  abstract store(objectKey: string, content: string): Promise<void>;
}
