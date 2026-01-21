import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useTenant } from "./TenantContext.jsx";
import { useCampaign } from "./CampaignContext.jsx";

// Backward-compat: older parts of the app used a single global key and lowercase values.
const LEGACY_STORAGE_KEY = "dd-mode";

function normalizeMode(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "gm") return "gm";
  if (s === "player") return "player";
  return null;
}

function normalizeRole(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "campaigngm" || s === "gm" || s.includes("gm")) return "gm";
  if (s === "campaignplayer" || s === "player" || s.includes("player")) return "player";
  return null;
}

const ModeContext = createContext(null);

function readStoredMode(storageKey) {
  try {
    // Prefer the per-(tenant,campaign) key.
    const v = normalizeMode(localStorage.getItem(storageKey));
    if (v) return v;

    // Fallback to legacy global key for older UI pieces.
    return normalizeMode(localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredMode(storageKey, mode) {
  try {
    const normalized = normalizeMode(mode);
    if (!normalized) return;

    // New per-context key.
    localStorage.setItem(storageKey, normalized);

    // Legacy key (lowercase) for older UI/guards/topbar until refactor is complete.
    localStorage.setItem(LEGACY_STORAGE_KEY, normalized.toLowerCase());
  } catch {
    // ignore storage errors
  }
}

export function ModeProvider({ children }) {
  const { user } = useAuth();
  const { activeTenantId } = useTenant();
  const { activeCampaignId, campaignRole } = useCampaign();

  // Can the user act as GM in the *active campaign*?
  const canActAsGM = useMemo(() => {
    const role = normalizeRole(campaignRole);
    return role === "gm";
  }, [campaignRole]);

  // Storage key is scoped by active tenant + campaign.
  const storageKey = useMemo(() => {
    const t = activeTenantId || "none";
    const c = activeCampaignId || "none";
    return `dd:mode:${t}:${c}`;
  }, [activeTenantId, activeCampaignId]);

  // Default mode is derived from role once tenant+campaign are selected.
  const defaultMode = useMemo(() => {
    // If we don't have a campaign selected yet, don't force anything.
    if (!activeCampaignId) return null;
    return canActAsGM ? "gm" : "player";
  }, [activeCampaignId, canActAsGM]);

  const [mode, setMode] = useState(null);

  // Rehydrate mode whenever the (tenant,campaign) scope changes.
  useEffect(() => {
    const stored = readStoredMode(storageKey);

    // If we have a stored mode, use it (but never allow GM if role doesn't allow it).
    if (stored) {
      const safe = stored === "gm" && !canActAsGM ? "player" : stored;
      setMode(safe);
      // Also persist the safe value to keep keys consistent.
      writeStoredMode(storageKey, safe);
      return;
    }

    // Otherwise choose the default derived from role.
    if (defaultMode) {
      setMode(defaultMode);
      writeStoredMode(storageKey, defaultMode);
    } else {
      setMode(null);
    }
  }, [storageKey, canActAsGM, defaultMode]);

  // If permissions change (e.g. role is Player) and mode is GM, downgrade.
  useEffect(() => {
    if (mode === "gm" && !canActAsGM) {
      setMode("player");
      writeStoredMode(storageKey, "player");
    }
  }, [mode, canActAsGM, storageKey]);

  const setModeSafe = useCallback(
    (nextMode) => {
      const normalized = normalizeMode(nextMode);
      if (!normalized) return;

      // Role wins: can't switch to GM if you're not a campaign GM.
      if (normalized === "gm" && !canActAsGM) return;

      setMode(normalized);
      writeStoredMode(storageKey, normalized);
    },
    [canActAsGM, storageKey]
  );

  const value = useMemo(
  () => ({
    mode,
    isGM: String(mode || "").toLowerCase() === "gm",
    isGMMode: String(mode || "").toLowerCase() === "gm",
    setMode: setModeSafe,
    canActAsGM,
    storageKey,
    activeTenantId,
    activeCampaignId,
    user,
  }),
  [mode, setModeSafe, canActAsGM, storageKey, activeTenantId, activeCampaignId, user]
);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within a ModeProvider");
  return ctx;
}

export default ModeContext;