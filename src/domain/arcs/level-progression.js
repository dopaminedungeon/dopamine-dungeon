/** Convert simple directional level notation for display as plain text. */
export function formatLevelProgression(value) {
  return String(value ?? "").replaceAll("->", "→").replaceAll("<-", "←");
}
