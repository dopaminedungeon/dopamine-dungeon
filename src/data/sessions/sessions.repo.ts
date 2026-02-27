import { readJson, writeJson } from "../storage/storage";
import { storageKeys } from "../storage/storageKeys";

// v0.1 canonical session shape (UI-friendly, Firebase-ready later)
export type SessionVisibility = "public" | "gm-only";

export type Session = {
  id: string;

  // Player-facing identity
  sessionNumber?: number;
  name: string;
  date?: string; // ISO

  // Player-facing content
  summary?: string; // markdown/text
  timeline?: string;
  moments?: string;
  quotes?: string;

  // Visibility guard
  visibility?: SessionVisibility;

  // Optional metadata (safe)
  status?: "scheduled" | "active" | "paused" | "completed";
  map?: string;
  players?: number;
  maxPlayers?: number;
  startTime?: string;
  duration?: string;
  progress?: number;

  // GM-only (must be hidden in Player mode)
  gmNotes?: string;
  gmSecrets?: string;
  gmPrep?: string[];
};

const EMPTY: Session[] = [];

// Normalizes legacy/older session shapes into the v0.1 canonical shape.
// This keeps previously stored data working without forcing a manual migration.
const normalizeSession = (raw: any): Session | null => {
  if (!raw) return null;

  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  // Legacy field aliases
  const sessionNumber =
    raw.sessionNumber != null
      ? Number(raw.sessionNumber)
      : raw.number != null
      ? Number(raw.number)
      : undefined;

  const name =
    (raw.name ?? raw.title ?? "").toString().trim() || `Session ${sessionNumber ?? ""}`.trim();

  const summary =
    raw.summary != null
      ? String(raw.summary)
      : raw.playerSummary != null
      ? String(raw.playerSummary)
      : raw.notes != null
      ? String(raw.notes)
      : undefined;

  // Visibility: accept multiple legacy conventions
  const visibility: SessionVisibility | undefined =
    raw.visibility === "gm-only" || raw.visibility === "GM" || raw.visibility === "gm"
      ? "gm-only"
      : raw.visibility === "public" || raw.visibility === "Player" || raw.visibility === "player"
      ? "public"
      : raw.isPublic === true
      ? "public"
      : raw.isPublic === false
      ? "gm-only"
      : raw.gmOnly === true
      ? "gm-only"
      : undefined;

  const date = raw.date != null ? String(raw.date) : undefined;

  const timeline = raw.timeline != null ? String(raw.timeline) : undefined;
  const moments = raw.moments != null ? String(raw.moments) : undefined;
  const quotes = raw.quotes != null ? String(raw.quotes) : undefined;

  const status = raw.status != null ? String(raw.status) : undefined;
  const map = raw.map != null ? String(raw.map) : undefined;

  const players = raw.players != null ? Number(raw.players) : undefined;
  const maxPlayers = raw.maxPlayers != null ? Number(raw.maxPlayers) : undefined;
  const startTime = raw.startTime != null ? String(raw.startTime) : undefined;
  const duration = raw.duration != null ? String(raw.duration) : undefined;
  const progress = raw.progress != null ? Number(raw.progress) : undefined;

  const gmNotes = raw.gmNotes != null ? String(raw.gmNotes) : undefined;
  const gmSecrets = raw.gmSecrets != null ? String(raw.gmSecrets) : undefined;
  const gmPrep = Array.isArray(raw.gmPrep) ? raw.gmPrep.map((x: any) => String(x)) : undefined;

  return {
    id,
    sessionNumber: Number.isFinite(sessionNumber) ? sessionNumber : undefined,
    name,
    date,
    summary,
    timeline,
    moments,
    quotes,
    visibility,
    status: status as any,
    map,
    players: Number.isFinite(players) ? players : undefined,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : undefined,
    startTime,
    duration,
    progress: Number.isFinite(progress) ? progress : undefined,
    gmNotes,
    gmSecrets,
    gmPrep,
  };
};

const normalizeList = (raw: any): Session[] => {
  const arr = Array.isArray(raw) ? raw : [];
  const normalized = arr
    .map(normalizeSession)
    .filter(Boolean) as Session[];

  // Stable ordering: by sessionNumber asc (if present), otherwise by name, then id.
  normalized.sort((a, b) => {
    const an = a.sessionNumber;
    const bn = b.sessionNumber;
    if (Number.isFinite(an) && Number.isFinite(bn)) return (an as number) - (bn as number);
    if (Number.isFinite(an)) return -1;
    if (Number.isFinite(bn)) return 1;
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  return normalized;
};

export const sessionsRepo = {
  getAll(): Session[] {
    const raw = readJson(storageKeys.sessions, EMPTY as any);
    return normalizeList(raw);
  },

  getById(id: string): Session | null {
    const needle = String(id);
    return sessionsRepo.getAll().find((s) => String(s.id) === needle) ?? null;
  },

  upsert(session: Session) {
    const normalized = normalizeSession(session);
    if (!normalized) return;

    const all = sessionsRepo.getAll();
    const idx = all.findIndex((s) => s.id === normalized.id);
    const next =
      idx >= 0
        ? all.map((s) => (s.id === normalized.id ? normalized : s))
        : [normalized, ...all];

    writeJson(storageKeys.sessions, normalizeList(next));
  },

  remove(id: string) {
    const needle = String(id);
    writeJson(
      storageKeys.sessions,
      sessionsRepo.getAll().filter((s) => String(s.id) !== needle)
    );
  },
};