import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCampaign } from "../../context/CampaignContext.jsx";
import { useMode } from "../../context/ModeContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  createFilterPreferenceScopeKey,
  getFilterPreferenceValues,
  mergeFilterPreference,
  normalizeFilterSelections,
} from "./filterPreferences.js";
import { readFilterPreferences, writeFilterPreferences } from "./filterPreferenceStorage.js";

const EMPTY_DOCUMENT = { version: 1, scopes: {} };

export function useFilterPreferences(functionality, definitions) {
  const { user } = useAuth();
  const userUid = user?.uid ?? null;
  const { accessSnapshotUserUid, tenantStatus, selectedTenantId } = useTenant();
  const { campaignStatus, selectedCampaignId } = useCampaign();
  const { mode, isGM } = useMode();

  const context = useMemo(() => ({
    workspaceId: String(selectedTenantId || "none"),
    campaignId: String(selectedCampaignId || "none"),
    mode: isGM ? "gm" : "player",
  }), [isGM, selectedCampaignId, selectedTenantId]);
  const scopeKey = useMemo(() => createFilterPreferenceScopeKey(context), [context]);
  const [preferenceState, setPreferenceState] = useState(() => ({
    userUid: user?.uid ?? null,
    document: user?.uid ? readFilterPreferences(user.uid) : EMPTY_DOCUMENT,
  }));
  const preferenceStateRef = useRef(preferenceState);
  const storedDocumentForUser = useMemo(
    () => userUid ? readFilterPreferences(userUid) : EMPTY_DOCUMENT,
    [userUid]
  );
  const effectivePreferenceState = preferenceState.userUid === userUid
    ? preferenceState
    : { userUid, document: storedDocumentForUser };

  const storedValues = getFilterPreferenceValues(
    effectivePreferenceState.document,
    scopeKey,
    functionality
  );
  const values = useMemo(
    () => normalizeFilterSelections(storedValues, definitions),
    [definitions, storedValues]
  );
  const isReady = Boolean(
    userUid &&
    accessSnapshotUserUid === userUid &&
    effectivePreferenceState.userUid === userUid &&
    ["ready", "empty"].includes(tenantStatus) &&
    (selectedCampaignId
      ? campaignStatus === "ready" && ["gm", "player"].includes(mode)
      : !["loading", "unknown"].includes(campaignStatus))
  );

  const persistValues = useCallback((nextValues) => {
    if (!userUid) return false;
    const normalized = normalizeFilterSelections(nextValues, definitions);
    const baseDocument = preferenceStateRef.current.userUid === userUid
      ? preferenceStateRef.current.document
      : storedDocumentForUser;
    const nextState = {
      userUid,
      document: mergeFilterPreference(
        baseDocument,
        scopeKey,
        functionality,
        normalized
      ),
    };
    preferenceStateRef.current = nextState;
    return writeFilterPreferences(userUid, nextState.document);
  }, [definitions, functionality, scopeKey, storedDocumentForUser, userUid]);

  const saveValues = useCallback((nextValues) => {
    if (!userUid) return false;
    const persisted = persistValues(nextValues);
    setPreferenceState(preferenceStateRef.current);
    return persisted;
  }, [persistValues, userUid]);

  const setValue = useCallback((field, value) => {
    const definition = definitions[field];
    if (!definition || !definition.options.includes(value)) return Promise.resolve(false);
    return saveValues({ ...values, [field]: value });
  }, [definitions, saveValues, values]);

  useEffect(() => {
    if (!isReady || Object.keys(storedValues).length === 0) return;
    if (JSON.stringify(storedValues) !== JSON.stringify(values)) {
      persistValues(values);
    }
  }, [isReady, persistValues, storedValues, values]);

  return { values, setValue, saveValues, isReady };
}
