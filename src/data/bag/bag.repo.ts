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

export type BagEntry = {
  id: string;
  itemId: string;
  quantity: number;
  sourceType: "linked" | "manual";
  note?: string;
  addedBy?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type BagState = {
  currency: BagCurrency;
  looseItems: LooseBagItem[];
  linkedEntries: BagEntry[];
};

const EMPTY_BAG: BagState = {
  currency: { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 },
  looseItems: [],
  linkedEntries: [],
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
  return input
    .filter((item) => item && item.id && item.name)
    .map((item) => {
      const normalizedItem: LooseBagItem = {
        id: String(item.id),
        name: String(item.name),
        qty: Math.max(1, Number(item?.qty) || 1),
        worth: Math.max(0, Number(item?.worth) || 0),
        type: item?.type || "Other",
        createdAt: Number(item?.createdAt) || Date.now(),
      };

      if (item?.addedBy != null) normalizedItem.addedBy = String(item.addedBy);
      if (item?.notes != null) normalizedItem.notes = String(item.notes);

      return normalizedItem;
    });
}

function normalizeLinkedEntries(input?: BagEntry[]): BagEntry[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((entry) => entry && entry.itemId)
    .map((entry) => {
      const normalizedEntry: BagEntry = {
        id: String(entry.id || crypto.randomUUID()),
        itemId: String(entry.itemId),
        quantity: Math.max(1, Number(entry?.quantity) || 1),
        sourceType: entry?.sourceType === "manual" ? "manual" : "linked",
        createdAt: Number(entry?.createdAt) || Date.now(),
        updatedAt: Number(entry?.updatedAt) || Date.now(),
      };

      if (entry?.note != null) normalizedEntry.note = String(entry.note);
      if (entry?.addedBy != null) normalizedEntry.addedBy = String(entry.addedBy);

      return normalizedEntry;
    });
}

function normalizeBag(input?: Partial<BagState> | null): BagState {
  return {
    currency: normalizeCurrency(input?.currency),
    looseItems: normalizeLooseItems(input?.looseItems),
    linkedEntries: normalizeLinkedEntries(input?.linkedEntries),
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
    const normalizedBag = normalizeBag(bag);
    await setDoc(doc(db, "campaigns", campaignId, "meta", "bag"), normalizedBag);
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

  sellLooseItem(bag: BagState, itemId: string): BagState {
    const current = normalizeBag(bag);
    const itemToSell = current.looseItems.find(
      (item) => String(item.id) === String(itemId)
    );

    if (!itemToSell) {
      return current;
    }

    const saleValue =
      Math.max(0, Number(itemToSell.worth) || 0) *
      Math.max(1, Number(itemToSell.qty) || 1);

    return {
      ...current,
      looseItems: current.looseItems.filter(
        (item) => String(item.id) !== String(itemId)
      ),
      currency: {
        ...normalizeCurrency(current.currency),
        gp: Math.max(
          0,
          (Number(current.currency?.gp) || 0) + saleValue
        ),
      },
    };
  },

  addLinkedItem(
    bag: BagState,
    itemId: string,
    options?: Pick<BagEntry, "addedBy" | "note" | "sourceType">
  ): BagState {
    const current = normalizeBag(bag);
    const normalizedItemId = String(itemId);
    const now = Date.now();

    const existingEntry = current.linkedEntries.find(
      (entry) => String(entry.itemId) === normalizedItemId
    );

    if (existingEntry) {
      return {
        ...current,
        linkedEntries: current.linkedEntries.map((entry) =>
          String(entry.id) === String(existingEntry.id)
            ? {
                ...entry,
                quantity: Math.max(1, Number(entry.quantity) || 1) + 1,
                updatedAt: now,
              }
            : entry
        ),
      };
    }

    return {
      ...current,
      linkedEntries: [
        ...current.linkedEntries,
        {
          id: crypto.randomUUID(),
          itemId: normalizedItemId,
          quantity: 1,
          sourceType: options?.sourceType === "manual" ? "manual" : "linked",
          ...(options?.note != null ? { note: String(options.note) } : {}),
          ...(options?.addedBy != null ? { addedBy: String(options.addedBy) } : {}),
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  },

  updateLinkedItemQuantity(
    bag: BagState,
    entryId: string,
    quantity: number
  ): BagState {
    const current = normalizeBag(bag);
    const normalizedQuantity = Math.floor(Number(quantity) || 0);

    if (normalizedQuantity <= 0) {
      return {
        ...current,
        linkedEntries: current.linkedEntries.filter(
          (entry) => String(entry.id) !== String(entryId)
        ),
      };
    }

    return {
      ...current,
      linkedEntries: current.linkedEntries.map((entry) =>
        String(entry.id) === String(entryId)
          ? {
              ...entry,
              quantity: Math.max(1, normalizedQuantity),
              updatedAt: Date.now(),
            }
          : entry
      ),
    };
  },

  removeLinkedItem(bag: BagState, entryId: string): BagState {
    const current = normalizeBag(bag);
    return {
      ...current,
      linkedEntries: current.linkedEntries.filter(
        (entry) => String(entry.id) !== String(entryId)
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