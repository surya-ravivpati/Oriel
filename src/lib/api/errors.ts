/** Framework-free error type used by domain services (safe to import anywhere on the server). */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
