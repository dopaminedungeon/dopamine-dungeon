import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { workspaces } from "../../../db/schema/workspaces.js";
import { workspaceMemberships } from "../../../db/schema/memberships.js";
import { getCurrentUser } from "../access.js";
import { AuthenticationError } from "../apiErrors.js";
import { setCorsHeaders } from "../cors.js";
import { db } from "../db.js";

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class WorkspaceCreationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "WorkspaceCreationError";
  }
}

function getCreateWorkspaceInput(req: VercelRequest) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new WorkspaceCreationError("Workspace name is required", 400);
  }

  const name = String((body as Record<string, unknown>).name || "").trim();
  const idempotencyKey = String(
    (body as Record<string, unknown>).idempotencyKey || ""
  ).trim();

  if (!name || name.length > 160) {
    throw new WorkspaceCreationError("Workspace name is required", 400);
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new WorkspaceCreationError("Workspace creation request is invalid", 400);
  }

  return { idempotencyKey, name };
}

function getWorkspaceSlug() {
  return `workspace-${randomUUID()}`;
}

function toWorkspaceResponse(workspace: typeof workspaces.$inferSelect) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const currentUser = await getCurrentUser(req);
    const { idempotencyKey, name } = getCreateWorkspaceInput(req);
    const workspace = await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(workspaces)
        .where(
          and(
            eq(workspaces.ownerUserId, currentUser.id),
            eq(workspaces.creationRequestKey, idempotencyKey)
          )
        )
        .limit(1);
      let existingWorkspace = existingRows[0];
      let created = false;

      if (!existingWorkspace) {
        const insertedRows = await tx
          .insert(workspaces)
          .values({
            name,
            slug: getWorkspaceSlug(),
            ownerUserId: currentUser.id,
            creationRequestKey: idempotencyKey,
          })
          .onConflictDoNothing({
            target: [workspaces.ownerUserId, workspaces.creationRequestKey],
          })
          .returning();

        existingWorkspace = insertedRows[0];
        created = Boolean(existingWorkspace);

        if (!existingWorkspace) {
          const concurrentRows = await tx
            .select()
            .from(workspaces)
            .where(
              and(
                eq(workspaces.ownerUserId, currentUser.id),
                eq(workspaces.creationRequestKey, idempotencyKey)
              )
            )
            .limit(1);
          existingWorkspace = concurrentRows[0];
        }
      }

      if (!existingWorkspace || existingWorkspace.ownerUserId !== currentUser.id) {
        throw new WorkspaceCreationError(
          "Workspace creation request cannot be completed",
          409
        );
      }

      const membershipRows = await tx
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, existingWorkspace.id),
            eq(workspaceMemberships.userId, currentUser.id)
          )
        )
        .limit(1);
      const ownerMembership = membershipRows[0];

      if (ownerMembership?.role === "owner") {
        return existingWorkspace;
      }

      if (!created) {
        throw new WorkspaceCreationError(
          "Workspace creation request cannot be completed",
          409
        );
      }

      const insertedMembershipRows = await tx
        .insert(workspaceMemberships)
        .values({
          workspaceId: existingWorkspace.id,
          userId: currentUser.id,
          role: "owner",
        })
        .returning();

      if (!insertedMembershipRows[0]) {
        throw new WorkspaceCreationError("Workspace creation failed", 500);
      }

      return existingWorkspace;
    });

    return res.status(201).json({
      ok: true,
      workspace: toWorkspaceResponse(workspace),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    if (error instanceof WorkspaceCreationError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({
      ok: false,
      error: "Workspace creation failed",
    });
  }
}
