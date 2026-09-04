export const SELECTED_MODE_HEADER = "X-DD-Mode";

type StorageReader = Pick<Storage, "getItem">;

function normalizeMode(value: unknown): "gm" | "player" | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "gm" || normalized === "player") return normalized;
  return null;
}

export function getStoredSelectedMode(
  storage?: StorageReader | null
): "gm" | "player" {
  const selectedStorage =
    storage ?? (typeof window !== "undefined" ? window.localStorage : null);

  if (!selectedStorage) return "player";

  try {
    const tenantId = selectedStorage.getItem("dd_selectedTenantId");
    const campaignId = selectedStorage.getItem("dd_selectedCampaignId");
    const scopedMode =
      tenantId && campaignId
        ? selectedStorage.getItem(`dd:mode:${tenantId}:${campaignId}`)
        : null;

    return (
      normalizeMode(scopedMode) ??
      normalizeMode(selectedStorage.getItem("dd-mode")) ??
      "player"
    );
  } catch {
    return "player";
  }
}
