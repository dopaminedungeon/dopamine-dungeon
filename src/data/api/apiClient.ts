import { auth } from "../../firebase/firebase";

function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;

  if (configuredUrl) return configuredUrl;

  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "5173"
  ) {
    return "http://localhost:3000";
  }

  return "";
}

const API_BASE_URL = getApiBaseUrl();

type ApiOptions = RequestInit & {
  skipAuth?: boolean;
};

async function getAuthHeaders(skipAuth?: boolean): Promise<HeadersInit> {
  if (skipAuth) {
    return {};
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("No authenticated Firebase user available for API request");
  }

  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth, headers, ...requestOptions } = options;

  const authHeaders = await getAuthHeaders(skipAuth);
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...headers,
    },
  });
  const responseText = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json") || contentType.includes("+json");

  if (!isJson) {
    throw new Error(`API request returned non-JSON response: ${response.status} ${url}`);
  }

  let responseBody: unknown;

  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(`API request returned invalid JSON: ${response.status} ${url}`);
  }

  if (!response.ok) {
    let errorMessage = `API request failed: ${response.status}`;

    if (
      responseBody &&
      typeof responseBody === "object" &&
      "error" in responseBody &&
      typeof responseBody.error === "string"
    ) {
      errorMessage = responseBody.error;
    }

    throw new Error(errorMessage);
  }

  return responseBody as T;
}

export async function getApiMe() {
  return apiFetch<{
    ok: true;
    user: unknown;
    workspaces: unknown[];
    workspaceMemberships: unknown[];
    campaigns: unknown[];
    campaignMemberships: unknown[];
  }>("/api/me");
}

export async function createApiInvitation(input: {
  email: string;
  tenantId: string;
  campaignId: string;
  campaignRole?: "player" | "gm";
}) {
  return apiFetch<{
    ok: true;
    invitation: {
      id: string;
      email: string;
      normalizedEmail: string;
      tenantId: string;
      campaignId: string;
      workspaceRole: string;
      campaignRole: string;
      characterId: string | null;
      status: string;
      createdAt: string;
    };
  }>("/api/invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function acceptPendingApiInvitations() {
  return apiFetch<{
    ok: true;
    acceptedInvitations: Array<{
      id: string;
      tenantId: string;
      campaignId: string;
      workspaceRole: string;
      campaignRole: string;
      status: string;
      acceptedAt: string | null;
    }>;
  }>("/api/invitations/accept-pending", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getApiCampaignPeople(campaignId: string) {
  return apiFetch<{
    ok: true;
    campaignId: string;
    people: Array<{
      id: string;
      docId: string;
      type: "member" | "invite";
      status: string;
      email: string;
      label: string;
      userId: string | null;
      workspaceRole: string;
      campaignRole: string;
      characterIds: string[];
    }>;
  }>(`/api/campaign-people?campaignId=${encodeURIComponent(campaignId)}`);
}

export async function revokeApiCampaignInvite(campaignId: string, inviteId: string) {
  return apiFetch<{ ok: true }>("/api/campaign-people", {
    method: "DELETE",
    body: JSON.stringify({
      campaignId,
      personType: "invite",
      personId: inviteId,
    }),
  });
}

export async function removeApiCampaignMember(campaignId: string, memberId: string) {
  return apiFetch<{ ok: true }>("/api/campaign-people", {
    method: "DELETE",
    body: JSON.stringify({
      campaignId,
      personType: "member",
      personId: memberId,
    }),
  });
}

export async function getApiWorkspacePeople(tenantId: string) {
  return apiFetch<{
    ok: true;
    tenantId: string;
    workspaceId: string;
    members: Array<{
      id: string;
      membershipId: string | null;
      type: "workspace" | "campaign-only";
      userId: string;
      firebaseUid: string | null;
      label: string;
      email: string;
      role: string;
      campaignMembershipCount: number;
      campaignRoles: string[];
      createdAt: string | null;
    }>;
  }>(`/api/workspace-people?tenantId=${encodeURIComponent(tenantId)}`);
}

export async function updateApiWorkspaceMemberRole(
  tenantId: string,
  memberId: string,
  role: string
) {
  return apiFetch<{ ok: true }>("/api/workspace-people", {
    method: "PATCH",
    body: JSON.stringify({
      tenantId,
      memberId,
      role,
    }),
  });
}

export async function removeApiWorkspaceMember(tenantId: string, memberId: string) {
  return apiFetch<{ ok: true }>("/api/workspace-people", {
    method: "DELETE",
    body: JSON.stringify({
      tenantId,
      memberId,
    }),
  });
}
