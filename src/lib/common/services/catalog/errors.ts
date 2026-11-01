export class CountryNotFoundError extends Error {
  constructor(code: string) {
    super(`Country not found: ${code}`);
    this.name = 'CountryNotFoundError';
  }
}
