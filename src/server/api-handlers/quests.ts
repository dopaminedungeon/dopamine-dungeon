import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray, or } from "drizzle-orm";
import { getCurrentUser, requireCampaignMember, resolveCampaignBySlug } from "../access.js";
import { canViewAsGm } from "../viewer-mode.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";
import { quests } from "../../../db/schema/quests.js";
import { sessions } from "../../../db/schema/sessions.js";
import { npcs } from "../../../db/schema/npcs.js";
import { characters } from "../../../db/schema/characters.js";
import { items } from "../../../db/schema/items.js";
import { locations } from "../../../db/schema/locations.js";
import { entityLinks } from "../../../db/schema/entityLinks.js";
import { QUEST_SECTIONS, QUEST_STATUSES, questTypeIsValid } from "../../domain/quests/quest.types.js";
import type { QuestObjective, QuestRecord, QuestVisibility } from "../../domain/quests/quest.types.js";

class QuestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const queryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const visibility = (value: unknown): QuestVisibility => {
  if (value !== "public" && value !== "gm-only") throw new QuestError("Invalid visibility");
  return value;
};

function objectives(value: unknown): QuestObjective[] {
  if (!Array.isArray(value) || value.length > 100) throw new QuestError("Invalid objectives");
  const seen = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || !clean(entry.id) || seen.has(entry.id) ||
      !questTypeIsValid(entry.type)) {
      throw new QuestError("Invalid objective");
    }
    seen.add(entry.id);
    return { id: clean(entry.id), type: entry.type, description: clean(entry.description),
      visibility: visibility(entry.visibility) };
  });
}

function parseQuest(value: unknown): QuestRecord {
  if (!value || typeof value !== "object") throw new QuestError("Quest is required");
  const input = value as Record<string, unknown>;
  if (!clean(input.id) || !clean(input.name)) throw new QuestError("Quest name and ID are required");
  if (!questTypeIsValid(input.type)) throw new QuestError("Invalid quest type");
  if (!QUEST_STATUSES.includes(input.status as typeof QUEST_STATUSES[number])) throw new QuestError("Invalid quest status");
  if (!Number.isInteger(input.progress) || (input.progress as number) < 0 || (input.progress as number) > 100) {
    throw new QuestError("Progress must be between 0 and 100");
  }
  const sectionInput = input.sectionVisibility;
  if (!sectionInput || typeof sectionInput !== "object") throw new QuestError("Section visibility is required");
  const sections = sectionInput as Record<string, unknown>;
  const sectionVisibility = Object.fromEntries(QUEST_SECTIONS.map((section) => [section, visibility(sections[section])])) as QuestRecord["sectionVisibility"];
  if (!Array.isArray(input.receiverIds) || input.receiverIds.some((id) => !clean(id))) throw new QuestError("Invalid quest receivers");
  const endDate = clean(input.endDate);
  if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00Z`)) ||
    new Date(`${endDate}T00:00:00Z`).toISOString().slice(0, 10) !== endDate)) {
    throw new QuestError("Invalid end date");
  }
  const mainObjectives = objectives(input.mainObjectives);
  const secondaryObjectives = objectives(input.secondaryObjectives);
  const objectiveIds = [...mainObjectives, ...secondaryObjectives].map((entry) => entry.id);
  if (new Set(objectiveIds).size !== objectiveIds.length) throw new QuestError("Objective IDs must be unique");
  return {
    id: clean(input.id), name: clean(input.name), type: input.type, status: input.status as QuestRecord["status"],
    progress: input.progress as number, visibility: visibility(input.visibility),
    startSessionId: clean(input.startSessionId), endSessionId: clean(input.endSessionId), endDate,
    giverId: clean(input.giverId), receiverIds: [...new Set((input.receiverIds as string[]).map(clean))],
    shortDescription: clean(input.shortDescription), hook: clean(input.hook), journey: clean(input.journey),
    aftermath: clean(input.aftermath), sectionVisibility,
    mainObjectives, secondaryObjectives,
  };
}

function project(row: typeof quests.$inferSelect, isGm: boolean) {
  const endEligible = row.status === "Completed" || row.status === "Abandoned";
  if (isGm) return row;
  const visible = (section: string) => row.sectionVisibility?.[section as keyof typeof row.sectionVisibility] === "public";
  return {
    id: row.id, name: row.name, type: row.type, status: row.status, visibility: "public", progress: row.progress,
    startSessionId: row.startSessionId, endSessionId: endEligible ? row.endSessionId : "", endDate: endEligible ? row.endDate : "",
    giverId: row.giverId, receiverIds: row.receiverIds,
    shortDescription: visible("shortDescription") ? row.shortDescription : "",
    hook: visible("hook") ? row.hook : "", journey: visible("journey") ? row.journey : "",
    aftermath: visible("aftermath") ? row.aftermath : "",
    mainObjectives: visible("mainObjectives") ? row.mainObjectives.filter((item) => item.visibility === "public") : [],
    secondaryObjectives: visible("secondaryObjectives") ? row.secondaryObjectives.filter((item) => item.visibility === "public") : [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "PUT") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const user = await getCurrentUser(req);
    const campaign = await resolveCampaignBySlug(queryValue(req.query.campaignId) || "");
    const member = await requireCampaignMember({ campaignId: campaign.id, userId: user.id });
    const isGm = canViewAsGm(req, member.role);
    if (req.method === "GET") {
      const id = clean(queryValue(req.query.questId));
      const rows = await db.select().from(quests).where(and(eq(quests.campaignId, campaign.id), id ? eq(quests.id, id) : undefined,
        isGm ? undefined : eq(quests.visibility, "public")));
      // Reference labels are projected from the same campaign and visibility scope.
      const [sessionRows, npcRows, characterRows, itemRows, locationRows] = await Promise.all([
        db.select({ id: sessions.id, name: sessions.name, sessionNumber: sessions.sessionNumber }).from(sessions)
          .where(and(eq(sessions.campaignId, campaign.id), isGm ? undefined : eq(sessions.visibility, "public"))),
        db.select({ id: npcs.id, name: npcs.name }).from(npcs)
          .where(and(eq(npcs.campaignId, campaign.id), isGm ? undefined : eq(npcs.visibility, "public"))),
        db.select({ id: characters.id, name: characters.name }).from(characters)
          .where(and(eq(characters.campaignId, campaign.id), isGm ? undefined : eq(characters.isPlayerVisible, true))),
        db.select({ id: items.id, name: items.name }).from(items)
          .where(and(eq(items.campaignId, campaign.id), isGm ? undefined : eq(items.visibility, "public"))),
        db.select({ id: locations.id, name: locations.name }).from(locations)
          .where(and(eq(locations.campaignId, campaign.id), isGm ? undefined : eq(locations.visibility, "public"))),
      ]);
      const sessionIds = new Set(sessionRows.map((row) => row.id));
      const npcIds = new Set(npcRows.map((row) => row.id));
      const characterIds = new Set(characterRows.map((row) => row.id));
      const projected = rows.filter((row) => isGm || row.visibility === "public").map((row) => {
        const payload = project(row, isGm);
        return { ...payload,
          startSessionId: sessionIds.has(payload.startSessionId) ? payload.startSessionId : "",
          endSessionId: sessionIds.has(payload.endSessionId) ? payload.endSessionId : "",
          giverId: npcIds.has(payload.giverId) ? payload.giverId : "",
          receiverIds: payload.receiverIds.filter((receiverId) => characterIds.has(receiverId)),
        };
      });
      return res.status(200).json({ ok: true, ...(id ? { quest: projected[0] ?? null } : { quests: projected }),
        references: { sessions: sessionRows, npcs: npcRows, characters: characterRows, items: itemRows, locations: locationRows } });
    }
    if (!isGm) throw new QuestError("GM mode is required to edit quests", 403);
    const quest = parseQuest(req.body?.quest);
    const [sessionRows, npcRows, characterRows] = await Promise.all([
      db.select({ id: sessions.id }).from(sessions).where(eq(sessions.campaignId, campaign.id)),
      db.select({ id: npcs.id }).from(npcs).where(eq(npcs.campaignId, campaign.id)),
      db.select({ id: characters.id }).from(characters).where(eq(characters.campaignId, campaign.id)),
    ]);
    const has = (rows: { id: string }[], id: string) => !id || rows.some((row) => row.id === id);
    if (![quest.startSessionId, quest.endSessionId].every((id) => has(sessionRows, id)) ||
      !has(npcRows, quest.giverId) || quest.receiverIds.some((id) => !has(characterRows, id))) {
      throw new QuestError("A linked entity is unavailable in this campaign");
    }
    const [saved] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(quests).values({ ...quest, campaignId: campaign.id, updatedAt: new Date() })
        .onConflictDoUpdate({ target: [quests.campaignId, quests.id], set: { ...quest, updatedAt: new Date() } }).returning();
      const priorLinks = await tx.select({ id: entityLinks.id }).from(entityLinks).where(and(eq(entityLinks.campaignId, campaign.id),
        or(and(eq(entityLinks.entityAType, "Quest"), eq(entityLinks.entityAId, quest.id)),
          and(eq(entityLinks.entityBType, "Quest"), eq(entityLinks.entityBId, quest.id)))));
      const autoIds = priorLinks.map((link) => link.id).filter((linkId) => linkId.startsWith(`quest-hero:${quest.id}:`));
      if (autoIds.length) await tx.delete(entityLinks).where(and(eq(entityLinks.campaignId, campaign.id), inArray(entityLinks.id, autoIds)));
      const ends = quest.status === "Completed" || quest.status === "Abandoned";
      const targets = [
        ...(quest.startSessionId ? [{ type: "Session", id: quest.startSessionId, label: "started" }] : []),
        ...(ends && quest.endSessionId ? [{ type: "Session", id: quest.endSessionId, label: quest.status === "Completed" ? "completed" : "failed" }] : []),
        ...(quest.giverId ? [{ type: "NPC", id: quest.giverId, label: "given_by" }] : []),
        ...quest.receiverIds.map((id) => ({ type: "PC", id, label: "assigned_to" })),
      ];
      if (targets.length) await tx.insert(entityLinks).values(targets.map((target) => {
        const questFirst = `Quest:${quest.id}` <= `${target.type}:${target.id}`;
        return { campaignId: campaign.id, id: `quest-hero:${quest.id}:${target.type}:${target.id}:${target.label}`,
          entityAType: questFirst ? "Quest" : target.type, entityAId: questFirst ? quest.id : target.id,
          entityBType: questFirst ? target.type : "Quest", entityBId: questFirst ? target.id : quest.id,
          label: target.label, visibility: quest.visibility === "public" ? "Player" : "GM",
          createdByUserId: user.id };
      })).onConflictDoNothing();
      return [row];
    });
    return res.status(200).json({ ok: true, quest: project(saved, true) });
  } catch (error) {
    const status = error instanceof QuestError ? error.status : 401;
    return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : "Quest request failed" });
  }
}
