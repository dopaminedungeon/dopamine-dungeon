// Bag and item worth are entered in gp, with cp as the smallest supported unit.
export function parseWorthGp(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Worth must be a non-negative amount in gp, with at most two decimal places.");
  }
  const [whole, fraction = ""] = text.split(".");
  const copper = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(copper) || copper > 2_147_483_647) {
    throw new Error("Worth exceeds the supported currency range.");
  }
  return copper;
}

export function worthGpFromCopper(copper: number): number {
  return copper / 100;
}

export function formatCopperGp(copper: number): string {
  return `${Math.floor(copper / 100)}.${String(copper % 100).padStart(2, "0")}`;
}
