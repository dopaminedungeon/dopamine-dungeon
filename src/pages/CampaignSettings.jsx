// src/pages/CampaignSettings.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import InvitePlayerForm from "../components/invitations/InvitePlayerForm.jsx";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  UserMinus,
} from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import {
  ApiRequestError,
  assignApiCharacter,
  getApiCampaignPeople,
  getApiCharacterAssignments,
  removeApiCampaignMember,
  resendApiInvitation,
  revokeApiInvitation,
  unassignApiCharacter,
  getApiCampaignSettings,
  updateApiCampaignSettings,
} from "../data/api/apiClient.ts";
import { getAllCharacters } from "../data/characters/characters.repo";

const STATUS = ["active", "paused", "completed"];

function formatTimestamp(value) {
  if (!value) return "—";
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? "—"
    : timestamp.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatLifecycleTimestamp(value, label) {
  const formatted = formatTimestamp(value);
  return formatted === "—" ? `${label} date unavailable` : `${label} ${formatted}`;
}

function getInvitationHistorySummary(person) {
  if (person.status === "revoked") {
    return formatLifecycleTimestamp(person.revokedAt, "Revoked");
  }

  if (person.status === "expired") {
    return formatLifecycleTimestamp(person.expiresAt, "Expired");
  }

  if (person.status === "accepted") {
    return formatLifecycleTimestamp(person.acceptedAt, "Accepted");
  }

  return "Invitation history";
}

function invitationStatusClass(status) {
  if (status === "accepted") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "pending") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
}

export default function CampaignSettings() {
  const { isGM } = useMode();

  const {
    accessibleCampaigns,
    selectedCampaignId,
    selectCampaign,
    updateCampaignInContext,
    createCampaign: createCampaignFromContext,
    campaignRole,
    refreshCampaigns,
  } = useCampaign();
  const { selectedTenantId, workspaceRole } = useTenant();

  const activeCampaign = useMemo(() => {
    return (
      (accessibleCampaigns || []).find(
        (campaign) =>
          String(campaign.campaignId ?? "") === String(selectedCampaignId) ||
          String(campaign.postgresCampaignId ?? "") === String(selectedCampaignId)
      ) || null
    );
  }, [accessibleCampaigns, selectedCampaignId]);

  const [draft, setDraft] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saveState, setSaveState] = useState({ type: null, message: "" });
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    status: "active",
    system: "",
  });
  const [campaignPeople, setCampaignPeople] = useState([]);
  const [campaignPeopleLoading, setCampaignPeopleLoading] = useState(false);
  const [campaignPeopleVersion, setCampaignPeopleVersion] = useState(0);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [assignableCharacters, setAssignableCharacters] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentSelectionByUserId, setAssignmentSelectionByUserId] = useState({});
  const [peopleActionId, setPeopleActionId] = useState(null);
  const [invitationActionError, setInvitationActionError] = useState("");
  const [invitationActionNotice, setInvitationActionNotice] = useState("");
  const [resendNow, setResendNow] = useState(() => Date.now());
  const createIdempotencyKeyRef = useRef(null);
  const canManageInvitations =
    isGM && workspaceRole === "owner" && campaignRole === "gm";

  useEffect(() => {
    const hasActiveResendCooldown = campaignPeople.some((person) => {
      if (person.type !== "invite" || person.status !== "pending" || !person.resendAvailableAt) {
        return false;
      }

      const availableAt = new Date(person.resendAvailableAt).getTime();
      return Number.isFinite(availableAt) && availableAt > Date.now();
    });

    if (!hasActiveResendCooldown) return undefined;

    setResendNow(Date.now());
    const intervalId = window.setInterval(() => setResendNow(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [campaignPeople]);

	  const createCampaign = async (e) => {
	    e?.preventDefault?.();
    if (creating) return;

    const name = (createForm.name || "").trim();
    if (!name || !selectedTenantId) return;

	    try {
      setCreating(true);
	      setSaveState({ type: null, message: "" });

      const created = await createCampaignFromContext({
        name,
        description: createForm.description || "",
        system: createForm.system || "",
        idempotencyKey: (createIdempotencyKeyRef.current ??= crypto.randomUUID()),
      });

      const createdId = created?.campaignId || created?.id || null;

      if (typeof refreshCampaigns === "function") {
        await refreshCampaigns();
      }

      if (createdId && typeof selectCampaign === "function") {
        await Promise.resolve(selectCampaign(createdId));
      }

      setDraft(created || null);
      setShowCreate(false);
      setCreateForm({ name: "", description: "", status: "active", system: "" });
      createIdempotencyKeyRef.current = null;
      setSaveState({ type: "success", message: "Campaign created." });
	    } catch (error) {
	      console.error("[CampaignSettings] Failed to create campaign", error);
	      setSaveState({ type: "error", message: "Could not create campaign." });
    } finally {
      setCreating(false);
	    }
	  };

  useEffect(() => {
    let cancelled = false;

    async function loadCampaignSettings() {
      if (!activeCampaign || !selectedCampaignId) {
        setDraft(null);
        return;
      }

      try {
        setDraft(null);
        setSettingsLoading(true);
        setSaveState({ type: null, message: "" });
        const response = await getApiCampaignSettings(selectedCampaignId);
        if (!cancelled) setDraft(response.campaign);
      } catch (error) {
        console.error("[CampaignSettings] Failed to load campaign settings", error);
        if (!cancelled) {
          setDraft(null);
          setSaveState({ type: "error", message: "Could not load campaign settings." });
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    loadCampaignSettings();
    return () => {
      cancelled = true;
    };
  }, [activeCampaign, selectedCampaignId]);

  useEffect(() => {
    const loadCampaignPeople = async () => {
      if (!selectedCampaignId) {
        setCampaignPeople([]);
        return;
      }

      try {
        setCampaignPeopleLoading(true);

        const [response, characters, assignmentData] = await Promise.all([
          getApiCampaignPeople(selectedCampaignId),
          getAllCharacters(selectedCampaignId),
          getApiCharacterAssignments(selectedCampaignId),
        ]);
        const blockedCharacterIds = new Set([
          ...(assignmentData.assignedCharacterIds || []),
          ...(assignmentData.pendingAssignedCharacterIds || []),
        ]);
        setCampaignPeople(response.people || []);
        setAssignmentRows(assignmentData.assignments || []);
        setCampaignCharacters(characters || []);
        setAssignableCharacters(
          (characters || []).filter((character) => !blockedCharacterIds.has(character.id))
        );
      } catch (error) {
        console.error("[CampaignSettings] Failed to load campaign people", error);
        setCampaignPeople([]);
        setAssignmentRows([]);
        setCampaignCharacters([]);
        setAssignableCharacters([]);
      } finally {
        setCampaignPeopleLoading(false);
      }
    };

    loadCampaignPeople();
  }, [selectedCampaignId, saveState.type, saveState.message, campaignPeopleVersion]);

  if (!isGM || (campaignRole && campaignRole !== "owner" && campaignRole !== "gm")) {
    return (
      <div className="text-white p-6">
        <h1 className="text-2xl font-bold">Campaign Settings</h1>
        <p className="text-zinc-300/75 mt-2">GM-only. Nice try though 😈</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Campaign Settings</h1>
            <p className="text-zinc-300/75 mt-2">
              {settingsLoading ? "Loading campaign settings…" : "No active campaign selected."}
            </p>
          </div>

          {isGM && (
	            <button
	              type="button"
              disabled={saving || creating}
	              onClick={() => setShowCreate(true)}
	              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              Add campaign
            </button>
          )}
        </div>

        {/* Create campaign modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create campaign</h2>

	              <form className="space-y-4" onSubmit={createCampaign}>
	                <fieldset disabled={creating} className="space-y-4 disabled:opacity-60">
                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">Status</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">System / ruleset</label>
                    <input
                      value={createForm.system}
                      onChange={(e) => setCreateForm((p) => ({ ...p, system: e.target.value }))}
                      placeholder="e.g. D&D 5e"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
	                    type="button"
	                    disabled={creating}
	                    onClick={() => setShowCreate(false)}
	                    className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
	                    type="submit"
	                    disabled={creating}
	                    className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
	                  >
	                    {creating ? "Creating..." : "Create"}
	                  </button>
	                </div>
	                </fieldset>
	              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const update = (key, value) => setDraft((p) => ({ ...p, [key]: value }));

	  const onSave = async () => {
	    const campaignId = draft?.campaignId || selectedCampaignId;
	    if (saving || !draft || !campaignId) return;

    try {
      setSaving(true);
      setSaveState({ type: null, message: "" });

      const requestedUpdate = {
        campaignId,
        name: draft.name || "",
        description: draft.description || "",
        status: draft.status || "active",
        system: draft.system || "",
        playerSummary: draft.playerSummary || "",
        gmNotes: draft.gmNotes || "",
        startDate: draft.startDate || "",
        endDate: draft.endDate || "",
      };

      const apiResponse = await updateApiCampaignSettings(requestedUpdate);
      const returnedCampaign =
        apiResponse?.campaign && typeof apiResponse.campaign === "object"
          ? apiResponse.campaign
          : {};

      const savedCampaignId =
        returnedCampaign.campaignId ||
        returnedCampaign.slug ||
        draft.campaignId ||
        selectedCampaignId ||
        campaignId;

      const savedFields = {
        campaignId: savedCampaignId,
        postgresCampaignId:
          returnedCampaign.postgresCampaignId ||
          returnedCampaign.id ||
          draft.postgresCampaignId ||
          draft.id ||
          null,
        id: returnedCampaign.id || draft.id,
        name: returnedCampaign.name ?? requestedUpdate.name,
        description: returnedCampaign.description ?? requestedUpdate.description,
        status: returnedCampaign.status ?? requestedUpdate.status,
        system: returnedCampaign.system ?? requestedUpdate.system,
        playerSummary: returnedCampaign.playerSummary ?? requestedUpdate.playerSummary,
        gmNotes: returnedCampaign.gmNotes ?? requestedUpdate.gmNotes,
        startDate: returnedCampaign.startDate ?? requestedUpdate.startDate,
        endDate: returnedCampaign.endDate ?? requestedUpdate.endDate,
        updatedAt: returnedCampaign.updatedAt ?? draft.updatedAt,
      };

      setDraft((current) => ({
        ...(current || {}),
        ...savedFields,
      }));

      if (typeof updateCampaignInContext === "function") {
        const { gmNotes: _gmNotes, ...playerSafeSavedFields } = savedFields;
        updateCampaignInContext(campaignId, playerSafeSavedFields);
      }

      setSaveState({ type: "success", message: "Campaign settings saved." });
    } catch (error) {
      console.error("[CampaignSettings] Failed to save campaign", error);
      setSaveState({ type: "error", message: "Could not save campaign settings." });
    } finally {
      setSaving(false);
    }
  };

	  const onRemoveCampaignMember = async (memberDocId) => {
	    const campaignId = draft?.campaignId || selectedCampaignId;
	    const actionId = `remove-${memberDocId}`;
	    if (peopleActionId || !memberDocId || !campaignId) return;

    const confirmed = window.confirm("Remove this member from the campaign?");
    if (!confirmed) return;

	    try {
      setPeopleActionId(actionId);
	      await removeApiCampaignMember(campaignId, memberDocId);
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Campaign member removed." });
	    } catch (error) {
	      console.error("[CampaignSettings] Failed to remove campaign member", error);
	      setSaveState({ type: "error", message: "Could not remove campaign member." });
    } finally {
      setPeopleActionId(null);
	    }
	  };

  const onInvitationAction = async (person, action) => {
    const campaignId = draft?.campaignId || selectedCampaignId;
    const invitationId = person?.docId;
    if (
      peopleActionId ||
      !selectedTenantId ||
      !campaignId ||
      !invitationId ||
      person?.status !== "pending"
    ) {
      return;
    }

    const actionId = `${action}-${invitationId}`;
    try {
      setPeopleActionId(actionId);
      setInvitationActionError("");
      setInvitationActionNotice("");
      if (action === "resend") {
        await resendApiInvitation({
          tenantId: selectedTenantId,
          campaignId,
          invitationId,
        });
      } else {
        await revokeApiInvitation({
          tenantId: selectedTenantId,
          campaignId,
          invitationId,
        });
      }
      setInvitationActionNotice(
        action === "resend" ? "Invitation resent." : "Invitation revoked."
      );
      setCampaignPeopleVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.retryAfterSeconds) {
        const resendAvailableAt = new Date(
          Date.now() + error.retryAfterSeconds * 1_000
        ).toISOString();
        setCampaignPeople((currentPeople) =>
          currentPeople.map((currentPerson) =>
            currentPerson.docId === invitationId
              ? { ...currentPerson, resendAvailableAt }
              : currentPerson
          )
        );
        setResendNow(Date.now());
        setInvitationActionError(
          `Please wait ${error.retryAfterSeconds}s before resending this invitation.`
        );
      } else {
        setInvitationActionError(
          action === "resend"
            ? "Could not resend this invitation."
            : "Could not revoke this invitation."
        );
      }
    } finally {
      setPeopleActionId(null);
    }
  };

  const getAssignmentForCharacter = (characterId) =>
    assignmentRows.find((assignment) => assignment.characterId === characterId) || null;

  const getCharacterName = (characterId) =>
    campaignCharacters.find((character) => character.id === characterId)?.name ||
    characterId;

	  const onAssignCharacter = async (person) => {
	    const campaignId = draft?.campaignId || selectedCampaignId;
	    const characterId = assignmentSelectionByUserId[person.userId];
	    const actionId = `assign-${person?.userId || "unknown"}`;
	    if (peopleActionId || !campaignId || !person?.userId || !characterId) return;

	    try {
      setPeopleActionId(actionId);
	      await assignApiCharacter(campaignId, person.userId, characterId);
      setAssignmentSelectionByUserId((current) => ({ ...current, [person.userId]: "" }));
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Character assigned." });
	    } catch (error) {
	      console.error("[CampaignSettings] Failed to assign character", error);
	      setSaveState({ type: "error", message: "Could not assign character." });
    } finally {
      setPeopleActionId(null);
	    }
	  };

	  const onUnassignCharacter = async (characterId) => {
	    const campaignId = draft?.campaignId || selectedCampaignId;
	    const assignment = getAssignmentForCharacter(characterId);
	    const actionId = `unassign-${characterId}`;
	    if (peopleActionId || !campaignId || !assignment) return;

	    try {
      setPeopleActionId(actionId);
	      await unassignApiCharacter(campaignId, { assignmentId: assignment.id });
      setCampaignPeopleVersion((value) => value + 1);
      setSaveState({ type: "success", message: "Character unassigned." });
	    } catch (error) {
	      console.error("[CampaignSettings] Failed to unassign character", error);
	      setSaveState({ type: "error", message: "Could not unassign character." });
    } finally {
      setPeopleActionId(null);
	    }
	  };

  const memberPeople = campaignPeople.filter((person) => person.type === "member");
  const invitationPeople = campaignPeople.filter((person) => person.type === "invite");
  const pendingInvitationPeople = invitationPeople.filter(
    (person) => person.status === "pending"
  );
  const invitationHistoryPeople = invitationPeople.filter(
    (person) => person.status !== "pending"
  );
  const getResendSecondsRemaining = (person) => {
    const availableAt = new Date(person.resendAvailableAt || "").getTime();
    if (!Number.isFinite(availableAt)) return 0;
    return Math.max(0, Math.ceil((availableAt - resendNow) / 1_000));
  };

  return (
    <div className="w-full text-white">
      <main className="w-full px-6 py-5 md:px-8 md:py-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Campaign Settings
            </h1>
            <p className="mt-1 text-sm text-zinc-300/85 max-w-xl">
              Configure the active campaign. (GM-only)
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90"
            >
              <Plus className="w-5 h-5" />
              Add campaign
            </button>

            <button
	              type="button"
              disabled={saving}
              onClick={() => {
                if (activeCampaign && selectedCampaignId) {
                  setSettingsLoading(true);
                  getApiCampaignSettings(selectedCampaignId)
                    .then((response) => {
                      setDraft(response.campaign);
                      setSaveState({ type: null, message: "" });
                    })
                    .catch((error) => {
                      console.error("[CampaignSettings] Failed to reset campaign settings", error);
                      setSaveState({ type: "error", message: "Could not reload campaign settings." });
                    })
                    .finally(() => setSettingsLoading(false));
                }
              }}
	              className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
	              className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
	              disabled
	              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete Campaign (temporarily unavailable)
            </button>
            <p className="self-center text-xs text-zinc-300/70">
              Campaign deletion is temporarily unavailable while #364 defines the safe lifecycle.
            </p>
            {saveState.type === "success" && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {saveState.message}
              </div>
            )}

            {saveState.type === "error" && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-red-200 text-sm">
                <AlertCircle className="w-4 h-4" />
                {saveState.message}
              </div>
            )}
          </div>
        </div>

        {/* Main sections */}
        <div className="space-y-4">
	          <fieldset disabled={saving} className="contents disabled:opacity-60">
	          {/* Player-safe campaign info */}
          <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(168,85,247,0.05),0_0_48px_rgba(99,102,241,0.10)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_75%_35%,rgba(59,130,246,0.12),transparent_30%),radial-gradient(circle_at_bottom_center,rgba(168,85,247,0.08),transparent_38%)] before:opacity-100 before:content-['']">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">Campaign overview</h2>
              <p className="mb-4 text-sm text-zinc-300/70">
                Public-facing campaign identity and player-safe summary.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Name</label>
                  <input
                    value={draft.name || ""}
                    onChange={(e) => update("name", e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Description</label>
                  <textarea
                    value={draft.description || ""}
                    onChange={(e) => update("description", e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-200/95 mb-1">Status</label>
                    <select
                      value={draft.status || "active"}
                      onChange={(e) => update("status", e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-200/95 mb-1">
                      System / ruleset (optional)
                    </label>
                    <input
                      value={draft.system || ""}
                      onChange={(e) => update("system", e.target.value)}
                      placeholder="e.g. D&D 5e, Pathfinder 2e…"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">Player summary</label>
                  <textarea
                    value={draft.playerSummary || ""}
                    onChange={(e) => update("playerSummary", e.target.value)}
                    rows={4}
                    placeholder="What players generally know / the elevator pitch…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

              </div>
            </div>
	          </section>
	          </fieldset>

	          <fieldset disabled={saving} className="contents disabled:opacity-60">
	          {/* GM-only notes */}
          <section className="relative overflow-hidden rounded-3xl border border-fuchsia-500/22 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(217,70,239,0.05),0_0_44px_rgba(168,85,247,0.10)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_36%),radial-gradient(circle_at_center,rgba(168,85,247,0.07),transparent_42%)] before:opacity-100 before:content-['']">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">GM-only notes</h2>
              <p className="mb-4 text-sm text-zinc-300/70">Private prep notes and campaign truth that players must not receive.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-zinc-200/95 mb-1">GM notes</label>
                  <textarea
                    value={draft.gmNotes || ""}
                    onChange={(e) => update("gmNotes", e.target.value)}
                    rows={4}
                    placeholder="Private prep notes, reminders, table meta…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400/80 shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>

              </div>
            </div>
	          </section>
	          </fieldset>

          {/* Campaign people & characters */}
          <section className="relative overflow-visible rounded-3xl border border-cyan-400/18 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.04),0_0_42px_rgba(34,211,238,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_left,rgba(168,85,247,0.12),transparent_34%),radial-gradient(circle_at_bottom_center,rgba(59,130,246,0.08),transparent_40%)] before:opacity-100 before:content-['']">
            <div className="relative z-10">
              <h2 className="text-lg font-semibold mb-2">Campaign people & characters</h2>
              <p className="mb-4 text-sm text-zinc-300/70">
                Invite players, review current campaign membership, track invite status, and manage character assignments.
              </p>

              {canManageInvitations ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 mb-4 shadow-[0_0_20px_rgba(168,85,247,0.04)]">
                    <p className="text-sm text-zinc-200 font-medium mb-2">Invite player</p>
                    <p className="mb-3 text-xs text-zinc-300/70">
                      Create a pending invitation for the active campaign and optionally reserve an available character.
                    </p>
                    <InvitePlayerForm
                      availabilityVersion={campaignPeopleVersion}
                      onInvitationCreated={() => {
                        setCampaignPeopleVersion((value) => value + 1);
                        setSaveState({ type: "success", message: "Invitation created." });
                      }}
                    />
                  </div>
                </>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-200 font-medium">Campaign people</p>
                  <span className="text-xs text-zinc-300/70">
                    {campaignPeopleLoading
                      ? "Loading…"
                      : `${memberPeople.length} member${memberPeople.length === 1 ? "" : "s"} · ${invitationPeople.length} invitation${invitationPeople.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {invitationActionError ? (
                  <p role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                    {invitationActionError}
                  </p>
                ) : null}
                {invitationActionNotice ? (
                  <p role="status" className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                    {invitationActionNotice}
                  </p>
                ) : null}

                {campaignPeopleLoading ? (
                  <p className="text-sm text-zinc-300/75">Loading campaign people…</p>
                ) : campaignPeople.length === 0 ? (
                  <p className="text-sm text-zinc-300/75">No campaign people or invitations yet.</p>
                ) : (
                  <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full min-w-[880px] border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.18em] text-zinc-400/80">
                          <th className="pb-2 pr-4 font-medium">Person</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Access</th>
                          <th className="pb-2 pr-4 font-medium">Assigned characters</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberPeople.map((person) => (
                          <tr key={person.id} className="align-top">
                            <td className="rounded-l-2xl border-y border-l border-white/10 bg-white/[0.025] px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-zinc-100">{person.label}</p>
                                {person.email && person.email !== "—" ? (
                                  <p className="text-xs text-zinc-400">{person.email}</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${invitationStatusClass(person.status)}`}
                              >
                                {person.status}
                              </span>
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-200">
                              <p>Workspace {person.workspaceRole}</p>
                              <p className="mt-1 text-xs text-zinc-400">Campaign {person.campaignRole}</p>
                            </td>
                            <td className="border-y border-white/10 bg-white/[0.025] px-4 py-3">
                              {person.characterIds?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {person.characterIds.map((characterId) => (
                                    <button
                                      type="button"
                                      key={`${person.id}-${characterId}`}
	                                      onClick={() => onUnassignCharacter(characterId)}
	                                      disabled={peopleActionId === `unassign-${characterId}` || Boolean(peopleActionId)}
	                                      className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                      title="Unassign this character"
                                    >
                                      {getCharacterName(characterId)} ×
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-500">No characters assigned</span>
                              )}
                              {person.type === "member" && person.userId ? (
                                <div className="mt-2 flex gap-2">
                                  <select
                                    value={assignmentSelectionByUserId[person.userId] || ""}
	                                    disabled={assignableCharacters.length === 0 || Boolean(peopleActionId)}
                                    onChange={(event) =>
                                      setAssignmentSelectionByUserId((current) => ({
                                        ...current,
                                        [person.userId]: event.target.value,
                                      }))
                                    }
                                    className="min-w-[160px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <option value="">
                                      {assignableCharacters.length === 0
                                        ? "No available PCs"
                                        : "Assign PC..."}
                                    </option>
                                    {assignableCharacters.map((character) => (
                                      <option key={character.id} value={character.id}>
                                        {character.name || character.id}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => onAssignCharacter(person)}
	                                    disabled={
                                        Boolean(peopleActionId) ||
	                                      assignableCharacters.length === 0 ||
                                      !assignmentSelectionByUserId[person.userId]
                                    }
                                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Assign
                                  </button>
                                </div>
                              ) : null}
                            </td>
                            <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/[0.025] px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => onRemoveCampaignMember(person.docId)}
                                  disabled={Boolean(peopleActionId)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <UserMinus className="h-4 w-4" />
                                  {peopleActionId === `remove-${person.docId}`
                                    ? "Removing…"
                                    : "Remove"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {pendingInvitationPeople.map((person) => (
                          <tr key={person.id} className="align-top">
                            <td className="rounded-l-2xl border-y border-l border-amber-400/15 bg-amber-400/[0.035] px-4 py-3">
                              <div className="space-y-1">
                                <p className="break-all text-sm font-medium text-zinc-100">{person.email}</p>
                                <p className="text-xs text-zinc-400">Pending invitation · expires {formatTimestamp(person.expiresAt)}</p>
                              </div>
                            </td>
                            <td className="border-y border-amber-400/15 bg-amber-400/[0.035] py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${invitationStatusClass(person.status)}`}>{person.status}</span>
                            </td>
                            <td className="border-y border-amber-400/15 bg-amber-400/[0.035] px-4 py-3 text-sm text-zinc-200">
                              <p>Workspace {person.workspaceRole}</p>
                              <p className="mt-1 text-xs text-zinc-400">Campaign {person.campaignRole}</p>
                            </td>
                            <td className="border-y border-amber-400/15 bg-amber-400/[0.035] px-4 py-3">
                              {person.characterIds?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {person.characterIds.map((characterId) => (
                                    <span key={`${person.id}-${characterId}`} className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100">
                                      Reserved: {getCharacterName(characterId)}
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-zinc-500">No characters reserved</span>}
                            </td>
                            <td className="rounded-r-2xl border-y border-r border-amber-400/15 bg-amber-400/[0.035] px-4 py-3">
                              {canManageInvitations ? (
                                <div className="flex flex-wrap justify-end gap-2">
                                  {(() => {
                                    const resendSecondsRemaining = getResendSecondsRemaining(person);
                                    const isResendCoolingDown = resendSecondsRemaining > 0;
                                    const cooldownDescriptionId = `invitation-resend-${person.docId}`;
                                    return (
                                  <>
                                    <button type="button" disabled={Boolean(peopleActionId) || isResendCoolingDown} onClick={() => onInvitationAction(person, "resend")} aria-describedby={isResendCoolingDown ? cooldownDescriptionId : undefined} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50">
                                      {peopleActionId === `resend-${person.docId}` ? "Resending…" : isResendCoolingDown ? `Resend in ${resendSecondsRemaining}s` : "Resend"}
                                    </button>
                                    {isResendCoolingDown ? (
                                      <span id={cooldownDescriptionId} className="sr-only">
                                        Resend becomes available in {resendSecondsRemaining} seconds.
                                      </span>
                                    ) : null}
                                  </>
                                    );
                                  })()}
                                  <button type="button" disabled={Boolean(peopleActionId)} onClick={() => onInvitationAction(person, "revoke")} className="rounded-lg border border-red-400/20 bg-red-400/10 px-2.5 py-1.5 text-xs text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50">
                                    {peopleActionId === `revoke-${person.docId}` ? "Revoking…" : "Revoke"}
                                  </button>
                                </div>
                              ) : <span className="text-xs text-zinc-500">—</span>}
                            </td>
                          </tr>
                        ))}
                        {invitationHistoryPeople.map((person) => (
                          <tr key={person.id} className="align-top text-zinc-400">
                            <td className="rounded-l-2xl border-y border-l border-white/8 bg-white/[0.015] px-4 py-3">
                              <div className="space-y-1">
                                <p className="break-all text-sm text-zinc-300">{person.email}</p>
                                <p className="text-xs text-zinc-500">{getInvitationHistorySummary(person)}</p>
                                {person.status === "accepted" ? (
                                  <p className="text-xs text-zinc-500">No active campaign membership</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="border-y border-white/8 bg-white/[0.015] py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${invitationStatusClass(person.status)}`}>{person.status === "accepted" ? "Accepted invitation" : person.status}</span></td>
                            <td className="border-y border-white/8 bg-white/[0.015] px-4 py-3 text-sm"><p>Workspace {person.workspaceRole}</p><p className="mt-1 text-xs text-zinc-500">Campaign {person.campaignRole}</p></td>
                            <td className="border-y border-white/8 bg-white/[0.015] px-4 py-3">
                              {person.characterIds?.length ? <span className="text-xs text-zinc-400">{person.characterIds.length} character{person.characterIds.length === 1 ? "" : "s"} reserved</span> : <span className="text-xs text-zinc-500">No characters reserved</span>}
                            </td>
                            <td className="rounded-r-2xl border-y border-r border-white/8 bg-white/[0.015] px-4 py-3 text-xs text-zinc-500">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom metadata strip */}
        <section className="relative mt-4 overflow-hidden rounded-3xl border border-fuchsia-500/16 bg-zinc-950/55 p-5 shadow-[0_0_0_1px_rgba(168,85,247,0.04),0_0_36px_rgba(99,102,241,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_34%),radial-gradient(circle_at_right,rgba(59,130,246,0.08),transparent_30%)] before:opacity-100 before:content-['']">
          <div className="relative z-10">
            <h3 className="text-base font-semibold text-white mb-2">Metadata</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <div>
                <label className="block text-sm text-zinc-200/95 mb-1">Start date</label>
                <input
                  type="date"
                  value={draft.startDate || ""}
                  onChange={(e) => update("startDate", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-200/95 mb-1">End date</label>
                <input
                  type="date"
                  value={draft.endDate || ""}
                  onChange={(e) => update("endDate", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
                />
              </div>
            </div>

          </div>
        </section>

        {/* Create campaign modal */}
	        {showCreate && (
	          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
	            <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
	              <h2 className="text-xl font-bold text-white mb-4">Create campaign</h2>

	              <form className="space-y-4" onSubmit={createCampaign}>
	                <fieldset disabled={creating} className="space-y-4 disabled:opacity-60">
	                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300/75 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">Status</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300/75 mb-1">System / ruleset</label>
                    <input
                      value={createForm.system}
                      onChange={(e) => setCreateForm((p) => ({ ...p, system: e.target.value }))}
                      placeholder="e.g. D&D 5e"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
	                    type="button"
	                    disabled={creating}
	                    onClick={() => setShowCreate(false)}
	                    className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
	                    type="submit"
	                    disabled={creating}
	                    className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
	                  >
	                    {creating ? "Creating..." : "Create"}
	                  </button>
	                </div>
	                </fieldset>
	              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
