import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

type CoinKey = "gp" | "sp" | "cp" | "ep" | "pp";

export type BagCurrency = Partial<Record<CoinKey, number>>;

export type LooseBagItem = {
  id: string;
  name: string;
  qty?: number;
  worth?: number;
  type?: string;
  addedBy?: string;
  createdAt?: number;
  notes?: string;
};

export type BagState = {
  currency: BagCurrency;
  looseItems: LooseBagItem[];
};

const EMPTY_BAG: BagState = {
  currency: { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 },
  looseItems: [],
};

function normalizeCurrency(input?: BagCurrency): BagCurrency {
  return {
    gp: Math.max(0, Number(input?.gp) || 0),
    sp: Math.max(0, Number(input?.sp) || 0),
    cp: Math.max(0, Number(input?.cp) || 0),
    ep: Math.max(0, Number(input?.ep) || 0),
    pp: Math.max(0, Number(input?.pp) || 0),
  };
}

function normalizeLooseItems(input?: LooseBagItem[]): LooseBagItem[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => ({
    ...item,
    qty: Math.max(1, Number(item?.qty) || 1),
    worth: Math.max(0, Number(item?.worth) || 0),
    type: item?.type || "Other",
  }));
}

function normalizeBag(input?: Partial<BagState> | null): BagState {
  return {
    currency: normalizeCurrency(input?.currency),
    looseItems: normalizeLooseItems(input?.looseItems),
  };
}

export const bagRepo = {
  async get(campaignId: string): Promise<BagState> {
    if (!campaignId) return { ...EMPTY_BAG };

    const snap = await getDoc(doc(db, "campaigns", campaignId, "meta", "bag"));
    if (!snap.exists()) return { ...EMPTY_BAG };

    return normalizeBag(snap.data() as Partial<BagState>);
  },

  async save(campaignId: string, bag: BagState): Promise<void> {
    if (!campaignId) return;
    await setDoc(doc(db, "campaigns", campaignId, "meta", "bag"), normalizeBag(bag));
  },

  addLooseItem(bag: BagState, newItem: LooseBagItem): BagState {
    const current = normalizeBag(bag);
    return {
      ...current,
      looseItems: [
        ...current.looseItems,
        {
          ...newItem,
          qty: Math.max(1, Number(newItem?.qty) || 1),
          worth: Math.max(0, Number(newItem?.worth) || 0),
          type: newItem?.type || "Other",
        },
      ],
    };
  },

  removeLooseItem(bag: BagState, itemId: string): BagState {
    const current = normalizeBag(bag);
    return {
      ...current,
      looseItems: current.looseItems.filter(
        (item) => String(item.id) !== String(itemId)
      ),
    };
  },

  applyCurrencyDelta(
    bag: BagState,
    delta: BagCurrency,
    mode: "add" | "spend" = "add"
  ): BagState {
    const current = normalizeBag(bag);
    const normalizedDelta = normalizeCurrency(delta);
    const sign = mode === "spend" ? -1 : 1;

    return {
      ...current,
      currency: {
        gp: Math.max(0, (current.currency.gp || 0) + sign * (normalizedDelta.gp || 0)),
        sp: Math.max(0, (current.currency.sp || 0) + sign * (normalizedDelta.sp || 0)),
        cp: Math.max(0, (current.currency.cp || 0) + sign * (normalizedDelta.cp || 0)),
        ep: Math.max(0, (current.currency.ep || 0) + sign * (normalizedDelta.ep || 0)),
        pp: Math.max(0, (current.currency.pp || 0) + sign * (normalizedDelta.pp || 0)),
      },
    };
  },
};