export class CheckoutError extends Error {
  constructor(
    public readonly status: 400 | 409 | 429,
    public readonly code: string,
    message: string,
  ) { super(message) }
}
