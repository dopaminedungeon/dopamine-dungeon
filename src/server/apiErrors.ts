export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function getApiErrorStatus(error: unknown) {
  return error instanceof AuthenticationError ? 401 : 500;
}

export function getApiErrorMessage(error: unknown) {
  return error instanceof AuthenticationError
    ? error.message
    : "Internal server error";
}
