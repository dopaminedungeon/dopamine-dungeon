import React, { useEffect, useMemo, useState } from "react";
import { useMode } from "../context/ModeContext.jsx";
import { Search, Plus } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { createLink } from "../domain/links/link.service";
import { addLink, getLinksForEntity, removeLink } from "../data/links/links.repo";
import { itemsRepo } from "../data/items/items.repo";
import { bagRepo } from "../data/bag/bag.repo";

function getActiveTenantId() {
  try {
    return localStorage.getItem("dd_activeTenantId") || "default";
  } catch {
    return "default";
  }
}

function getActiveCampaignId() {
  const tenantId = getActiveTenantId();
  try {
    return (
      localStorage.getItem(`dd_activeCampaignId:${tenantId}`) ||
      localStorage.getItem("dd_activeCampaignId") ||
      "default"
    );
  } catch {
    return "default";
  }
}

function bagStorageKey() {
  const tenantId = getActiveTenantId();
  const campaignId = getActiveCampaignId();
  return `dd_bag_v1:${tenantId}:${campaignId}`;
}

function getBagEntityId() {
  // Stable per-campaign bag entity.
  return `bag:${getActiveCampaignId()}`;
}

// v0.1: Bag is two things:
// 1) Linked Items (BagOfHolding ↔ Item links) -> enables cross-linking
// 2) Loose Items (ad-hoc entries) -> quick party inventory tracking
export default function BagOfHolding() {
  const { isGM } = useMode();
  const navigate = useNavigate();
  const hasPcs = useMemo(() => {
    try {
      const raw = localStorage.getItem("dd:pcs");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }, []);
  const bagTypes = ["All", "Weapon", "Armor", "Consumable", "Other"];

  const typeAccent = (t) => {
    switch (t) {
      case "Weapon":
        return "border-l-rose-400/70";
      case "Armor":
        return "border-l-sky-400/70";
      case "Consumable":
        return "border-l-emerald-400/70";
      default:
        return "border-l-zinc-500/50";
    }
  };

  const coinIcon = (key) => {
    switch (key) {
      case "gp":
        return "🟡";
      case "sp":
        return "⚪";
      case "cp":
        return "🟤";
      case "ep":
        return "🔵";
      case "pp":
        return "🟣";
      default:
        return "";
    }
  };
  const [bagState, setBagState] = useState(() => bagRepo.get());
  const currency = bagState.currency;
  const looseItems = bagState.looseItems;
  const [pendingCurrency, setPendingCurrency] = useState(() => ({ gp: "", sp: "", cp: "", ep: "", pp: "" }));

  const pendingDelta = useMemo(() => {
    return {
      gp: Number(pendingCurrency.gp) || 0,
      sp: Number(pendingCurrency.sp) || 0,
      cp: Number(pendingCurrency.cp) || 0,
      ep: Number(pendingCurrency.ep) || 0,
      pp: Number(pendingCurrency.pp) || 0,
    };
  }, [pendingCurrency]);

  const hasPendingDelta = useMemo(() => {
    return Object.values(pendingDelta).some((v) => v !== 0);
  }, [pendingDelta]);

  const applyPendingCurrency = (mode = "add") => {
    if (!hasPendingDelta) return;

    const next = bagRepo.applyCurrencyDelta(pendingDelta, mode);
    setBagState(next);

    // Clear the inputs
    setPendingCurrency({ gp: "", sp: "", cp: "", ep: "", pp: "" });
  };
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [rerenderTick, setRerenderTick] = useState(0);
  const [allItems, setAllItems] = useState(() => itemsRepo.getAll());

  useEffect(() => {
    // Refresh items list when opening the link modal or when links change
    setAllItems(itemsRepo.getAll());
  }, [showLinkModal, rerenderTick]);

  const itemsById = useMemo(() => {
    return new Map((Array.isArray(allItems) ? allItems : []).map((it) => [String(it.id), it]));
  }, [allItems]);

  const [form, setForm] = useState({
    name: "",
    qty: 1,
    worth: "",
    type: "Other",
  });

  const bagId = getBagEntityId();
  const visibilityMode = isGM ? "GM" : "Player";

  // GM sees both GM-only + Player-visible links.
  // Player sees only Player-visible links.
  const bagLinks = useMemo(() => {
    const gmLinks = getLinksForEntity("BagOfHolding", bagId, "GM");
    const playerLinks = getLinksForEntity("BagOfHolding", bagId, "Player");

    const merged = visibilityMode === "GM" ? [...gmLinks, ...playerLinks] : playerLinks;

    // de-dupe by id
    const byId = new Map();
    merged.forEach((l) => {
      if (l?.id) byId.set(String(l.id), l);
    });
    return Array.from(byId.values());
  }, [bagId, visibilityMode, rerenderTick]);

  const containedLinks = bagLinks.filter((l) => l.label === "contained_in");

  const linkedItems = useMemo(() => {
    return containedLinks
      .map((linkObj) => {
        const other =
          linkObj.entityA.type === "BagOfHolding" ? linkObj.entityB : linkObj.entityA;
        const item = itemsById.get(String(other.id));
        if (!item) return null;
        return { item, linkObj };
      })
      .filter(Boolean);
  }, [containedLinks, itemsById]);

  const filteredLoose = useMemo(() => {
    return looseItems.filter((it) => {
      const s = search.trim().toLowerCase();
      const matchesSearch = !s || String(it?.name || "").toLowerCase().includes(s);
      const matchesType = type === "All" || it.type === type;
      return matchesSearch && matchesType;
    });
  }, [looseItems, search, type]);

  const filteredLinked = useMemo(() => {
    const s = search.trim().toLowerCase();
    return linkedItems.filter(({ item }) => {
      const matchesSearch = !s || String(item?.name || "").toLowerCase().includes(s);
      const matchesType = type === "All" || item.type === type;
      return matchesSearch && matchesType;
    });
  }, [linkedItems, search, type]);

  const totals = useMemo(() => {
    const looseQty = filteredLoose.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const looseWorth = filteredLoose.reduce(
      (acc, it) => acc + (Number(it.worth) || 0) * (Number(it.qty) || 1),
      0
    );

    const linkedQty = filteredLinked.reduce((acc) => acc + 1, 0);
    // Linked items don't have qty/worth in this dataset yet, so just count them.

    const totalQty = looseQty + linkedQty;
    const totalWorth = looseWorth;
    return { totalQty, totalWorth };
  }, [filteredLoose, filteredLinked]);

  const counts = useMemo(() => {
    return {
      linked: filteredLinked.length,
      loose: filteredLoose.length,
      total: filteredLinked.length + filteredLoose.length,
    };
  }, [filteredLinked.length, filteredLoose.length]);

  const currencyTotals = useMemo(() => {
    const gp = Number(currency?.gp) || 0;
    const sp = Number(currency?.sp) || 0;
    const cp = Number(currency?.cp) || 0;
    const pp = Number(currency?.pp) || 0;
    const ep = Number(currency?.ep) || 0;

    // Conversions:
    // sp = 0.1 gp
    // cp = 0.01 gp
    // pp = 10 gp
    // ep = 5 sp = 0.5 gp
    const totalGp = gp + sp * 0.1 + cp * 0.01 + pp * 10 + ep * 0.5;
    return { gp, sp, cp, pp, ep, totalGp };
  }, [currency]);

  const gpFmt = (n) => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const canAdd = true; // requirement: players can add

  const onSubmit = (e) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) return;

    const newItem = {
      id: `boh-${crypto.randomUUID()}`,
      name,
      qty: Math.max(1, Number(form.qty) || 1),
      worth: form.worth === "" ? 0 : Math.max(0, Number(form.worth) || 0),
      type: form.type || "Other",
      addedBy: isGM ? "gm" : "player",
      createdAt: Date.now(),
    };

    const next = bagRepo.addLooseItem(newItem);
setBagState(next);
    setShowModal(false);
    setForm({ name: "", qty: 1, worth: "", type: "Other" });
  };

  const linkCandidates = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    const linkedIds = new Set(
      containedLinks.map((l) => {
        const other = l.entityA.type === "BagOfHolding" ? l.entityB : l.entityA;
        return other.id;
      })
    );

    return (Array.isArray(allItems) ? allItems : [])
      .filter((it) => it?.id)
      .filter((it) => !linkedIds.has(String(it.id)))
      .filter((it) => (!q ? true : String(it.name || "").toLowerCase().includes(q)))
      .slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkQuery, allItems, containedLinks]);

  function addLinkedItem(itemId) {
    const linkObj = createLink({
      entityA: { type: "BagOfHolding", id: bagId },
      entityB: { type: "Item", id: String(itemId) },
      label: "contained_in",
      visibility: "Player",
    });
    addLink(linkObj);
    setRerenderTick((v) => v + 1);
  }

  function removeLinkedItem(linkId) {
    removeLink(linkId);
    setRerenderTick((v) => v + 1);
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      {/* Subsection nav */}
      <div className="mb-4 flex items-center gap-2">
        {hasPcs ? (
          <NavLink
            to="/pcs"
            end
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-sm border transition-colors ${isActive
                ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
              }`
            }
          >
            Characters
          </NavLink>
        ) : null}

        <NavLink
          to="/pcs/bag"
          className={({ isActive }) =>
            `px-3 py-2 rounded-xl text-sm border transition-colors ${isActive
              ? "bg-indigo-500/20 border-indigo-400/50 text-white"
              : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
            }`
          }
        >
          Bag of Holding
        </NavLink>
      </div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party inventory..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {bagTypes.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${type === t
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {canAdd && (
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              onClick={() => setShowModal(true)}
            >
              <Plus className="w-5 h-5" />
              Add loose item
            </button>
            <button
              className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-zinc-200 font-medium rounded-xl hover:bg-white/10 transition-colors"
              onClick={() => setShowLinkModal(true)}
            >
              + Link existing item
            </button>
          </div>
        )}
      </div>

      {/* Treasury + Party Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Treasury */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-sm font-semibold text-white">Treasury</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                gp base • sp=0.1gp • cp=0.01gp • ep=0.5gp • pp=10gp
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-black/20 border border-white/10 text-sm text-zinc-300">
              Total: <span className="text-white font-semibold">{gpFmt(currencyTotals.totalGp)} gp</span>
            </div>
          </div>

          {/* Current holdings */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              ["gp", "Gold"],
              ["sp", "Silver"],
              ["cp", "Copper"],
              ["ep", "Electrum"],
              ["pp", "Platinum"],
            ]).map(([key, label]) => (
              <div
                key={key}
                className="bg-black/20 border border-white/10 rounded-xl p-3"
              >
                <div className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1">
                  <span aria-hidden="true">{coinIcon(key)}</span>
                  <span>{label} ({key})</span>
                </div>
                <div className="text-white font-semibold text-lg">{gpFmt(currency?.[key] ?? 0)}</div>
              </div>
            ))}
          </div>

          {/* Add to treasury */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold text-white">Add currency</div>
                <div className="text-xs text-zinc-500 mt-0.5">Enter what you’re adding, click Add. Inputs clear automatically.</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPendingDelta}
                  onClick={() => applyPendingCurrency("spend")}
                  className={`px-4 py-2 rounded-xl border border-white/10 font-medium transition-colors ${
                    hasPendingDelta
                      ? "bg-red-500/15 text-red-200 hover:bg-red-500/25"
                      : "bg-white/5 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  Spend
                </button>

                <button
                  type="button"
                  disabled={!hasPendingDelta}
                  onClick={() => applyPendingCurrency("add")}
                  className={`px-4 py-2 rounded-xl font-medium transition-opacity ${
                    hasPendingDelta
                      ? "bg-linear-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90"
                      : "bg-white/5 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {([
                ["gp", "Gold"],
                ["sp", "Silver"],
                ["cp", "Copper"],
                ["ep", "Electrum"],
                ["pp", "Platinum"],
              ]).map(([key, label]) => (
                <div key={key} className="bg-zinc-950/30 border border-white/10 rounded-xl p-3">
                  <div className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1">
                    <span aria-hidden="true">{coinIcon(key)}</span>
                    <span>+ {label} ({key})</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={pendingCurrency?.[key]}
                    onChange={(e) => setPendingCurrency((p) => ({ ...p, [key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyPendingCurrency("add");
                      }
                    }}
                    placeholder="0"
                    className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Party Totals */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-zinc-300">
          <div className="text-sm font-semibold text-white mb-3">Party Totals</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="px-3 py-2 rounded-xl bg-black/20 border border-white/10">
              Items <span className="text-white font-semibold">{counts.total}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/20 border border-white/10">
              Linked <span className="text-white font-semibold">{counts.linked}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/20 border border-white/10">
              Loose <span className="text-white font-semibold">{counts.loose}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-black/20 border border-white/10">
              Worth <span className="text-white font-semibold">{gpFmt(totals.totalWorth)} gp</span>
            </div>
          </div>

          <div className="text-xs text-zinc-500 mt-3">(Worth excludes currency.)</div>
        </div>
      </div>

      {/* Storage */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-semibold text-white">Storage</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Linked items are real cross-links (Bag ↔ Item). Loose items are quick entries.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-black/20 border border-white/10 text-zinc-300">
              Linked {counts.linked}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-black/20 border border-white/10 text-zinc-300">
              Loose {counts.loose}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-black/20 border border-white/10 text-zinc-300">
              Total {counts.total}
            </span>
          </div>
        </div>

        {/* Card grid */}
        {filteredLoose.length === 0 && filteredLinked.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <div className="text-white font-semibold">Your bag is empty</div>
            <div className="text-sm text-zinc-400 mt-1">
              Add a loose item or link an existing item to start tracking party inventory.
            </div>
            {canAdd ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                  onClick={() => setShowModal(true)}
                >
                  <Plus className="w-5 h-5" />
                  Add loose item
                </button>
                <button
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-zinc-200 font-medium rounded-xl hover:bg-white/10 transition-colors"
                  onClick={() => setShowLinkModal(true)}
                >
                  + Link existing item
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Linked items */}
            {filteredLinked.map(({ item, linkObj }) => (
              <div
                key={linkObj.id}
                className={`group rounded-2xl bg-black/20 border border-white/10 p-4 transition hover:bg-white/5 hover:border-white/20 border-l-4 ${typeAccent(item.type || "Other")}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 border border-indigo-400/40">
                        🔗 Linked
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950/40 text-zinc-300 border border-white/10">
                        {item.type || "Other"}
                      </span>
                    </div>

                    <div
                      role="button"
                      onClick={() => navigate(`/items/${item.id}`)}
                      className="mt-2 text-white font-semibold truncate cursor-pointer hover:underline"
                      title={item.name}
                    >
                      {item.name}
                    </div>

                    {item.rarity ? (
                      <div className="text-xs text-zinc-400 mt-1">{item.rarity}</div>
                    ) : null}
                  </div>

                  <button
                    className="text-[11px] text-red-300 hover:text-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeLinkedItem(linkObj.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                  <span>Qty: —</span>
                  <span>Worth: —</span>
                </div>
              </div>
            ))}

            {/* Loose items */}
            {filteredLoose.map((it) => (
              <div
                key={it.id}
                className={`group rounded-2xl bg-black/20 border border-white/10 p-4 transition hover:bg-white/5 hover:border-white/20 border-l-4 ${typeAccent(it.type)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40">
                        🧾 Loose
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950/40 text-zinc-300 border border-white/10">
                        {it.type || "Other"}
                      </span>
                    </div>

                    <div className="mt-2 text-white font-semibold truncate" title={it.name}>
                      {it.name}
                    </div>

                    <div className="text-xs text-zinc-500 mt-1">
                      Added by: {it.addedBy || "—"}
                    </div>
                  </div>

                  <button
                    className="text-[11px] text-red-300 hover:text-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setBagState(bagRepo.removeLooseItem(it.id))}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                  <span>Qty: <span className="text-zinc-200">{it.qty}</span></span>
                  <span>Worth: <span className="text-zinc-200">{gpFmt(it.worth)}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Add to Bag of Holding</h2>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Item</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={form.qty}
                    onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Worth (each)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.worth}
                    onChange={(e) => setForm((p) => ({ ...p, worth: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    {bagTypes.filter((t) => t !== "All").map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link existing Item modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">Link existing Item</h2>
            <p className="text-sm text-zinc-400 mb-4">
              This creates a real cross-link (Bag ↔ Item). It will show up later in the Item profile too.
            </p>

            <input
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Search items…"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white mb-3"
            />

            <div className="max-h-64 overflow-auto border border-white/10 rounded-xl">
              {linkCandidates.length === 0 ? (
                <div className="p-3 text-sm text-zinc-500">No results.</div>
              ) : (
                linkCandidates.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      addLinkedItem(it.id);
                      setShowLinkModal(false);
                      setLinkQuery("");
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    {it.name}
                    <span className="ml-2 text-xs text-zinc-500">({it.type || "Other"})</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkQuery("");
                }}
                className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}