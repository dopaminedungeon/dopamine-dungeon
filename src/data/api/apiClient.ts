import { auth } from "../../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

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

async function waitForAuthUser() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const authWithReady = auth as typeof auth & {
    authStateReady?: () => Promise<void>;
  };

  if (typeof authWithReady.authStateReady === "function") {
    await authWithReady.authStateReady();
    return auth.currentUser;
  }

  return new Promise<typeof auth.currentUser>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function getAuthHeaders(skipAuth?: boolean): Promise<HeadersInit> {
  if (skipAuth) {
    return {};
  }

  const user = await waitForAuthUser();

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
  const method = String(requestOptions.method || "GET").toUpperCase();

  const response = await fetch(url, {
    ...requestOptions,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(method === "GET"
        ? {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          }
        : {}),
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
  characterIds?: string[];
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

export async function updateApiCampaign(input: {
  campaignId: string;
  name?: string;
  description?: string;
  status?: string;
  system?: string;
}) {
  return apiFetch<{
    ok: true;
    campaign: unknown;
  }>("/api/campaign-people", {
    method: "PATCH",
    body: JSON.stringify(input),
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
      displayName: string | null;
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
      displayName: string | null;
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

export async function getApiCharacterAssignments(campaignId: string) {
  return apiFetch<{
    ok: true;
    assignments: Array<{
      id: string;
      campaignId: string;
      characterId: string;
      userId: string;
      createdAt: string;
    }>;
    assignedCharacterIds: string[];
    pendingAssignedCharacterIds: string[];
    characters: unknown[];
  }>(`/api/character-assignments?campaignId=${encodeURIComponent(campaignId)}`);
}

export async function assignApiCharacter(
  campaignId: string,
  userId: string,
  characterId: string
) {
  return apiFetch<{ ok: true; assignment: unknown }>("/api/character-assignments", {
    method: "POST",
    body: JSON.stringify({ campaignId, userId, characterId }),
  });
}

export async function unassignApiCharacter(
  campaignId: string,
  input: { assignmentId?: string; characterId?: string }
) {
  return apiFetch<{ ok: true }>("/api/character-assignments", {
    method: "DELETE",
    body: JSON.stringify({ campaignId, ...input }),
  });
}
