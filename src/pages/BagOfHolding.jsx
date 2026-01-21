import React, { useMemo, useState } from "react";
import { useMode } from "../context/ModeContext.jsx";
import { Search, Plus } from "lucide-react";
import { mockBagOfHolding, bagTypes, mockPartyCurrency } from "../data/mockBagOfHolding.js";
import { NavLink } from "react-router-dom";

export default function BagOfHolding() {
  const { isGM } = useMode();

  const [items, setItems] = useState(() => (Array.isArray(mockBagOfHolding) ? mockBagOfHolding : []));
  const [currency, setCurrency] = useState(() => (
    mockPartyCurrency && typeof mockPartyCurrency === "object"
      ? { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0, ...mockPartyCurrency }
      : { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 }
  ));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name: "",
    qty: 1,
    worth: "",
    type: "Other",
  });

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const s = search.trim().toLowerCase();
      const matchesSearch = !s || String(it?.name || "").toLowerCase().includes(s);
      const matchesType = type === "All" || it.type === type;
      return matchesSearch && matchesType;
    });
  }, [items, search, type]);

  const totals = useMemo(() => {
    const totalQty = filtered.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const totalWorth = filtered.reduce(
      (acc, it) => acc + (Number(it.worth) || 0) * (Number(it.qty) || 1),
      0
    );
    return { totalQty, totalWorth };
  }, [filtered]);

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

  const setCoin = (key, value) => {
    setCurrency((prev) => ({
      ...prev,
      [key]: Math.max(0, Number(value) || 0),
    }));
  };

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

    setItems((prev) => [newItem, ...prev]);
    setShowModal(false);
    setForm({ name: "", qty: 1, worth: "", type: "Other" });
  };

  return (
    <main className="flex-1 p-8 overflow-auto">
      {/* Subsection nav */}
      <div className="mb-4 flex items-center gap-2">
        <NavLink
          to="/pcs"
          end
          className={({ isActive }) =>
            `px-3 py-2 rounded-xl text-sm border transition-colors ${
              isActive
                ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                : "bg-zinc-950/20 border-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-950/35"
            }`
          }
        >
          Characters
        </NavLink>

        <NavLink
          to="/pcs/bag"
          className={({ isActive }) =>
            `px-3 py-2 rounded-xl text-sm border transition-colors ${
              isActive
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
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                type === t
                  ? "bg-blue-500 text-white"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {canAdd && (
          <button
            className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        )}
      </div>

      {/* Currency + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Currency */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Party Currency</div>
              <div className="text-xs text-zinc-500">
                gp base • sp=0.1gp • cp=0.01gp • ep=0.5gp • pp=10gp
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-black/20 border border-white/10 text-sm text-zinc-300">
              Total: <span className="text-white font-semibold">{gpFmt(currencyTotals.totalGp)} gp</span>
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
              <div key={key} className="bg-black/20 border border-white/10 rounded-xl p-3">
                <div className="text-xs text-zinc-500 mb-1">{label} ({key})</div>
                <input
                  type="number"
                  min={0}
                  value={currency?.[key] ?? 0}
                  onChange={(e) => setCoin(key, e.target.value)}
                  className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Item totals */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-zinc-400">
          <div className="flex flex-col gap-2">
            <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
              Items: <span className="text-white font-semibold">{totals.totalQty}</span>
            </div>
            <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
              Total worth: <span className="text-white font-semibold">{totals.totalWorth}</span>
            </div>
            <div className="text-xs text-zinc-500">
              (Item totals exclude currency.)
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-zinc-500 border-b border-white/10">
          <div className="col-span-5">Item</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-2 text-right">Worth</div>
          <div className="col-span-2 text-right">Added by</div>
        </div>

        {filtered.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-12 gap-3 px-4 py-3 text-sm text-zinc-200 border-b border-white/5 hover:bg-white/5"
          >
            <div className="col-span-5 text-white font-medium">{it.name}</div>
            <div className="col-span-2 text-zinc-400">{it.type}</div>
            <div className="col-span-1 text-right">{it.qty}</div>
            <div className="col-span-2 text-right text-zinc-300">{it.worth}</div>
            <div className="col-span-2 text-right text-zinc-500">{it.addedBy}</div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-zinc-500">
            No items match your filters.
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
    </main>
  );
}