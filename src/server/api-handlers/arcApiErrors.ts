import type { VercelResponse } from "@vercel/node";
import { AuthenticationError } from "../apiErrors.js";

export class ArcApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function sendArcApiError(res: VercelResponse, error: unknown) {
  if (error instanceof AuthenticationError) {
    return res.status(401).json({ ok: false, error: error.message });
  }
  if (error instanceof ArcApiError) {
    return res.status(error.status).json({ ok: false, error: error.message });
  }

  // Database and unexpected failures are server errors, never authentication failures.
  return res.status(500).json({ ok: false, error: "Internal server error" });
}
