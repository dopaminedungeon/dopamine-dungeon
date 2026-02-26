// src/domain/links/link.service.ts

import { Link, LinkEndpoint } from "./link.types";
import {
  assertAllowedEntityPair,
  assertAllowedLabelForPair,
} from "./link.rules";

/**
 * Normalizes entity order so that (A,B) and (B,A) are identical.
 * Sorting is deterministic and stable.
 */
function normalizeEndpoints(
  a: LinkEndpoint,
  b: LinkEndpoint
): [LinkEndpoint, LinkEndpoint] {
  const keyA = `${a.type}:${a.id}`;
  const keyB = `${b.type}:${b.id}`;

  return keyA <= keyB ? [a, b] : [b, a];
}
export interface CreateLinkInput {
  entityA: LinkEndpoint;
  entityB: LinkEndpoint;
  label: string;
  visibility?: "GM" | "Player";
  createdInSession?: string;
  note?: string;
}
/**
 * Creates a validated, normalized Link object.
 * This is the ONLY supported way to construct links.
 */
export function createLink(input: CreateLinkInput): Link {
  const { entityA, entityB, label } = input;

  // 1. Basic sanity
  if (
    entityA.type === entityB.type &&
    entityA.id === entityB.id
  ) {
    throw new Error("An entity cannot be linked to itself");
  }

  // 2. Entity pair validation
  assertAllowedEntityPair(entityA.type, entityB.type);

  // 3. Label validation
  assertAllowedLabelForPair(entityA.type, entityB.type, label);

  // 4. Normalize endpoints (symmetry)
  const [normalizedA, normalizedB] = normalizeEndpoints(
    entityA,
    entityB
  );

  // 5. Construct link
  return {
    id: crypto.randomUUID(),

    entityA: normalizedA,
    entityB: normalizedB,

    label,
    visibility: input.visibility ?? "GM",

    createdInSession: input.createdInSession,
    note: input.note,

    createdAt: new Date().toISOString(),
  };
}