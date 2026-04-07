import React, { useEffect, useMemo, useState } from "react";
import { useMode } from "../context/ModeContext.jsx";
import { useCampaign } from "../context/CampaignContext";
import { Search, Plus } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { createLink } from "../domain/links/link.service";
import { addLink, getLinksForEntity, removeLink } from "../data/links/links.repo";
import { itemsRepo } from "../data/items/items.repo";
import { bagRepo } from "../data/bag/bag.repo";

export default function BagOfHolding() {
  const { isGM } = useMode();
  const { selectedCampaignId } = useCampaign();
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
  const [bagState, setBagState] = useState({ currency: {}, looseItems: [], linkedEntries: [] });
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const currency = bagState?.currency || {};
  const looseItems = Array.isArray(bagState?.looseItems) ? bagState.looseItems : [];
  const linkedEntries = Array.isArray(bagState?.linkedEntries) ? bagState.linkedEntries : [];
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

  const applyPendingCurrency = async (mode = "add") => {
    if (!hasPendingDelta) return;

    setCurrencyError("");

    if (mode === "spend" && pendingDeltaTotalGp > currencyTotals.totalGp) {
      setCurrencyError(
        `Not enough funds in treasury. You tried to spend ${gpFmt(
          pendingDeltaTotalGp
        )} gp, but only ${gpFmt(currencyTotals.totalGp)} gp is available.`
      );
      return;
    }

    const next = bagRepo.applyCurrencyDelta(bagState, pendingDelta, mode);
    await persistBag(next);

    setPendingCurrency({ gp: "", sp: "", cp: "", ep: "", pp: "" });
    setCurrencyError("");
  };
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [rerenderTick, setRerenderTick] = useState(0);
  const [pendingRemovalAction, setPendingRemovalAction] = useState(null);
  const [currencyError, setCurrencyError] = useState("");

  useEffect(() => {
    if (!selectedCampaignId) {
      setBagState({ currency: {}, looseItems: [], linkedEntries: [] });
      setAllItems([]);
      setCurrencyError("");
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [bagData, itemData] = await Promise.all([
          Promise.resolve(bagRepo.get(selectedCampaignId)),
          Promise.resolve(itemsRepo.getAll(selectedCampaignId)),
        ]);

        setBagState({
          currency: bagData?.currency || {},
          looseItems: Array.isArray(bagData?.looseItems) ? bagData.looseItems : [],
          linkedEntries: Array.isArray(bagData?.linkedEntries) ? bagData.linkedEntries : [],
        });
        setAllItems(Array.isArray(itemData) ? itemData : []);
        setCurrencyError("");
      } catch (error) {
        console.error("[BagOfHolding] Failed to load bag data", error);
        setBagState({ currency: {}, looseItems: [], linkedEntries: [] });
        setAllItems([]);
        setCurrencyError("");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCampaignId, rerenderTick]);

  const itemsById = useMemo(() => {
    return new Map((Array.isArray(allItems) ? allItems : []).map((it) => [String(it.id), it]));
  }, [allItems]);

  const [form, setForm] = useState({
    name: "",
    qty: 1,
    worth: "",
    type: "Other",
  });

  const bagId = selectedCampaignId ? `bag:${selectedCampaignId}` : "bag:none";

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
    return linkedEntries
      .map((entry) => {
        const item = itemsById.get(String(entry.itemId));
        if (!item) {
          return {
            entry,
            item: null,
            displayName: `Unknown item`,
            displayType: "Other",
            displayRarity: null,
            isMissingItem: true,
          };
        }

        if (!isGM && item?.visibility === "gm-only") return null;

        return {
          entry,
          item,
          displayName: item?.name || "Unknown item",
          displayType: item?.type || "Other",
          displayRarity: item?.rarity || null,
          isMissingItem: false,
        };
      })
      .filter(Boolean)
      .filter(({ entry, displayName, displayType }) => {
        const matchesSearch = !s || String(displayName || "").toLowerCase().includes(s);
        const matchesType = type === "All" || displayType === type;
        return matchesSearch && matchesType && Number(entry?.quantity) > 0;
      });
  }, [linkedEntries, itemsById, isGM, search, type]);

  const totals = useMemo(() => {
    const looseQty = filteredLoose.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const looseWorth = filteredLoose.reduce(
      (acc, it) => acc + (Number(it.worth) || 0) * (Number(it.qty) || 1),
      0
    );

    const linkedQty = filteredLinked.reduce((acc, { entry }) => acc + (Number(entry?.quantity) || 0), 0);
    // Linked items do not carry independent worth yet; worth stays on loose entries for now.

    const totalQty = looseQty + linkedQty;
    const totalWorth = looseWorth;
    return { totalQty, totalWorth };
  }, [filteredLoose, filteredLinked]);

  const counts = useMemo(() => {
    const linkedCount = filteredLinked.reduce((acc, { entry }) => acc + (Number(entry?.quantity) || 0), 0);
    const looseCount = filteredLoose.reduce((acc, it) => acc + (Number(it?.qty) || 0), 0);

    return {
      linked: linkedCount,
      loose: looseCount,
      total: linkedCount + looseCount,
    };
  }, [filteredLinked, filteredLoose]);

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

  const pendingDeltaTotalGp = useMemo(() => {
    const gp = Number(pendingDelta?.gp) || 0;
    const sp = Number(pendingDelta?.sp) || 0;
    const cp = Number(pendingDelta?.cp) || 0;
    const pp = Number(pendingDelta?.pp) || 0;
    const ep = Number(pendingDelta?.ep) || 0;

    return gp + sp * 0.1 + cp * 0.01 + pp * 10 + ep * 0.5;
  }, [pendingDelta]);

  const gpFmt = (n) => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const canAdd = true; // requirement: players can add

  async function persistBag(next) {
    setBagState(next);
    if (!selectedCampaignId) return;
    if (typeof bagRepo.save === "function") {
      await Promise.resolve(bagRepo.save(selectedCampaignId, next));
    }
  }

  async function refreshItems() {
    if (!selectedCampaignId) {
      setAllItems([]);
      return;
    }
    try {
      const data = await Promise.resolve(itemsRepo.getAll(selectedCampaignId));
      setAllItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("[BagOfHolding] Failed to refresh items", error);
      setAllItems([]);
    }
  }

  const onSubmit = async (e) => {
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

    const next = bagRepo.addLooseItem(bagState, newItem);
    await persistBag(next);
    setShowModal(false);
    setForm({ name: "", qty: 1, worth: "", type: "Other" });
  };

  const linkCandidates = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    const linkedIds = new Set(linkedEntries.map((entry) => String(entry.itemId)));

    return (Array.isArray(allItems) ? allItems : [])
      .filter((it) => it?.id)
      .filter((it) => isGM || it?.visibility !== "gm-only")
      .filter((it) => !linkedIds.has(String(it.id)))
      .filter((it) => (!q ? true : String(it.name || "").toLowerCase().includes(q)))
      .slice(0, 30);
  }, [linkQuery, allItems, linkedEntries, isGM]);

  async function addLinkedItem(itemId) {
    const normalizedItemId = String(itemId);
    const existingLink = getLinksForEntity("BagOfHolding", bagId, "Player").find((linkObj) => {
      if (linkObj?.label !== "contained_in") return false;
      const other = linkObj.entityA.type === "BagOfHolding" ? linkObj.entityB : linkObj.entityA;
      return String(other?.id) === normalizedItemId;
    });

    if (!existingLink) {
      const linkObj = createLink({
        entityA: { type: "BagOfHolding", id: bagId },
        entityB: { type: "Item", id: normalizedItemId },
        label: "contained_in",
        visibility: "Player",
      });
      addLink(linkObj);
    }

    const next = bagRepo.addLinkedItem(bagState, normalizedItemId, {
      sourceType: "linked",
      addedBy: isGM ? "gm" : "player",
    });
    await persistBag(next);
    await refreshItems();
    setShowLinkModal(false);
    setLinkQuery("");
    setRerenderTick((v) => v + 1);
    setPendingRemovalAction(null);
  }

  async function removeLinkedItem(entryId, itemId) {
    const next = bagRepo.removeLinkedItem(bagState, entryId);
    await persistBag(next);

    const stillExists = next.linkedEntries.some((entry) => String(entry.itemId) === String(itemId));
    if (!stillExists) {
      const matchingLinks = getLinksForEntity("BagOfHolding", bagId, "Player").filter((linkObj) => {
        if (linkObj?.label !== "contained_in") return false;
        const other = linkObj.entityA.type === "BagOfHolding" ? linkObj.entityB : linkObj.entityA;
        return String(other?.id) === String(itemId);
      });
      matchingLinks.forEach((linkObj) => removeLink(linkObj.id));
    }

    await refreshItems();
    setLinkQuery("");
    setRerenderTick((v) => v + 1);
  }

  async function incrementLinkedItem(entryId) {
    const entry = linkedEntries.find((it) => String(it.id) === String(entryId));
    if (!entry) return;

    const next = bagRepo.updateLinkedItemQuantity(
      bagState,
      entryId,
      (Number(entry.quantity) || 0) + 1
    );
    await persistBag(next);
  }

  async function decrementLinkedItem(entryId, itemId) {
    const entry = linkedEntries.find((it) => String(it.id) === String(entryId));
    if (!entry) return;

    const nextQuantity = (Number(entry.quantity) || 0) - 1;
    if (nextQuantity <= 0) {
      await removeLinkedItem(entryId, itemId);
      return;
    }

    const next = bagRepo.updateLinkedItemQuantity(bagState, entryId, nextQuantity);
    await persistBag(next);
  }

  async function confirmRemoveLooseItem() {
    if (!pendingRemovalAction?.itemId) return;

    const next = bagRepo.removeLooseItem(bagState, pendingRemovalAction.itemId);
    await persistBag(next);
    setPendingRemovalAction(null);
  }

  async function confirmSellLooseItem() {
    if (!pendingRemovalAction?.itemId) return;

    const next = bagRepo.sellLooseItem(bagState, pendingRemovalAction.itemId);
    await persistBag(next);
    setPendingRemovalAction(null);
  }

  function updatePendingRemovalValue(value) {
    setPendingRemovalAction((current) => {
      if (!current) return current;
      return {
        ...current,
        manualSaleValue: value,
      };
    });
  }

  async function confirmSellLinkedItem() {
    if (!pendingRemovalAction?.entryId) return;

    const saleValue = Math.max(0, Number(pendingRemovalAction.manualSaleValue) || 0);
    const afterRemove = bagRepo.removeLinkedItem(bagState, pendingRemovalAction.entryId);
    const next = bagRepo.applyCurrencyDelta(
      afterRemove,
      { gp: saleValue, sp: 0, cp: 0, ep: 0, pp: 0 },
      "add"
    );

    await persistBag(next);

    const stillExists = next.linkedEntries.some(
      (entry) => String(entry.itemId) === String(pendingRemovalAction.itemId)
    );
    if (!stillExists) {
      const matchingLinks = getLinksForEntity("BagOfHolding", bagId, "Player").filter((linkObj) => {
        if (linkObj?.label !== "contained_in") return false;
        const other = linkObj.entityA.type === "BagOfHolding" ? linkObj.entityB : linkObj.entityA;
        return String(other?.id) === String(pendingRemovalAction.itemId);
      });
      matchingLinks.forEach((linkObj) => removeLink(linkObj.id));
    }

    await refreshItems();
    setLinkQuery("");
    setRerenderTick((v) => v + 1);
    setPendingRemovalAction(null);
  }

  if (!selectedCampaignId) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Select a campaign to view the Bag of Holding.</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="text-zinc-400">Loading Bag of Holding...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto">
      {/* Subsection nav */}
      <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto whitespace-nowrap pr-1 [-webkit-overflow-scrolling:touch]">
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
      <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party inventory..."
            className="w-full pl-11 pr-3 py-2.5 sm:pl-12 sm:pr-4 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pr-1 pb-1 [-webkit-overflow-scrolling:touch]">
          {bagTypes.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`shrink-0 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl font-medium transition-all ${type === t
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {canAdd && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              onClick={() => setShowModal(true)}
            >
              <Plus className="w-5 h-5" />
              Add loose item
            </button>
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 bg-white/5 border border-white/10 text-zinc-200 font-medium rounded-xl hover:bg-white/10 transition-colors"
              onClick={() => setShowLinkModal(true)}
            >
              + Link existing item
            </button>
          </div>
        )}
      </div>

      {/* Treasury + Party Totals */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Treasury */}
        <div className="xl:col-span-2 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
            <div>
              <div className="text-sm font-semibold text-white">Treasury</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                gp base • sp=0.1gp • cp=0.01gp • ep=0.5gp • pp=10gp
              </div>
            </div>

            <div className="w-full sm:w-auto px-3 py-2 rounded-xl bg-black/20 border border-white/10 text-sm text-zinc-300">
              Total: <span className="text-white font-semibold">{gpFmt(currencyTotals.totalGp)} gp</span>
            </div>
          </div>

          {/* Current holdings */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold text-white">Add currency</div>
                <div className="text-xs text-zinc-500 mt-0.5">Enter what you’re adding, click Add. Inputs clear automatically.</div>
              </div>
              {currencyError ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {currencyError}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={!hasPendingDelta}
                  onClick={() => applyPendingCurrency("spend")}
                  className={`w-full px-4 py-2.5 rounded-xl border border-white/10 font-medium transition-colors ${hasPendingDelta
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
                  className={`w-full px-4 py-2.5 rounded-xl font-medium transition-opacity ${hasPendingDelta
                    ? "bg-linear-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90"
                    : "bg-white/5 text-zinc-500 cursor-not-allowed"
                    }`}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
                    onChange={(e) => {
                      setPendingCurrency((p) => ({ ...p, [key]: e.target.value }));
                      if (currencyError) setCurrencyError("");
                    }}
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
        <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-sm text-zinc-300 xl:self-start">
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
      <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
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
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:max-w-xl mx-auto">
                <button
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                  onClick={() => setShowModal(true)}
                >
                  <Plus className="w-5 h-5" />
                  Add loose item
                </button>
                <button
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-zinc-200 font-medium rounded-xl hover:bg-white/10 transition-colors"
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
            {filteredLinked.map(({ entry, item, displayName, displayType, displayRarity, isMissingItem }) => (
              <div
                key={entry.id}
                className={`group rounded-2xl bg-black/20 border border-white/10 p-3 sm:p-4 transition hover:bg-white/5 hover:border-white/20 border-l-4 min-h-28 ${typeAccent(displayType || "Other")}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 border border-indigo-400/40">
                        🔗 Linked
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950/40 text-zinc-300 border border-white/10">
                        {displayType || "Other"}
                      </span>
                    </div>

                    {item ? (
                      <div
                        role="button"
                        onClick={() => navigate(`/items/${item.id}`)}
                        className="mt-2 text-white font-semibold wrap-break-word leading-snug cursor-pointer hover:underline"
                        title={displayName}
                      >
                        {displayName}
                      </div>
                    ) : (
                      <div
                        className="mt-2 text-white font-semibold wrap-break-word leading-snug"
                        title={displayName}
                      >
                        {displayName}
                      </div>
                    )}

                    {displayRarity ? (
                      <div className="text-xs text-zinc-400 mt-1">{displayRarity}</div>
                    ) : null}

                    {isMissingItem ? (
                      <div className="mt-1 text-xs text-amber-300">
                        Source item could not be resolved. Item ID: <span className="text-amber-200">{entry.itemId}</span>
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="text-[11px] text-red-300 hover:text-red-200 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setPendingRemovalAction({
                        kind: "linked",
                        entryId: entry.id,
                        itemId: item?.id || entry.itemId,
                        name: displayName,
                        qty: Math.max(1, Number(entry.quantity) || 1),
                        manualSaleValue: "",
                      });
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decrementLinkedItem(entry.id, item?.id || entry.itemId)}
                      className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                      aria-label={`Decrease quantity of ${displayName}`}
                    >
                      −
                    </button>
                    <span>Qty: <span className="text-zinc-200">{Number(entry.quantity) || 1}</span></span>
                    <button
                      type="button"
                      onClick={() => incrementLinkedItem(entry.id)}
                      className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                      aria-label={`Increase quantity of ${displayName}`}
                    >
                      +
                    </button>
                  </div>
                  <span>Worth: —</span>
                </div>
              </div>
            ))}

            {/* Loose items */}
            {filteredLoose.map((it) => (
              <div
                key={it.id}
                className={`group rounded-2xl bg-black/20 border border-white/10 p-3 sm:p-4 transition hover:bg-white/5 hover:border-white/20 border-l-4 min-h-28 ${typeAccent(it.type)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40">
                        🧾 Loose
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950/40 text-zinc-300 border border-white/10">
                        {it.type || "Other"}
                      </span>
                    </div>

                    <div className="mt-2 text-white font-semibold wrap-break-word leading-snug" title={it.name}>
                      {it.name}
                    </div>

                    <div className="text-xs text-zinc-500 mt-1">
                      Added by: {it.addedBy || "—"}
                    </div>
                  </div>

                  <button
                    className="text-[11px] text-red-300 hover:text-red-200 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setPendingRemovalAction({
                        kind: "loose",
                        itemId: it.id,
                        name: it.name,
                        qty: Math.max(1, Number(it.qty) || 1),
                        worth: Math.max(0, Number(it.worth) || 0),
                        totalWorth:
                          Math.max(1, Number(it.qty) || 1) *
                          Math.max(0, Number(it.worth) || 0),
                      });
                    }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-auto">
          <div className="w-[92vw] max-w-lg max-h-[85vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Add to Bag of Holding</h2>

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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-auto">
          <div className="w-[92vw] max-w-lg max-h-[85vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Link existing Item</h2>
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
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    {it.name}
                    <span className="ml-2 text-xs text-zinc-500">({it.type || "Other"})</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkQuery("");
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove / sell item modal */}
      {pendingRemovalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-auto">
          <div className="w-[92vw] max-w-md bg-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Remove item</h2>
            <p className="text-sm text-zinc-400 mb-4">
              What happened to <span className="text-white font-medium">{pendingRemovalAction.name}</span>?
            </p>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-4 text-sm text-zinc-300 space-y-1">
              <div>
                Qty: <span className="text-white">{pendingRemovalAction.qty}</span>
              </div>

              {pendingRemovalAction.kind === "loose" ? (
                <>
                  <div>
                    Worth each: <span className="text-white">{gpFmt(pendingRemovalAction.worth)} gp</span>
                  </div>
                  <div>
                    Total sale value: <span className="text-white">{gpFmt(pendingRemovalAction.totalWorth)} gp</span>
                  </div>
                </>
              ) : (
                <div>
                  Enter agreed sale value: <span className="text-white">manual gp input</span>
                </div>
              )}
            </div>

            {pendingRemovalAction.kind === "linked" ? (
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-1">Sale value (gp)</label>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={pendingRemovalAction.manualSaleValue}
                  onChange={(e) => updatePendingRemovalValue(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  placeholder="0"
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={pendingRemovalAction.kind === "loose" ? confirmRemoveLooseItem : async () => {
                  await removeLinkedItem(
                    pendingRemovalAction.entryId,
                    pendingRemovalAction.itemId
                  );
                  setPendingRemovalAction(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 transition-colors"
              >
                Remove only
              </button>

              <button
                type="button"
                onClick={pendingRemovalAction.kind === "loose" ? confirmSellLooseItem : confirmSellLinkedItem}
                className="w-full px-4 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 transition-opacity"
              >
                {pendingRemovalAction.kind === "loose"
                  ? `Sell for ${gpFmt(pendingRemovalAction.totalWorth)} gp`
                  : `Sell for ${gpFmt(pendingRemovalAction.manualSaleValue)} gp`}
              </button>

              <button
                type="button"
                onClick={() => setPendingRemovalAction(null)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}