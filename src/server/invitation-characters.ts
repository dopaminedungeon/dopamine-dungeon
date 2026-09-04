import { eq, inArray } from "drizzle-orm";

import { invitationCharacterAssignments } from "../../db/schema/invitations.js";

export function parseLegacyInvitationCharacterIds(value?: string | null) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );
}

type InvitationCharacterSource = {
  id: string;
  characterId?: string | null;
};

type DrizzleExecutor = {
  // Database and transaction executors have intentionally different Drizzle
  // generic parameters; this helper needs only the select chain shared by both.
  select: (...args: never[]) => any;
};

/**
 * Relational rows are canonical for newly-created invitations. CSV values are
 * read only for pre-migration invitations until historical reconciliation.
 */
export async function getInvitationCharacterIdsByInvitationId(
  db: DrizzleExecutor,
  invitations: InvitationCharacterSource[]
) {
  if (!invitations.length) return new Map<string, string[]>();

  const rows = (await db
    .select()
    .from(invitationCharacterAssignments)
    .where(
      inArray(
        invitationCharacterAssignments.invitationId,
        invitations.map((row) => row.id)
      )
    )) as Array<{ invitationId: string; characterId: string }>;
  const relationalIds = new Map<string, string[]>();
  rows.forEach((row) => {
    const existing = relationalIds.get(row.invitationId) ?? [];
    existing.push(row.characterId);
    relationalIds.set(row.invitationId, existing);
  });

  return new Map(
    invitations.map((invitation) => [
      invitation.id,
      relationalIds.get(invitation.id) ?? parseLegacyInvitationCharacterIds(invitation.characterId),
    ])
  );
}

export async function getInvitationCharacterIds(
  db: DrizzleExecutor,
  invitation: InvitationCharacterSource
) {
  return (await getInvitationCharacterIdsByInvitationId(db, [invitation])).get(invitation.id) ?? [];
}
