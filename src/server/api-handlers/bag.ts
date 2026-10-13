import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, notInArray, sql } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { bagCurrency, bagEntries } from "../../../db/schema/bag.js";
import { items } from "../../../db/schema/items.js";
import { canViewAsGm } from "../viewer-mode.js";
import { parseWorthGp, worthGpFromCopper } from "../../domain/currency/worth.js";

type BagCurrency = Partial<Record<"gp" | "sp" | "cp" | "ep" | "pp", number>>;
type LooseBagItem = {
  id: string;
  name: string;
  qty?: number;
  worth?: number | null;
  type?: string;
  addedBy?: string;
  createdAt?: number;
  notes?: string;
};
type LinkedBagEntry = {
  id: string;
  itemId: string;
  quantity: number;
  sourceType: "linked" | "manual";
  worth?: number | null;
  note?: string;
  addedBy?: string;
  createdAt?: number;
  updatedAt?: number;
};
type BagState = {
  currency: BagCurrency;
  looseItems: LooseBagItem[];
  linkedEntries: LinkedBagEntry[];
};
type BagEntryInsert = typeof bagEntries.$inferInsert;

class BagRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function normalizedWorth(value: unknown): number | null {
  const copper = parseWorthGp(value);
  return copper == null ? null : worthGpFromCopper(copper);
}

const EMPTY_BAG: BagState = {
  currency: { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 },
  looseItems: [],
  linkedEntries: [],
};

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCurrency(input?: BagCurrency): Required<BagCurrency> {
  return {
    gp: Math.max(0, Math.floor(normalizeNumber(input?.gp, 0))),
    sp: Math.max(0, Math.floor(normalizeNumber(input?.sp, 0))),
    cp: Math.max(0, Math.floor(normalizeNumber(input?.cp, 0))),
    ep: Math.max(0, Math.floor(normalizeNumber(input?.ep, 0))),
    pp: Math.max(0, Math.floor(normalizeNumber(input?.pp, 0))),
  };
}

function toDateFromMs(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(Number(value));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function toMs(value: Date | null | undefined) {
  return value instanceof Date ? value.getTime() : Date.now();
}

function normalizeLooseItems(input: unknown): LooseBagItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .filter((item) => item.id && item.name)
    .map((item) => {
      const normalizedItem: LooseBagItem = {
        id: normalizeString(item.id),
        name: normalizeString(item.name),
        qty: Math.max(1, Math.floor(normalizeNumber(item.qty, 1))),
        worth: normalizedWorth(item.worth),
        type: normalizeString(item.type, "Other") || "Other",
        createdAt: normalizeNumber(item.createdAt, Date.now()),
      };

      if (item.addedBy != null) normalizedItem.addedBy = normalizeString(item.addedBy);
      if (item.notes != null) normalizedItem.notes = normalizeString(item.notes);

      return normalizedItem;
    });
}

function normalizeLinkedEntries(input: unknown): LinkedBagEntry[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => entry.itemId)
    .map((entry) => {
      const normalizedEntry: LinkedBagEntry = {
        id: normalizeString(entry.id, crypto.randomUUID()),
        itemId: normalizeString(entry.itemId),
        quantity: Math.max(1, Math.floor(normalizeNumber(entry.quantity, 1))),
        sourceType: entry.sourceType === "manual" ? "manual" : "linked",
        worth: normalizedWorth(entry.worth),
        createdAt: normalizeNumber(entry.createdAt, Date.now()),
        updatedAt: normalizeNumber(entry.updatedAt, Date.now()),
      };

      if (entry.note != null) normalizedEntry.note = normalizeString(entry.note);
      if (entry.addedBy != null) normalizedEntry.addedBy = normalizeString(entry.addedBy);

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

function toLooseEntryValues(
  campaignId: string,
  item: LooseBagItem
): BagEntryInsert {
  const createdAt = toDateFromMs(item.createdAt);
  return {
    campaignId,
    id: item.id,
    sourceType: "loose",
    itemId: null,
    name: item.name,
    category: item.type ?? "Other",
    quantity: Math.max(1, Math.floor(normalizeNumber(item.qty, 1))),
    worthGp: item.worth ?? null,
    notes: item.notes ?? null,
    addedBy: item.addedBy ?? null,
    createdAt,
    updatedAt: new Date(),
  };
}

function toLinkedEntryValues(
  campaignId: string,
  entry: LinkedBagEntry
): BagEntryInsert {
  return {
    campaignId,
    id: entry.id,
    // The DB source_type is normalized to loose|linked; legacy UI sourceType may still be "manual".
    sourceType: "linked",
    itemId: entry.itemId,
    name: "",
    category: null,
    quantity: Math.max(1, Math.floor(normalizeNumber(entry.quantity, 1))),
    worthGp: entry.worth ?? null,
    notes: entry.note ?? null,
    addedBy: entry.addedBy ?? null,
    createdAt: toDateFromMs(entry.createdAt),
    updatedAt: toDateFromMs(entry.updatedAt),
  };
}

function toBagPayload(
  currencyRow: typeof bagCurrency.$inferSelect | undefined,
  entryRows: (typeof bagEntries.$inferSelect)[]
): BagState {
  const currency = currencyRow
    ? {
        gp: currencyRow.gp,
        sp: currencyRow.sp,
        cp: currencyRow.cp,
        ep: currencyRow.ep,
        pp: currencyRow.pp,
      }
    : EMPTY_BAG.currency;

  const looseItems: LooseBagItem[] = [];
  const linkedEntries: LinkedBagEntry[] = [];

  for (const row of entryRows) {
    if (row.sourceType === "linked") {
      if (!row.itemId) continue;

      linkedEntries.push({
        id: row.id,
        itemId: row.itemId,
        quantity: row.quantity,
        sourceType: "linked",
        worth: row.worthGp,
        ...(row.notes != null ? { note: row.notes } : {}),
        ...(row.addedBy != null ? { addedBy: row.addedBy } : {}),
        createdAt: toMs(row.createdAt),
        updatedAt: toMs(row.updatedAt),
      });
      continue;
    }

    looseItems.push({
      id: row.id,
      name: row.name,
      qty: row.quantity,
      worth: row.worthGp,
      type: row.category ?? "Other",
      ...(row.addedBy != null ? { addedBy: row.addedBy } : {}),
      ...(row.notes != null ? { notes: row.notes } : {}),
      createdAt: toMs(row.createdAt),
    });
  }

  return { currency, looseItems, linkedEntries };
}

function projectBagForViewer(bag: BagState, isGm: boolean, visibleItemIds: Set<string>): BagState {
  if (isGm) return bag;
  return {
    ...bag,
    linkedEntries: bag.linkedEntries.filter((entry) => visibleItemIds.has(entry.itemId)),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "PUT", "POST"].includes(req.method || "")) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const campaignSlug = getQueryValue(req.query.campaignId) || "";
    // Normalize the app-safe campaign slug from the frontend to the Postgres campaign UUID.
    const campaign = await resolveCampaignBySlug(campaignSlug);

    const membership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    const isGm = canViewAsGm(req, membership.role);
    const visibleItemRows = isGm ? [] : await db.select({ id: items.id }).from(items).where(
      and(eq(items.campaignId, campaign.id), eq(items.visibility, "public"))
    );
    const visibleItemIds = new Set(visibleItemRows.map((row) => row.id));

    if (req.method === "GET") {
      const [currencyRows, entryRows] = await Promise.all([
        db
          .select()
          .from(bagCurrency)
          .where(eq(bagCurrency.campaignId, campaign.id))
          .limit(1),
        db
          .select()
          .from(bagEntries)
          .where(eq(bagEntries.campaignId, campaign.id)),
      ]);

      return res.status(200).json({
        ok: true,
        campaignId: campaign.slug,
        bag: projectBagForViewer(toBagPayload(currencyRows[0], entryRows), isGm, visibleItemIds),
      });
    }

    if (req.method === "POST") {
      if (getQueryValue(req.query.action) !== "sell") {
        throw new BagRequestError("Unknown bag action", 400);
      }
      const entryId = normalizeString(req.body?.entryId);
      if (!entryId) throw new BagRequestError("Bag entry is required", 400);
      let saleCp: number | null;
      try {
        saleCp = parseWorthGp(req.body?.saleValueGp);
      } catch (error) {
        throw new BagRequestError(error instanceof Error ? error.message : "Invalid sale value", 400);
      }
      if (saleCp == null) throw new BagRequestError("Enter a sale value in gp", 400);

      const bag = await db.transaction(async (tx) => {
        const removed = await tx.delete(bagEntries).where(
          and(eq(bagEntries.campaignId, campaign.id), eq(bagEntries.id, entryId))
        ).returning();
        const sold = removed[0];
        if (!sold) throw new BagRequestError("This bag entry was already sold or removed", 409);
        if (sold.sourceType === "linked" && (!sold.itemId || (!isGm && !visibleItemIds.has(sold.itemId)))) {
          throw new BagRequestError("This bag entry is not available in Player mode", 403);
        }

        const [currencyRow] = await tx.insert(bagCurrency).values({
          campaignId: campaign.id,
          cp: saleCp,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: bagCurrency.campaignId,
          set: { cp: sql`${bagCurrency.cp} + ${saleCp}`, updatedAt: new Date() },
        }).returning();
        const entryRows = await tx.select().from(bagEntries).where(eq(bagEntries.campaignId, campaign.id));
        return projectBagForViewer(toBagPayload(currencyRow, entryRows), isGm, visibleItemIds);
      });
      return res.status(200).json({ ok: true, bag });
    }

    const rawBag =
      req.body && typeof req.body === "object" ? (req.body.bag ?? req.body) : null;

    if (!rawBag || typeof rawBag !== "object") {
      return res.status(400).json({ ok: false, error: "Bag payload is required" });
    }

    const bag = normalizeBag(rawBag as Partial<BagState>);
    const currency = normalizeCurrency(bag.currency);
    const now = new Date();
    let entryValues = [
      ...bag.looseItems.map((item) => toLooseEntryValues(campaign.id, item)),
      ...bag.linkedEntries.map((entry) => toLinkedEntryValues(campaign.id, entry)),
    ];

    await db.transaction(async (tx) => {
      if (!isGm) {
        const existingRows = await tx.select().from(bagEntries).where(eq(bagEntries.campaignId, campaign.id));
        const hiddenRows = existingRows.filter((row) =>
          row.sourceType === "linked" && (!row.itemId || !visibleItemIds.has(row.itemId))
        );
        const hiddenIds = new Set(hiddenRows.map((row) => row.id));
        for (const value of entryValues) {
          if (value.sourceType === "linked" && value.itemId &&
              !visibleItemIds.has(value.itemId) && !hiddenIds.has(value.id)) {
            throw new BagRequestError("This item is not available in Player mode", 403);
          }
        }
        entryValues = entryValues.filter((value) => !hiddenIds.has(value.id));
        entryValues.push(...hiddenRows.map(({ rowId: _rowId, ...row }) => row));
      }
      const entryIds = entryValues.map((entry) => entry.id);
      await tx
        .insert(bagCurrency)
        .values({ campaignId: campaign.id, ...currency, updatedAt: now })
        .onConflictDoUpdate({
          target: bagCurrency.campaignId,
          set: {
            cp: currency.cp,
            sp: currency.sp,
            ep: currency.ep,
            gp: currency.gp,
            pp: currency.pp,
            updatedAt: now,
          },
        });

      for (const values of entryValues) {
        await tx.insert(bagEntries).values(values).onConflictDoUpdate({
          target: [bagEntries.campaignId, bagEntries.id],
          set: {
            sourceType: values.sourceType,
            itemId: values.itemId,
            name: values.name,
            category: values.category,
            quantity: values.quantity,
            worthGp: values.worthGp,
            notes: values.notes,
            addedBy: values.addedBy,
            updatedAt: values.updatedAt,
          },
        });
      }

      if (entryIds.length > 0) {
        await tx.delete(bagEntries).where(
          and(eq(bagEntries.campaignId, campaign.id), notInArray(bagEntries.id, entryIds))
        );
      } else {
        await tx.delete(bagEntries).where(eq(bagEntries.campaignId, campaign.id));
      }
    });

    return res.status(200).json({ ok: true, bag: projectBagForViewer(bag, isGm, visibleItemIds) });
  } catch (error) {
    return res.status(error instanceof BagRequestError ? error.status : 401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
