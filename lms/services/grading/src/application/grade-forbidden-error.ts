export class GradeForbiddenError extends Error {
  constructor() {
    super('Không được phép truy cập grade này');
  }
}
