import type { VercelRequest } from "@vercel/node";

export type SelectedMode = "gm" | "player";

export function getSelectedMode(req: VercelRequest): SelectedMode {
  const rawMode = req.headers["x-dd-mode"];
  const selectedMode = Array.isArray(rawMode) ? rawMode[0] : rawMode;

  return String(selectedMode ?? "").trim().toLowerCase() === "gm"
    ? "gm"
    : "player";
}

export function canViewAsGm(
  req: VercelRequest,
  campaignRole: unknown
): boolean {
  return campaignRole === "gm" && getSelectedMode(req) === "gm";
}
