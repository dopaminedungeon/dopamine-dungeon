import type { VercelRequest, VercelResponse } from "@vercel/node";

import campaignPeopleHandler from "../src/server/api-handlers/campaign-people.js";
import campaignRoutePeopleHandler from "../src/server/api-handlers/campaign-route-people.js";
import characterAssignmentsHandler from "../src/server/api-handlers/character-assignments.js";
import { setCorsHeaders } from "../src/server/cors.js";

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getResource(req: VercelRequest) {
  const queryResource = getQueryValue(req.query.resource) || getQueryValue(req.query.type);
  if (queryResource) return queryResource;

  if (req.body && typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    return typeof body.resource === "string"
      ? body.resource
      : typeof body.type === "string"
        ? body.type
        : "";
  }

  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = getResource(req);

  if (resource === "campaignPeople") {
    return campaignPeopleHandler(req, res);
  }

  if (resource === "campaignRoutePeople") {
    return campaignRoutePeopleHandler(req, res);
  }

  if (resource === "characterAssignments") {
    return characterAssignmentsHandler(req, res);
  }

  setCorsHeaders(res, "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(404).json({ ok: false, error: "Campaign content resource not found" });
}
