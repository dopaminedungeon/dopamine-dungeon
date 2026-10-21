import { apiFetch } from "../api/apiClient";

export type ArcStatus = "active" | "progressing" | "resolved" | "waiting";
export type ArcVisibility = "public" | "gm-only";
export type Arc = {
  id: string;
  name: string;
  summary: string;
  status: ArcStatus;
  visibility: ArcVisibility;
  createdAt?: string;
  updatedAt?: string;
};
export type Milestone = {
  id: string;
  arcId: string;
  title: string;
  description: string;
  status: ArcStatus;
  visibility: ArcVisibility;
  position: number;
  createdAt?: string;
  updatedAt?: string;
};

function endpoint(resource: "arcs" | "milestones", campaignId: string, id?: string) {
  const params = new URLSearchParams({ resource, campaignId });
  if (id) params.set(resource === "arcs" ? "arcId" : "milestoneId", id);
  return `/api/worldbuilding?${params.toString()}`;
}

function normalizeArc(value: any): Arc {
  return {
    ...value,
    id: String(value?.id || ""),
    name: String(value?.name || ""),
    summary: String(value?.summary || ""),
    status: ["active", "progressing", "resolved", "waiting"].includes(value?.status) ? value.status : "active",
    visibility: value?.visibility === "public" ? "public" : "gm-only",
  };
}

function normalizeMilestone(value: any): Milestone {
  return {
    ...value,
    id: String(value?.id || ""),
    arcId: String(value?.arcId || ""),
    title: String(value?.title || ""),
    description: String(value?.description || ""),
    status: ["active", "progressing", "resolved", "waiting"].includes(value?.status) ? value.status : "active",
    visibility: value?.visibility === "public" ? "public" : "gm-only",
    position: Number.isFinite(Number(value?.position)) ? Number(value.position) : 0,
  };
}

export const arcsRepo = {
  async getAll(campaignId: string) {
    const response = await apiFetch<{ arcs: unknown[] }>(endpoint("arcs", campaignId));
    return (response.arcs || []).map(normalizeArc);
  },
  async getById(campaignId: string, id: string) {
    const response = await apiFetch<{ arcs: unknown[] }>(endpoint("arcs", campaignId, id));
    return response.arcs?.[0] ? normalizeArc(response.arcs[0]) : null;
  },
  async upsert(campaignId: string, arc: Arc) {
    const response = await apiFetch<{ arc: unknown }>(endpoint("arcs", campaignId), {
      method: "PUT", body: JSON.stringify({ arc }),
    });
    return normalizeArc(response.arc);
  },
};

export const milestonesRepo = {
  async getByArc(campaignId: string, arcId: string) {
    const params = new URLSearchParams({ resource: "milestones", campaignId, arcId });
    const response = await apiFetch<{ milestones: unknown[] }>(`/api/worldbuilding?${params.toString()}`);
    return (response.milestones || []).map(normalizeMilestone);
  },
  async getAll(campaignId: string) {
    const params = new URLSearchParams({ resource: "milestones", campaignId });
    const response = await apiFetch<{ milestones: unknown[] }>(`/api/worldbuilding?${params.toString()}`);
    return (response.milestones || []).map(normalizeMilestone);
  },
  async upsert(campaignId: string, milestone: Milestone) {
    const response = await apiFetch<{ milestone: unknown }>(endpoint("milestones", campaignId), {
      method: "PUT", body: JSON.stringify({ milestone }),
    });
    return normalizeMilestone(response.milestone);
  },
};
