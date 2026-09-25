export class StorageInjectedError extends Error {
  constructor() {
    super('Storage Mock đang inject lỗi deterministic');
  }
}
