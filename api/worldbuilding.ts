import type { VercelRequest, VercelResponse } from "@vercel/node";

import bagHandler from "../src/server/api-handlers/bag.js";
import charactersHandler from "../src/server/api-handlers/characters.js";
import entityLinksHandler from "../src/server/api-handlers/entity-links.js";
import itemsHandler from "../src/server/api-handlers/items.js";
import npcsHandler from "../src/server/api-handlers/npcs.js";
import sessionsHandler from "../src/server/api-handlers/sessions.js";
import { setCorsHeaders } from "../src/server/cors.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getResource(req: VercelRequest) {
  const queryResource =
    getQueryValue(req.query.resource) ||
    getQueryValue(req.query.type) ||
    getQueryValue(req.query.entity);
  if (queryResource) return queryResource;

  if (req.body && typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    return typeof body.resource === "string"
      ? body.resource
      : typeof body.type === "string"
        ? body.type
        : typeof body.entity === "string"
          ? body.entity
          : "";
  }

  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = getResource(req);

  if (resource === "bag") {
    return bagHandler(req, res);
  }

  if (resource === "characters") {
    return charactersHandler(req, res);
  }

  if (resource === "entityLinks") {
    return entityLinksHandler(req, res);
  }

  if (resource === "items") {
    return itemsHandler(req, res);
  }

  if (resource === "npcs") {
    return npcsHandler(req, res);
  }

  if (resource === "sessions") {
    return sessionsHandler(req, res);
  }

  setCorsHeaders(res, "GET, PUT, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(404).json({ ok: false, error: "Worldbuilding resource not found" });
}
