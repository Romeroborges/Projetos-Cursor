export type HttpErrorCode = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export class HttpError extends Error {
  public readonly status: HttpErrorCode;
  public readonly details?: unknown;

  constructor(status: HttpErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
