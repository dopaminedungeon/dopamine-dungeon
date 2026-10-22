import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";

import {
  getCurrentUser,
  requireCampaignMember,
  resolveCampaignBySlug,
} from "../access.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { bagCurrency, bagEntries, bagTransactions } from "../../../db/schema/bag.js";
import { items } from "../../../db/schema/items.js";
import { users } from "../../../db/schema/users.js";
import { canViewAsGm } from "../viewer-mode.js";
import { parseWorthGp, worthGpFromCopper } from "../../domain/currency/worth.js";
import { currencyToCopper } from "../../domain/currency/coins.js";

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

function sameCurrency(a: Required<BagCurrency>, b: Required<BagCurrency>) {
  return a.gp === b.gp && a.sp === b.sp && a.cp === b.cp && a.ep === b.ep && a.pp === b.pp;
}

function requestUuid(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value : null;
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
    if (req.method === "GET" && getQueryValue(req.query.action) === "report") {
      const rawOffset = getQueryValue(req.query.offset) || "0";
      if (!/^\d{1,5}$/.test(rawOffset)) throw new BagRequestError("Invalid report offset", 400);
      const offset = Number(rawOffset);
      const rows = await db.select({
        id: bagTransactions.id,
        type: bagTransactions.type,
        amountCp: bagTransactions.amountCp,
        balanceAfterCp: bagTransactions.balanceAfterCp,
        createdAt: bagTransactions.createdAt,
        actorUserId: bagTransactions.actorUserId,
        actorName: users.displayName,
      }).from(bagTransactions).leftJoin(users, eq(users.id, bagTransactions.actorUserId))
        .where(eq(bagTransactions.campaignId, campaign.id))
        .orderBy(desc(bagTransactions.createdAt), desc(bagTransactions.id))
        .limit(51).offset(offset);
      return res.status(200).json({
        ok: true,
        transactions: rows.slice(0, 50).map((row) => ({
          id: row.id,
          type: row.type,
          amountCp: row.amountCp,
          balanceAfterCp: row.balanceAfterCp,
          createdAt: row.createdAt,
          actor: row.actorUserId === currentUser.id ? "You"
            : isGm ? (row.actorName?.trim() || "Campaign member") : "Campaign member",
        })),
        hasMore: rows.length > 50,
      });
    }
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
      const proceedsGp = Math.floor(saleCp / 100);
      const proceedsSp = Math.floor((saleCp % 100) / 10);
      const proceedsCp = saleCp % 10;

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
          gp: proceedsGp,
          sp: proceedsSp,
          cp: proceedsCp,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: bagCurrency.campaignId,
          set: {
            gp: sql`${bagCurrency.gp} + ${proceedsGp}`,
            sp: sql`${bagCurrency.sp} + ${proceedsSp}`,
            cp: sql`${bagCurrency.cp} + ${proceedsCp}`,
            updatedAt: new Date(),
          },
        }).returning();
        await tx.insert(bagTransactions).values({
          campaignId: campaign.id,
          requestId: crypto.randomUUID(),
          actorUserId: currentUser.id,
          type: "sale",
          amountCp: saleCp,
          balanceAfterCp: currencyToCopper(currencyRow),
        });
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
    const operation = req.body?.currencyOperation;
    const operationId = requestUuid(operation?.id ?? req.body?.requestId);
    if (operation != null && (!operationId || !["add", "spend"].includes(operation.type))) {
      throw new BagRequestError("Invalid currency operation", 400);
    }
    if (req.body?.requestId != null && !requestUuid(req.body.requestId)) {
      throw new BagRequestError("Invalid request ID", 400);
    }
    if (operation && req.body?.requestId && req.body.requestId !== operationId) {
      throw new BagRequestError("Currency operation ID does not match request ID", 400);
    }
    const now = new Date();
    let entryValues = [
      ...bag.looseItems.map((item) => toLooseEntryValues(campaign.id, item)),
      ...bag.linkedEntries.map((entry) => toLinkedEntryValues(campaign.id, entry)),
    ];

    const committedBag = await db.transaction(async (tx) => {
      await tx.insert(bagCurrency).values({ campaignId: campaign.id }).onConflictDoNothing();
      const [previousCurrencyRow] = await tx.select().from(bagCurrency)
        .where(eq(bagCurrency.campaignId, campaign.id)).limit(1).for("update");
      if (operationId) {
        const [existing] = await tx.select({ id: bagTransactions.id }).from(bagTransactions).where(
          and(eq(bagTransactions.campaignId, campaign.id), eq(bagTransactions.requestId, operationId))
        ).limit(1);
        if (existing) {
          const [currentCurrency] = await tx.select().from(bagCurrency).where(eq(bagCurrency.campaignId, campaign.id)).limit(1);
          const currentEntries = await tx.select().from(bagEntries).where(eq(bagEntries.campaignId, campaign.id));
          return toBagPayload(currentCurrency, currentEntries);
        }
      }
      const previousCurrency = normalizeCurrency(previousCurrencyRow);
      const currencyChanged = !sameCurrency(previousCurrency, currency);
      const amountDifferenceCp = currencyToCopper(currency) - currencyToCopper(previousCurrency);
      if (operation && (!currencyChanged ||
        (operation.type === "add" && amountDifferenceCp <= 0) ||
        (operation.type === "spend" && amountDifferenceCp >= 0))) {
        throw new BagRequestError("Currency operation does not match the saved balance", 400);
      }
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
      const [savedCurrencyRow] = await tx
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
        }).returning();

      if (currencyChanged) {
        await tx.insert(bagTransactions).values({
          campaignId: campaign.id,
          requestId: operationId || crypto.randomUUID(),
          actorUserId: currentUser.id,
          type: operation?.type || "adjustment",
          amountCp: operation ? Math.abs(amountDifferenceCp) : amountDifferenceCp,
          balanceAfterCp: currencyToCopper(savedCurrencyRow),
        });
      }

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
      const savedEntries = await tx.select().from(bagEntries).where(eq(bagEntries.campaignId, campaign.id));
      return toBagPayload(savedCurrencyRow, savedEntries);
    });

    return res.status(200).json({ ok: true, bag: projectBagForViewer(committedBag, isGm, visibleItemIds) });
  } catch (error) {
    return res.status(error instanceof BagRequestError ? error.status : 401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}
