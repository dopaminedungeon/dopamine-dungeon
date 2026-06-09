import type { VercelResponse } from "@vercel/node";

export function setCorsHeaders(
  res: VercelResponse,
  methods = "GET, OPTIONS"
) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}
