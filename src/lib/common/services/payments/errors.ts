export class ProviderEventNotFoundError extends Error {
  constructor(id: string) {
    super(`Provider event not found: ${id}`);
    this.name = 'ProviderEventNotFoundError';
  }
}
