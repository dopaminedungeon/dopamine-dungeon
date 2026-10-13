export const COIN_VALUES_CP = {
  pp: 1000,
  gp: 100,
  ep: 50,
  sp: 10,
  cp: 1,
} as const;

export type CoinKey = keyof typeof COIN_VALUES_CP;
export type CoinBalance = Partial<Record<CoinKey, number>>;

export function currencyToCopper(currency: CoinBalance): number {
  let total = 0;
  for (const key of Object.keys(COIN_VALUES_CP) as CoinKey[]) {
    const count = currency[key] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Currency amounts must be non-negative whole coins.");
    }
    total += count * COIN_VALUES_CP[key];
  }
  if (!Number.isSafeInteger(total)) throw new Error("Currency amount is too large.");
  return total;
}
