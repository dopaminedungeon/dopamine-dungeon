import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Map as MapIcon, Trash2 } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { itemsRepo } from "../data/items/items.repo";
import SessionEntityLinkManager from "../components/session/SessionEntityLinkManager.jsx";
import { useCampaign } from "../context/CampaignContext";
import { getApiCampaignPeople, getApiCharacterAssignments } from "../data/api/apiClient.ts";
import { getAllCharacters } from "../data/characters/characters.repo";

const SESSION_STATUSES = ["scheduled", "active", "paused", "completed"];

function getSessionDateValue(value) {
  const rawDate = String(value || "").trim();
  if (!rawDate) return "";
  return rawDate.slice(0, 10);
}

function formatSessionDate(value) {
  const rawDate = getSessionDateValue(value);
  if (!rawDate) return "";

  const parsed = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return rawDate;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderInlineMarkdown(text) {
  const raw = String(text || "");
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.slice(lastIndex));
  }

  return parts.map((part, index) =>
    typeof part === "string" ? <React.Fragment key={index}>{part}</React.Fragment> : part
  );
}

function renderMarkdownBlock(value, placeholder = "") {
  const text = String(value || "").trim();
  if (!text) {
    return <p className="text-zinc-500 text-sm italic">{placeholder}</p>;
  }

  const nodes = [];
  let paragraphLines = [];
  let listItems = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const content = paragraphLines.join("\n");
    nodes.push(
      <p key={`p-${nodes.length}`} className="whitespace-pre-line leading-6">
        {renderInlineMarkdown(content)}
      </p>
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();

      const level = heading[1].length;
      const className =
        level === 1
          ? "text-xl font-semibold text-white"
          : level === 2
            ? "text-lg font-semibold text-white"
            : "text-base font-semibold text-zinc-100";

      nodes.push(
        <h3 key={`h-${nodes.length}`} className={className}>
          {renderInlineMarkdown(heading[2])}
        </h3>
      );
      return;
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      return;
    }

    flushList();
    paragraphLines.push(line.trimEnd());
  });

  flushParagraph();
  flushList();

  return (
    <div className="space-y-3 text-sm text-zinc-300">
      {nodes}
    </div>
  );
}

export default function SessionProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const { selectedCampaignId } = useCampaign();
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState([]);
  const [campaignPeople, setCampaignPeople] = useState([]);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setAllSessions([]);
      setAllItems([]);
      setCampaignPeople([]);
      setCampaignCharacters([]);
      setAssignmentRows([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [sessionData, itemData] = await Promise.all([
          sessionsRepo.getAll(selectedCampaignId),
          itemsRepo.getAll(selectedCampaignId),
        ]);
        setAllSessions(Array.isArray(sessionData) ? sessionData : []);
        setAllItems(Array.isArray(itemData) ? itemData : []);
      } catch (error) {
        console.error("[SessionProfile] Failed to load session data", error);
        setAllSessions([]);
        setAllItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId || !isGM) {
      setCampaignPeople([]);
      setCampaignCharacters([]);
      setAssignmentRows([]);
      return;
    }

    let cancelled = false;

    async function loadAttendanceOptions() {
      try {
        const [peopleData, charactersData, assignmentData] = await Promise.all([
          getApiCampaignPeople(selectedCampaignId),
          getAllCharacters(selectedCampaignId),
          getApiCharacterAssignments(selectedCampaignId),
        ]);

        if (cancelled) return;
        setCampaignPeople(peopleData.people || []);
        setCampaignCharacters(charactersData || []);
        setAssignmentRows(assignmentData.assignments || []);
      } catch (error) {
        if (cancelled) return;
        console.error("[SessionProfile] Failed to load attendance options", error);
        setCampaignPeople([]);
        setCampaignCharacters([]);
        setAssignmentRows([]);
      }
    }

    loadAttendanceOptions();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, isGM]);
  const session = useMemo(
    () => allSessions.find((s) => String(s.id) === String(id)),
    [allSessions, id]
  );

  const normalizedSession = useMemo(() => {
    if (!session) return null;
    const summary = session.summary ?? "";
    return {
      ...session,
      summary,
      timeline: session.timeline ?? "",
      moments: session.moments ?? "",
      quotes: session.quotes ?? "",
      gmNotes: session.gmNotes ?? "",
      gmSecrets: session.gmSecrets ?? "",
      gmPrep: Array.isArray(session.gmPrep) ? session.gmPrep : [],
      attendees: Array.isArray(session.attendees) ? session.attendees : [],
      startTime: getSessionDateValue(session.startTime),
    };
  }, [session]);

  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editableSession, setEditableSession] = useState(() =>
    normalizedSession ? { ...normalizedSession } : null
  );

  useEffect(() => {
    if (normalizedSession && !editMode) setEditableSession({ ...normalizedSession });
  }, [normalizedSession, editMode]);

  const normalizedEditable = useMemo(() => {
    if (!editableSession) return null;
    const summary = editableSession.summary ?? "";
    return {
      ...editableSession,
      summary,
      timeline: editableSession.timeline ?? "",
      moments: editableSession.moments ?? "",
      quotes: editableSession.quotes ?? "",
      gmNotes: editableSession.gmNotes ?? "",
      gmSecrets: editableSession.gmSecrets ?? "",
      gmPrep: Array.isArray(editableSession.gmPrep) ? editableSession.gmPrep : [],
      attendees: Array.isArray(editableSession.attendees) ? editableSession.attendees : [],
      startTime: getSessionDateValue(editableSession.startTime),
    };
  }, [editableSession]);

  const [gmPrepText, setGmPrepText] = useState("");
  useEffect(() => {
    if (!normalizedSession) return;
    setGmPrepText(normalizedSession.gmPrep.join("\n"));
  }, [normalizedSession]);

  const attendeeOptions = useMemo(() => {
    const charactersById = new Map(
      (campaignCharacters || []).map((character) => [String(character.id), character])
    );
    const peopleByUserId = new Map(
      (campaignPeople || [])
        .filter((person) => person.type === "member" && person.status === "accepted")
        .map((person) => [String(person.userId || ""), person])
    );

    return (assignmentRows || [])
      .map((assignment) => {
        const character = charactersById.get(String(assignment.characterId));
        const person = peopleByUserId.get(String(assignment.userId || ""));
        const characterName = String(character?.name || "").trim();
        const playerName = String(person?.label || "").trim();
        if (!characterName || !playerName) return null;

        const label = `${characterName} — ${playerName}`;
        return { value: label, label };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [assignmentRows, campaignCharacters, campaignPeople]);

  if (loading) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Loading session...</div>
      </main>
    );
  }
  // No such session at all
  if (!normalizedSession) {
    return (
      <main className="flex-1 overflow-auto text-white">
        <h1 className="text-3xl font-bold">Session Not Found</h1>
        <p className="text-zinc-400 mt-2">
          There is no session with this ID.
        </p>
        <button
          onClick={() => navigate("/sessions")}
          className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
        >
          Back to Sessions
        </button>
      </main>
    );
  }

  // GM restriction guard: prevent players from viewing GM-only sessions
  if (normalizedSession?.visibility === "gm-only" && !isGM) {
    return (
      <main className="flex-1 overflow-auto">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 sm:mb-6"
          onClick={() => navigate("/sessions")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Sessions
        </button>
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This session is marked GM-only. Players don’t get to see it until it’s revealed in play. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/sessions")}
          >
            Back to Sessions
          </button>
        </div>
      </main>
    );
  }

  const viewSession = editMode ? (normalizedEditable ?? normalizedSession) : normalizedSession;
  const isGmOnlyCurrent = viewSession?.visibility === "gm-only";

  const handleFieldChange = (field, value) => {
    setEditableSession((prev) => {
      const base = prev ?? (normalizedSession ? { ...normalizedSession } : {});
      return { ...base, [field]: value };
    });
  };

  const handleVisibilityChange = (visibility) => {
    if (!isGM || !editMode) return;
    setEditableSession((prev) => ({
      ...prev,
      visibility,
    }));
  };

  const toggleAttendee = (attendeeValue) => {
    setEditableSession((prev) => {
      const base = prev ?? (normalizedSession ? { ...normalizedSession } : {});
      const current = Array.isArray(base.attendees) ? base.attendees : [];
      const next = current.includes(attendeeValue)
        ? current.filter((value) => value !== attendeeValue)
        : [...current, attendeeValue];

      return { ...base, attendees: next };
    });
  };

  return (
    <main className="flex-1 overflow-auto">
      <button
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 sm:mb-6"
        onClick={() => navigate("/sessions")}
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Sessions
      </button>

      <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-8 backdrop-blur-sm space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex flex-wrap items-center gap-2">
              {viewSession?.name || "Untitled session"}
              {isGmOnlyCurrent && (
                <span className="px-2 py-1 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                  GM ONLY
                </span>
              )}
            </h1>
            <p className="text-zinc-400 text-sm">
              {viewSession?.map || ""}
              {viewSession.sessionNumber !== undefined &&
                viewSession.sessionNumber !== null &&
                viewSession.sessionNumber !== "" && (
                <> • Session #{viewSession.sessionNumber}</>
              )}
              {viewSession.startTime && <> • {formatSessionDate(viewSession.startTime)}</>}
            </p>
          </div>

          {isGM && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start">
              <div className="flex flex-wrap items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
	                <button
	                  type="button"
	                  disabled={!editMode || isSaving}
                  onClick={() => handleVisibilityChange("public")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${viewSession.visibility === "public"
                    ? "bg-emerald-500 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                    }`}
                >
                  Player-visible
                </button>
	                <button
	                  type="button"
	                  disabled={!editMode || isSaving}
                  onClick={() => handleVisibilityChange("gm-only")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${viewSession.visibility === "gm-only"
                    ? "bg-red-500 text-white"
                    : "text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                    }`}
                >
                  GM-only
                </button>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (isSaving) return;

                  if (editMode && normalizedEditable) {
                    const gmPrep = gmPrepText
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);

                    const toSave = {
                      ...normalizedEditable,
                      summary: normalizedEditable.summary,
                      timeline: normalizedEditable.timeline ?? "",
                      moments: normalizedEditable.moments ?? "",
                      quotes: normalizedEditable.quotes ?? "",
                      startTime: getSessionDateValue(normalizedEditable.startTime),
                      gmPrep,
                      attendees: Array.isArray(normalizedEditable.attendees)
                        ? normalizedEditable.attendees
                        : [],
                    };

                    try {
                      setIsSaving(true);
                      await sessionsRepo.upsert(selectedCampaignId, toSave);
                      const data = await sessionsRepo.getAll(selectedCampaignId);
                      setAllSessions(data);
                    } finally {
                      setIsSaving(false);
                    }
                  }

                  setEditMode((prev) => !prev);
                }}
                className="px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:bg-white/10 transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : editMode ? "Done" : "Edit"}
              </button>
	              <button
	                type="button"
	                disabled={isDeleting || isSaving}
	                onClick={async () => {
	                  if (isDeleting || isSaving) return;
                  const ok = window.confirm("Delete this session? This cannot be undone.");
                  if (!ok) return;

                  try {
                    setIsDeleting(true);
                    await sessionsRepo.remove(selectedCampaignId, String(id));
                    navigate("/sessions");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 hover:bg-red-500/25 transition flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-red-500/15"
                title="Delete session"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>

	        <fieldset disabled={isSaving} className="contents disabled:opacity-60">
	        {isGM && editMode ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Session details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Name</span>
                <input
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.name ?? ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Session number</span>
                <input
                  type="number"
                  min={0}
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.sessionNumber ?? 0}
                  onChange={(e) =>
                    handleFieldChange(
                      "sessionNumber",
                      Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0
                    )
                  }
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Date</span>
                <input
                  type="date"
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={getSessionDateValue(editableSession?.startTime)}
                  onChange={(e) => handleFieldChange("startTime", getSessionDateValue(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Location</span>
                <input
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.map ?? ""}
                  onChange={(e) => handleFieldChange("map", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Status</span>
                <select
                  className="w-full bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.status ?? "scheduled"}
                  onChange={(e) => handleFieldChange("status", e.target.value)}
                >
                  {SESSION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Visibility</span>
                <select
                  className="w-full bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  value={editableSession?.visibility ?? "public"}
                  onChange={(e) => handleFieldChange("visibility", e.target.value)}
                >
                  <option value="public">Player-visible</option>
                  <option value="gm-only">GM-only</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {/* Player & GM layout */}
        <div className={`grid grid-cols-1 ${isGM ? "lg:grid-cols-2" : ""} gap-4 sm:gap-6 pt-2`}>
          {/* LEFT: Player overview */}
          <div className="space-y-4">
            {/* Recap */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Session recap</h2>
              {isGM && editMode ? (
                <textarea
                  className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                  rows={4}
                  value={editableSession?.summary ?? ""}
                  onChange={(e) => handleFieldChange("summary", e.target.value)}
                />
              ) : (
                renderMarkdownBlock(viewSession?.summary, "No player-facing recap yet.")
              )}
            </div>

            {/* Linked entities (Session cross-links) */}

            {/* Attendance */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Attendance</h2>
              {isGM && editMode ? (
                <div className="space-y-2">
                  {attendeeOptions.length === 0 ? (
                    <p className="text-sm text-zinc-500">No assigned characters available for attendance yet.</p>
                  ) : (
                    attendeeOptions.map((option) => {
                      const checked = (editableSession?.attendees || []).includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-zinc-200"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAttendee(option.value)}
                            className="h-4 w-4 accent-purple-500"
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              ) : (viewSession?.attendees || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {viewSession.attendees.map((attendee) => (
                    <span
                      key={attendee}
                      className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100"
                    >
                      {attendee}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No attendance recorded yet.</p>
              )}
            </div>

            {/* Items discovered, Notable NPCs, timeline, Moments, Quotes, NPC relationships */}
            {/* Items discovered (player-visible) */}
            {/* Items (player-visible) */}
	            <SessionEntityLinkManager
              sessionId={String(id)}
              entityType="Item"
              label="introduced"
              sectionTitle="Items discovered"
              isGM={isGM}
              editMode={editMode}
              visibilityMode={isGM ? "GM" : "Player"}
              dataSource={allItems}
              getEntityLabel={(item) => item?.name}
              onAddNew={() => navigate("/items")}
              renderCard={(item, link, helpers) => {
	                const { isGM, editMode, navigate, handleRemove, isBusy } = helpers;

                return (
                  <div
                    key={link.id}
                    className="relative group bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition flex flex-col justify-between"
                  >
                    {isGM && editMode && (
	                      <button
	                        type="button"
                          disabled={isBusy}
	                        onClick={() => handleRemove(link.id)}
	                        className="absolute top-2 right-2 text-[10px] text-red-400 hover:text-red-200 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
	                      >
                        Remove
                      </button>
                    )}

                    <div
                      role="button"
                      onClick={() => navigate(`/items/${item.id}`)}
                      className="cursor-pointer"
                    >
                      <p className="text-white font-semibold text-sm">{item?.name || "Untitled item"}</p>
                      {item?.rarity && (
                        <p className="text-zinc-400 text-xs mt-1">{item.rarity}</p>
                      )}
		        </div>

                    <div className="flex items-center justify-end mt-3">
                      {isGM && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${link.visibility === "GM"
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            }`}
                        >
                          {link.visibility}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {/* Session timeline */}
            {(editMode || (viewSession?.timeline && viewSession.timeline.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Session timeline</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.timeline ?? ""}
                    onChange={(e) => handleFieldChange("timeline", e.target.value)}
                    placeholder="Key beats in order…"
                  />
                ) : (
                  renderMarkdownBlock(viewSession?.timeline)
                )}
              </div>
            )}

            {/* Moments */}
            {(editMode || (viewSession?.moments && viewSession.moments.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Moments</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.moments ?? ""}
                    onChange={(e) => handleFieldChange("moments", e.target.value)}
                    placeholder="Cinematic highlights, emotional gut-punches…"
                  />
                ) : (
                  renderMarkdownBlock(viewSession?.moments)
                )}
              </div>
            )}

            {/* Quotes of the day */}
            {(editMode || (viewSession?.quotes && viewSession.quotes.trim().length > 0)) && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-white mb-2">Quotes of the day</h2>

                {isGM && editMode ? (
                  <textarea
                    className="w-full bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/60"
                    rows={3}
                    value={editableSession?.quotes ?? ""}
                    onChange={(e) => handleFieldChange("quotes", e.target.value)}
                    placeholder="Best one-liners, table memes…"
                  />
                ) : (
                  renderMarkdownBlock(viewSession?.quotes)
                )}
              </div>
            )}
          </div>

          {/* RIGHT: GM-only zone */}
          {isGM && (
            <div className="space-y-4">
              {/* Off-screen events / GM notes / secrets */}
              <div className="bg-white/5 rounded-xl border border-purple-500/40 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-purple-200 mb-2">
                  Off-screen events & GM notes
                </h2>
                {isGM && editMode ? (
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-purple-200 mb-1">
                      GM notes
                    </label>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={editableSession?.gmNotes ?? ""}
                      onChange={(e) => handleFieldChange("gmNotes", e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-purple-200 mb-1">
                      GM notes
                    </p>
                    {renderMarkdownBlock(viewSession.gmNotes, "No GM notes yet.")}
                  </div>
                )}
                {isGM && editMode ? (
                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Secrets &amp; twists
                    </label>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={editableSession?.gmSecrets ?? ""}
                      onChange={(e) => handleFieldChange("gmSecrets", e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Secrets &amp; twists
                    </p>
                    {renderMarkdownBlock(viewSession.gmSecrets, "No secrets or twists yet.")}
                  </div>
                )}
                {isGM && editMode ? (
                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Prep notes
                    </label>
                    <textarea
                      className="w-full bg-transparent border border-purple-500/25 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-400/80"
                      rows={3}
                      value={gmPrepText}
                      onChange={(e) => setGmPrepText(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-purple-200 mb-1">
                      Prep notes
                    </p>
                    {renderMarkdownBlock(
                      Array.isArray(viewSession.gmPrep) ? viewSession.gmPrep.join("\n") : "",
                      "No prep notes yet."
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
	        </div>
	        </fieldset>

	        {/* Metadata strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-sm text-zinc-400 pt-2">
          <div className="flex items-center gap-3">
            <MapIcon className="w-4 h-4 text-zinc-500" />
            <span>Location: {viewSession?.map || ""}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-zinc-500" />
            <span>
              Status: {viewSession?.status || "—"} • Visibility: {isGmOnlyCurrent ? "GM-only" : "Player-visible"}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
