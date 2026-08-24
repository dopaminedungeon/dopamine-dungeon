import { and, eq } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";

type VisibilityScopedTable = {
  campaignId: AnyColumn;
  visibility: AnyColumn;
};

type IdentifiedVisibilityScopedTable = VisibilityScopedTable & {
  id: AnyColumn;
};

export function itemReadWhere(table: IdentifiedVisibilityScopedTable, params: {
  campaignId: string;
  itemId?: string;
  isGm: boolean;
}) {
  const visibilityFilter = params.isGm
    ? eq(table.campaignId, params.campaignId)
    : and(eq(table.campaignId, params.campaignId), eq(table.visibility, "public"));

  return params.itemId
    ? and(visibilityFilter, eq(table.id, params.itemId))
    : visibilityFilter;
}

export function loreReadWhere(table: IdentifiedVisibilityScopedTable, params: {
  campaignId: string;
  loreId?: string;
  isGm: boolean;
}) {
  const visibilityFilter = params.isGm
    ? eq(table.campaignId, params.campaignId)
    : and(eq(table.campaignId, params.campaignId), eq(table.visibility, "public"));

  return params.loreId
    ? and(visibilityFilter, eq(table.id, params.loreId))
    : visibilityFilter;
}

export function locationReadWhere(table: IdentifiedVisibilityScopedTable, params: {
  campaignId: string;
  locationId?: string;
  isGm: boolean;
}) {
  const visibilityFilter = params.isGm
    ? eq(table.campaignId, params.campaignId)
    : and(
        eq(table.campaignId, params.campaignId),
        eq(table.visibility, "public")
      );

  return params.locationId
    ? and(visibilityFilter, eq(table.id, params.locationId))
    : visibilityFilter;
}

export function npcReadWhere(table: IdentifiedVisibilityScopedTable, params: {
  campaignId: string;
  npcId?: string;
  isGm: boolean;
}) {
  const visibilityFilter = params.isGm
    ? eq(table.campaignId, params.campaignId)
    : and(eq(table.campaignId, params.campaignId), eq(table.visibility, "public"));

  return params.npcId
    ? and(visibilityFilter, eq(table.id, params.npcId))
    : visibilityFilter;
}

export function entityLinksReadWhere(table: VisibilityScopedTable, params: {
  campaignId: string;
  isGm: boolean;
}) {
  return params.isGm
    ? eq(table.campaignId, params.campaignId)
    : and(
        eq(table.campaignId, params.campaignId),
        eq(table.visibility, "Player")
      );
}

export function stripGmOnlyItemFields(data: Record<string, unknown>) {
  const { gmNotes, hiddenEffects, curse, upgradePath, storyHooks, ...safeData } =
    data;
  void gmNotes;
  void hiddenEffects;
  void curse;
  void upgradePath;
  void storyHooks;
  return safeData;
}

export function stripGmOnlyNpcFields(data: Record<string, unknown>) {
  const { gmNotes, ...safeData } = data;
  void gmNotes;
  return safeData;
}

export function stripNestedGmNotes(data: Record<string, unknown>): Record<string, unknown> {
  const { gmNotes, data: nestedData, ...safeData } = data;
  void gmNotes;

  const safeNestedData: unknown =
    nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
      ? stripNestedGmNotes(nestedData as Record<string, unknown>)
      : nestedData;

  return {
    ...safeData,
    ...(safeNestedData ? { data: safeNestedData } : {}),
  };
}
