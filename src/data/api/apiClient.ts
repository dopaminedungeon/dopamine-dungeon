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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `API request failed: ${response.status}`;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.error ?? errorMessage;
    } catch {
      // Ignore non-JSON error bodies.
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
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