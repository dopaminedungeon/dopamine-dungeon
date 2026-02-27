import { readJson, writeJson } from "../storage/storage";
import { storageKeys } from "../storage/storageKeys";

export type Currency = {
  gp: number;
  sp: number;
  cp: number;
  ep: number;
  pp: number;
};

export type LooseBagItem = {
  id: string;
  name: string;
  type?: "Weapon" | "Armor" | "Consumable" | "Other";
  qty?: number;
  worth?: number; // gp value per entry (simple)
  note?: string;
  addedBy?: string;
  createdAt?: number;
};

export type BagState = {
  currency: Currency;
  looseItems: LooseBagItem[];
};

const EMPTY: BagState = {
  currency: { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 },
  looseItems: [],
};

const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

const normalizeCurrency = (c: Partial<Currency> | undefined): Currency => ({
  gp: clamp0(Number(c?.gp ?? 0)),
  sp: clamp0(Number(c?.sp ?? 0)),
  cp: clamp0(Number(c?.cp ?? 0)),
  ep: clamp0(Number(c?.ep ?? 0)),
  pp: clamp0(Number(c?.pp ?? 0)),
});

const normalizeState = (s: Partial<BagState> | undefined): BagState => {
  const currency = normalizeCurrency(s?.currency);
  const looseItems = Array.isArray(s?.looseItems) ? (s!.looseItems as LooseBagItem[]) : [];
  return { currency, looseItems };
};

export const bagRepo = {
  get(): BagState {
    // Backward compatible: older versions may only have looseItems
    const raw = readJson(storageKeys.bag, EMPTY) as any;
    return normalizeState(raw);
  },

  save(next: BagState) {
    writeJson(storageKeys.bag, next);
  },

  setCurrency(nextCurrency: Partial<Currency>) {
    const state = bagRepo.get();
    const merged: BagState = {
      ...state,
      currency: normalizeCurrency({ ...state.currency, ...nextCurrency }),
    };
    bagRepo.save(merged);
    return merged;
  },

  applyCurrencyDelta(delta: Partial<Currency>, mode: "add" | "spend") {
    const state = bagRepo.get();
    const sign = mode === "spend" ? -1 : 1;

    const next: Currency = {
      gp: clamp0(state.currency.gp + sign * (Number(delta.gp) || 0)),
      sp: clamp0(state.currency.sp + sign * (Number(delta.sp) || 0)),
      cp: clamp0(state.currency.cp + sign * (Number(delta.cp) || 0)),
      ep: clamp0(state.currency.ep + sign * (Number(delta.ep) || 0)),
      pp: clamp0(state.currency.pp + sign * (Number(delta.pp) || 0)),
    };

    const merged: BagState = { ...state, currency: next };
    bagRepo.save(merged);
    return merged;
  },

  addLooseItem(item: LooseBagItem) {
    const state = bagRepo.get();
    const next: BagState = { ...state, looseItems: [item, ...(state.looseItems || [])] };
    bagRepo.save(next);
    return next;
  },

  removeLooseItem(id: string) {
    const state = bagRepo.get();
    const next: BagState = {
      ...state,
      looseItems: (state.looseItems || []).filter((x) => String(x.id) !== String(id)),
    };
    bagRepo.save(next);
    return next;
  },
};