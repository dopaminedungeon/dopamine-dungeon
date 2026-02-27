import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMode } from "../context/ModeContext.jsx";
import { ArrowLeft, Swords, Shield, Sparkles } from "lucide-react";
import { itemsRepo } from "../data/items/items.repo";
import { sessionsRepo } from "../data/sessions/sessions.repo";
import { getLinksForEntity } from "../data/links/links.repo";


const rarityColors = {
  Legendary: "from-amber-500 to-orange-600",
  Epic: "from-purple-500 to-violet-600",
  Rare: "from-blue-500 to-cyan-600",
  Uncommon: "from-emerald-500 to-green-600",
  Common: "from-zinc-500 to-zinc-600",
};

const typeIcons = {
  Weapon: Swords,
  Armor: Shield,
  Consumable: Sparkles,
};
const formatSigned = (value) => {
  const n = Number(value) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
};

export default function ItemProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();

  const [items, setItems] = useState(() => itemsRepo.getAll());

  const rawItem = useMemo(
    () => items.find((it) => String(it.id) === String(id)) || null,
    [items, id]
  );

  const [formData, setFormData] = useState(rawItem || null);

  useEffect(() => {
    // refresh when navigating between items
    setItems(itemsRepo.getAll());
  }, [id]);

  useEffect(() => {
    setFormData(rawItem || null);
  }, [rawItem]);
  const [isEditing, setIsEditing] = useState(false);

  if (!formData) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-3xl font-bold">Item Not Found</h1>
        <p className="mt-2 text-zinc-400">There is no item with this ID.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
        >
          Go Back
        </button>
      </div>
    );
  }

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStatChange = (statKey, value) => {
    setFormData(prev => ({
      ...prev,
      stats: {
        ...(prev.stats || {}),
        [statKey]: Number.isNaN(Number(value)) ? (prev.stats || {})[statKey] : Number(value),
      },
    }));
  };

  const handleVisibilityChange = (visibility) => {
    setFormData(prev => ({ ...prev, visibility }));
  };
  const sessionsById = useMemo(() => {
    const all = sessionsRepo.getAll();
    return new Map(all.map((s) => [String(s.id), s]));
  }, []);

  const rarityBg = rarityColors[formData.rarity] || rarityColors.Common;
  const Icon = typeIcons[formData.type] || Sparkles;
  const visibility = formData.visibility || "public";

  // v0.1 cross-link panels
  const itemLinks = getLinksForEntity("Item", String(id), isGM ? "GM" : "Player");
  const linkedSessions = itemLinks
    .filter((l) => l.entityA.type === "Session" || l.entityB.type === "Session")
    .map((l) => {
      const other = l.entityA.type === "Item" ? l.entityB : l.entityA;
      return { sessionId: other.id, label: l.label, visibility: l.visibility, linkId: l.id };
    });
  const inBag = itemLinks.some((l) => {
    const hasBag = l.entityA.type === "BagOfHolding" || l.entityB.type === "BagOfHolding";
    return hasBag && l.label === "contained_in";
  });

  // Hard gate: players should not be able to open GM-only items via direct URL.
  if (!isGM && visibility === "gm-only") {
    return (
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">DM Eyes Only</h1>
          <p className="text-zinc-400 text-sm mb-4">
            This item is marked GM-only. Players don’t get to see it until it’s discovered at the table. 💜
          </p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={() => navigate("/items")}
          >
            Back to Items
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Page title (since TopBar is now provided by AppLayout) */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
          {formData.name}
        </h1>
        <p className="mt-1 text-xs md:text-sm text-zinc-400">
          {formData.type} • <span className="font-medium">{formData.rarity}</span>
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <button
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
          onClick={() => navigate("/items")}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Items
        </button>
        {isGM && (
          <button
            onClick={() => {
              if (isEditing && formData) {
                itemsRepo.upsert(formData);
                setItems(itemsRepo.getAll());
              }
              setIsEditing((prev) => !prev);
            }}
            className="px-4 py-2 rounded-xl bg-white/10 text-zinc-200 hover:bg-white/20 text-sm font-medium"
          >
            {isEditing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {/* Header / identity */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-20 h-20 rounded-2xl bg-linear-to-br ${rarityBg} flex items-center justify-center text-white`}
            >
              <Icon className="w-10 h-10" />
            </div>
            <div>
              {isEditing && isGM ? (
                <input
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-2xl font-bold text-white"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold text-white">{formData.name}</h2>
                  {isGM && visibility === "gm-only" && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/40 uppercase tracking-wide">
                      GM ONLY
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-1">
                {isEditing && isGM ? (
                  <>
                    <select
                      className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                      value={formData.type}
                      onChange={(e) => handleFieldChange("type", e.target.value)}
                    >
                      <option value="Weapon">Weapon</option>
                      <option value="Armor">Armor</option>
                      <option value="Consumable">Consumable</option>
                    </select>
                    <select
                      className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-sm text-white"
                      value={formData.rarity}
                      onChange={(e) => handleFieldChange("rarity", e.target.value)}
                    >
                      <option value="Legendary">Legendary</option>
                      <option value="Epic">Epic</option>
                      <option value="Rare">Rare</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Common">Common</option>
                    </select>
                  </>
                ) : (
                  <p className="text-zinc-400 text-sm">
                    {formData.type} • <span className="font-medium">{formData.rarity}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Bonus</p>
              {isEditing && isGM ? (
                <input
                  type="number"
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xl font-bold text-white w-20"
                  value={formData.bonus}
                  onChange={(e) => handleFieldChange("bonus", Number(e.target.value))}
                />
              ) : (
                <p className="text-white text-xl font-bold">{formatSigned(formData.bonus)}</p>
              )}
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Attunement</p>
              {isEditing && isGM ? (
                <select
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white"
                  value={formData.attunement}
                  onChange={(e) => handleFieldChange("attunement", e.target.value)}
                >
                  <option value="Required">Required</option>
                  <option value="None">None</option>
                </select>
              ) : (
                <p className="text-white font-medium">{formData.attunement || "None"}</p>
              )}
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 px-4 py-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Visibility</p>
              {isEditing && isGM ? (
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("public")}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${visibility === "public"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                      : "bg-white/5 border-white/10 text-zinc-300"
                      }`}
                  >
                    Player-visible
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("gm-only")}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${visibility === "gm-only"
                      ? "bg-red-500/20 border-red-400 text-red-200"
                      : "bg-white/5 border-white/10 text-zinc-300"
                      }`}
                  >
                    GM only
                  </button>
                </div>
              ) : (
                <p className="text-white font-medium">
                  {visibility === "gm-only" ? "GM-only" : "Player-visible"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Player vs GM columns */}
      <div className={`grid grid-cols-1 gap-6 ${isGM ? "lg:grid-cols-2" : ""}`}>
        {/* Player-safe column */}
        <div className="space-y-4">
          {/* Description */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Item description</h2>
            {isEditing && isGM ? (
              <textarea
                className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-20"
                value={formData.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
              />
            ) : (
              <p className="text-zinc-400">{formData.description || ""}</p>
            )}
          </section>

          {/* Core stats */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-3">Core stats</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {isEditing && isGM ? (
                <>
                  <select
                    className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                    value={formData.type}
                    onChange={(e) => handleFieldChange("type", e.target.value)}
                  >
                    <option value="Weapon">Weapon</option>
                    <option value="Armor">Armor</option>
                    <option value="Consumable">Consumable</option>
                  </select>
                  <select
                    className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                    value={formData.rarity}
                    onChange={(e) => handleFieldChange("rarity", e.target.value)}
                  >
                    <option value="Legendary">Legendary</option>
                    <option value="Epic">Epic</option>
                    <option value="Rare">Rare</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Common">Common</option>
                  </select>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    Bonus {formatSigned(formData.bonus)}
                  </span>
                </>
              ) : (
                <>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    {formData.type}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    {formData.rarity}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-xs uppercase tracking-wide">
                    Bonus {formatSigned(formData.bonus)}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isEditing && isGM
                ? Object.entries(formData.stats || {}).map(([key, value]) => (
                  <span
                    key={key}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm"
                  >
                    <span>{key}:</span>
                    <input
                      type="number"
                      className="bg-transparent border border-white/20 rounded px-1 py-0.5 w-16 text-zinc-100"
                      value={value}
                      onChange={(e) => handleStatChange(key, e.target.value)}
                    />
                  </span>
                ))
                : Object.entries(formData.stats || {}).map(([key, value]) => (
                  <span
                    key={key}
                    className="px-3 py-1 rounded-lg bg-white/5 text-zinc-300 text-sm"
                  >
                    {key}: {value}
                  </span>
                ))}
            </div>
          </section>

          {/* Ownership & usage */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Ownership & usage</h2>
            <p className="text-zinc-400 text-sm mb-1 flex items-center gap-2">
              <span className="text-zinc-500">Current owner:</span>
              {isEditing && isGM ? (
                <input
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white font-medium"
                  value={formData.owner}
                  onChange={(e) => handleFieldChange("owner", e.target.value)}
                />
              ) : (
                <span className="text-white font-medium">{formData.owner || "Unassigned"}</span>
              )}
            </p>
            <p className="text-zinc-400 text-sm mb-1 flex items-center gap-2">
              <span className="text-zinc-500">Typical location:</span>
              {isEditing && isGM ? (
                <input
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-white/90"
                  value={formData.location}
                  onChange={(e) => handleFieldChange("location", e.target.value)}
                />
              ) : (
                <span className="text-white/90">{formData.location || "—"}</span>
              )}
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              Later this card will auto-link to PCs, sessions and maps that reference this item.
            </p>
          </section>

          {/* v0.1: cross-links */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Where it showed up</h2>
            {linkedSessions.length === 0 ? (
              <p className="text-zinc-400 text-sm">No sessions linked yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedSessions.map((s) => {
                  const session = sessionsById.get(String(s.sessionId));
                  const title = session?.name || `Session ${s.sessionId}`;
                  return (
                    <button
                      key={s.linkId}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                      onClick={() => navigate(`/sessions/${s.sessionId}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-white font-medium text-sm">{title}</div>
                          <div className="text-xs text-zinc-500">label: {s.label}</div>
                        </div>
                        {isGM && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${s.visibility === "GM"
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              }`}
                          >
                            {s.visibility}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-2">Bag of Holding</h2>
            <p className="text-sm text-zinc-400">
              Status: {inBag ? <span className="text-emerald-300 font-medium">in party inventory</span> : <span className="text-zinc-400">not in bag</span>}
            </p>
          </section>
        </div>

        {/* GM-only column */}
        {isGM && (
          <div className="space-y-4">
            <section className="bg-white/5 border border-purple-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Hidden properties (GM only)</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.hiddenEffects}
                  onChange={(e) => handleFieldChange("hiddenEffects", e.target.value)}
                />
              ) : (
                <p className="text-zinc-400">
                  {formData.hiddenEffects ||
                    "Space for secret mechanics, extra damage riders, or conditional bonuses the players haven't discovered yet."}
                </p>
              )}
            </section>

            <section className="bg-white/5 border border-red-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Curses & drawbacks</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.curse}
                  onChange={(e) => handleFieldChange("curse", e.target.value)}
                />
              ) : (
                <p className="text-zinc-400">
                  {formData.curse && formData.curse !== "—"
                    ? formData.curse
                    : "If this item has a curse or downside, park it here so you remember to actually use it at the table."}
                </p>
              )}
            </section>

            <section className="bg-white/5 border border-emerald-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Upgrade path / evolution</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.upgradePath}
                  onChange={(e) => handleFieldChange("upgradePath", e.target.value)}
                />
              ) : (
                <p className="text-zinc-400">
                  {formData.upgradePath ||
                    "Ideas for how this item can grow with the party: reforging, absorbing shards, unlocking attunement tiers, etc."}
                </p>
              )}
            </section>

            <section className="bg-white/5 border border-blue-500/30 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white mb-2">Story hooks & links</h2>
              {isEditing && isGM ? (
                <textarea
                  className="bg-transparent border border-white/20 rounded-lg px-2 py-1 text-zinc-200 w-full min-h-15"
                  value={formData.storyHooks}
                  onChange={(e) => handleFieldChange("storyHooks", e.target.value)}
                />
              ) : (
                <>
                  <p className="text-zinc-400 mb-2">
                    {formData.storyHooks ||
                      "Notes on which NPCs, factions, maps or future sessions this item is tied to."}
                  </p>
                  <p className="text-zinc-500 text-xs">Later this will connect to Sessions, NPCs and Maps automatically.</p>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}