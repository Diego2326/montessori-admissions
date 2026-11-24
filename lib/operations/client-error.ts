export class OperationHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OperationHttpError";
    this.status = status;
  }
}

export function isMissingOperation(error: unknown): boolean {
  return error instanceof OperationHttpError && error.status === 404;
}
