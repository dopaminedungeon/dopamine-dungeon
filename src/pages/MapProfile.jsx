import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import GradientBackground from "../components/GradientBackground";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useMode } from "../context/ModeContext.jsx";
import {
  ArrowLeft,
  MapPin,
  Users,
  Map as MapIconBase,
  EyeOff,
  AlertTriangle,
  Swords,
  Compass,
  ChevronRight,
  Tag,
} from "lucide-react";

// --- MOCK DATA (will be replaced by Firebase later) ---
const MOCK_MAP_DATA = {
  1: {
    id: 1,
    name: "Volcanic Caverns",
    type: "Dungeon",
    size: "Large",
    players: "4-8",
    thumbnail:
      "https://images.unsplash.com/photo-1518173946687-a4c036bc9982?w=800&h=600&fit=crop",
    npcs: 24,
    items: 45,
    visibility: "gm-only", // "public" | "gm-only"
    subtitle: "Heart of the sleeping fire titan",
    locationPath: "Varionath → Southern Range → Ashen Rift",
    description:
      "A labyrinth of molten rock and obsidian ledges, where rivers of magma cast hellish light on ancient titan chains.",
    state: "Corrupted / unstable",
    campaign: "Chronicles of Varionath",
    category: "Dungeon",
    creator: "Magda",
    tags: ["fire", "titan", "dungeon"],
    lastUpdated: "2025-12-01",
  },
  2: {
    id: 2,
    name: "Enchanted Woods",
    type: "Wilderness",
    size: "Massive",
    players: "1-20",
    thumbnail:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=600&fit=crop",
    npcs: 56,
    items: 120,
    visibility: "public",
    subtitle: "Where the veil to the Fey thins",
    locationPath: "Varionath → Greenwood Expanse → Whisperglade",
    description:
      "Misty groves, bioluminescent flowers and ancient oaks warped by Fey magic. The air hums with unseen bargains.",
    state: "Mostly intact, low-level corruption",
    campaign: "Chronicles of Varionath",
    category: "Wilderness",
    creator: "Magda",
    tags: ["fey", "forest", "liminal"],
    lastUpdated: "2025-12-01",
  },
  3: {
    id: 3,
    name: "Arena of Champions",
    type: "PvP Arena",
    size: "Small",
    players: "2-16",
    thumbnail:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop",
    npcs: 4,
    items: 20,
    visibility: "public",
    subtitle: "Where glory and death shake hands",
    locationPath: "Varionath → Langendris → Lower Rings",
    description:
      "Stone terraces packed with roaring crowds, arcane wards flaring around a blood-stained sand pit.",
    state: "Active / controlled",
    campaign: "Chronicles of Varionath",
    category: "City Interior",
    creator: "Magda",
    tags: ["arena", "city", "pvp"],
    lastUpdated: "2025-12-01",
  },
  4: {
    id: 4,
    name: "Catacombs of Despair",
    type: "Dungeon",
    size: "Medium",
    players: "3-5",
    thumbnail:
      "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&h=600&fit=crop",
    npcs: 35,
    items: 78,
    visibility: "gm-only",
    subtitle: "Bones of forgotten rebellions",
    locationPath: "Varionath → Langendris → Beneath Old Quarter",
    description:
      "Endless rows of skulls, flooded corridors and shrines to banned gods, stitched together by desperate graffiti.",
    state: "Haunted / unstable",
    campaign: "Chronicles of Varionath",
    category: "Dungeon",
    creator: "Magda",
    tags: ["underground", "undead", "rebel"],
    lastUpdated: "2025-12-01",
  },
  5: {
    id: 5,
    name: "Crystal Kingdom",
    type: "Region",
    size: "Large",
    players: "1-4",
    thumbnail:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&h=600&fit=crop",
    npcs: 42,
    items: 95,
    visibility: "public",
    subtitle: "Shattered throne of light",
    locationPath: "Varionath → Northern Shards → Crystal Kingdom",
    description:
      "Floating crystal spires and broken causeways, refracting sunlight and magic into dangerous prismatic storms.",
    state: "Fractured but inhabitable",
    campaign: "Chronicles of Varionath",
    category: "Region",
    creator: "Magda",
    tags: ["crystal", "ruins", "arcane"],
    lastUpdated: "2025-12-01",
  },
  6: {
    id: 6,
    name: "Sunken Depths",
    type: "Dungeon",
    size: "Large",
    players: "4-6",
    thumbnail:
      "https://images.unsplash.com/photo-1551244072-5d12893278ab?w=800&h=600&fit=crop",
    npcs: 28,
    items: 62,
    visibility: "gm-only",
    subtitle: "What the tide refused to keep",
    locationPath: "Varionath → Western Sea → Drowned Trench",
    description:
      "Collapsed temples and barnacle-covered statues lit by eerie deep-sea glow, patrolled by silent silhouettes.",
    state: "Crushing pressure / hostile",
    campaign: "Chronicles of Varionath",
    category: "Dungeon",
    creator: "Magda",
    tags: ["water", "ancient", "pressure"],
    lastUpdated: "2025-12-01",
  },
};

export default function MapProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGM } = useMode();
  const [searchParams] = useSearchParams();

  // GM can force "player view" via ?mode=player
  const isGmView = isGM && searchParams.get("mode") !== "player";

  const map = MOCK_MAP_DATA[id];

  if (!map) {
    return (
      <GradientBackground>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 ml-64 p-8 text-white">
            <h1 className="text-3xl font-bold">Map Not Found</h1>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-zinc-300 hover:bg-white/20"
            >
              Go Back
            </button>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // --- Placeholder data for new sections (will be replaced with real DB content later) ---

  const keyFeatures = [
    {
      name: "Central Landmark",
      description: "The most obvious feature players notice on arrival.",
      status: "explored",
    },
    {
      name: "Secondary Point of Interest",
      description: "A location the party has interacted with at least once.",
      status: "unexplored",
    },
  ];
  const visibleKeyFeatures = isGmView
    ? keyFeatures
    : keyFeatures.filter((feat) => feat.status === "explored");

  const npcsPresent = [
    { name: "Named NPC #1", role: "Local contact / guide" },
    { name: "Named NPC #2", role: "Antagonist / watcher" },
  ];

  const playerInteractions = [
    "Session 05 – First arrival, initial exploration.",
    "Session 09 – Major confrontation / turning point.",
  ];

  const hiddenFeatures = [
    "Secret passage connecting two non-adjacent rooms.",
    "Lore book that reveals true owner / origin of the map.",
  ];

  const mapStateDetails = [
    "Current faction control: shifting between two groups.",
    "Corruption level rising slowly due to Nexus influence.",
    "Map evolves between sessions (reinforcements, debris, repairs).",
  ];

  const threatsAndEncounters = [
    {
      name: "Signature encounter",
      type: "Combat",
      trigger: "Triggered when players approach the central chamber unstealthed.",
    },
    {
      name: "Social tension",
      type: "Social",
      trigger: "Emerges if players side with the local faction.",
    },
  ];

  const foreshadowingBeats = [
    "Subtle symbol / sigil that matches a later villain.",
    "Environmental clue hinting at a future catastrophe or invasion.",
  ];

  const gmNotes = [
    "Tone: emphasize atmosphere over raw difficulty.",
    "Keep a sense of verticality / depth when describing spaces.",
    "Use this map to tie together at least two NPC arcs.",
  ];

  return (
    <GradientBackground>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64">
          <TopBar title={map.name} />

          <main className="flex-1 p-8 overflow-auto">
            {/* Back Button */}
            <button
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
              onClick={() => navigate("/maps")}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Maps
            </button>

            {/* HERO / CORE IDENTITY */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              {/* Image */}
              <div className="relative h-72">
                <img
                  src={map.thumbnail}
                  alt={map.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Name + subtitle + location */}
                <div className="absolute bottom-4 left-6 space-y-1">
                  <h1 className="text-3xl font-bold text-white">{map.name}</h1>
                  {map.subtitle && (
                    <p className="text-zinc-300 text-sm">{map.subtitle}</p>
                  )}
                  {map.locationPath && (
                    <p className="text-zinc-500 text-xs">
                      <Compass className="inline-block w-3 h-3 mr-1 text-zinc-400" />
                      {map.locationPath}
                    </p>
                  )}
                </div>

                {/* Type + visibility pill */}
                <div className="absolute top-4 right-6 flex flex-col items-end gap-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-white/10 text-white border border-white/20">
                    {map.type} • {map.size}
                  </span>

                  {isGmView && map.visibility === "gm-only" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-200 border border-red-500/40">
                      <EyeOff className="w-3 h-3" />
                      GM ONLY
                    </span>
                  )}
                </div>
              </div>

              {/* Quick stats row */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Location Type</p>
                    <p className="text-white font-medium">{map.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Recommended Players</p>
                    <p className="text-white font-medium">{map.players}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapIconBase className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500 text-xs">Content</p>
                    <p className="text-white font-medium">
                      {map.npcs} NPCs • {map.items} Items
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN GRID: Player (left) + GM Zone (right) */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* PLAYER-SAFE COLUMN */}
              <div
                className={
                  isGmView
                    ? "lg:col-span-7 space-y-6"
                    : "lg:col-span-12 space-y-6"
                }
              >
                {/* Description */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">
                    Map description
                  </h2>
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    {map.description ||
                      "Describe what the characters see when they first arrive here."}
                  </p>
                </section>

                {/* Key Features */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-lg font-semibold text-white">
      {isGmView ? "Key features (player-visible)" : "Key features"}
    </h2>
    {/* helper subtitle removed in both modes */}
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {visibleKeyFeatures.map((feat, idx) => (
      <div
        key={idx}
        className="bg-black/20 border border-white/10 rounded-xl p-4"
      >
        <p className="text-sm font-semibold text-white">{feat.name}</p>
        <p className="text-xs text-zinc-400 mt-1">{feat.description}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 text-zinc-300">
          <ChevronRight className="w-3 h-3" />
          Status: {feat.status}
        </p>
      </div>
    ))}
  </div>
</section>

                {/* NPCs present / known */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white">
                      NPCs present / known
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {npcsPresent.map((npc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-full text-left bg-black/20 border border-white/10 rounded-xl p-4 hover:border-indigo-500/50 hover:bg-white/10 transition-colors"
                      >
                        <p className="text-sm font-semibold text-white">
                          {npc.name}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {npc.role}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Player interactions with this map */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white">
                      Player interactions with this map
                    </h2>
                  </div>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {playerInteractions.map((entry, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-zinc-300"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        <span>{entry}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-zinc-500">
                    Current state:{" "}
                    <span className="text-zinc-300 font-medium">
                      {map.state}
                    </span>
                  </p>
                </section>
              </div>

              {/* GM-ONLY COLUMN */}
              {isGmView && (
                <div className="lg:col-span-5 space-y-6">
                  {/* Hidden Features / Secrets */}
                  <section className="bg-white/5 border border-red-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <h2 className="text-lg font-semibold text-white">
                        Hidden features & secrets
                      </h2>
                    </div>
                    <ul className="space-y-2 text-sm text-zinc-300">
                      {hiddenFeatures.map((entry, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-zinc-300"
                        >
                          <span className="mt-1 h-1 w-4 rounded-full bg-red-500/60" />
                          <span>{entry}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* Map State (GM-only) */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      Map state (GM-only)
                    </h2>
                    <ul className="space-y-2 text-sm text-zinc-300">
                      {mapStateDetails.map((entry, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-zinc-300"
                        >
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{entry}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* Threats & Encounters */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Swords className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-semibold text-white">
                        Threats & encounters
                      </h2>
                    </div>
                    <div className="space-y-3 text-sm text-zinc-300">
                      {threatsAndEncounters.map((enc, idx) => (
                        <div
                          key={idx}
                          className="border border-white/10 rounded-xl p-3 bg-black/20"
                        >
                          <p className="text-sm font-semibold text-white">
                            {enc.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Type: {enc.type}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">
                            Trigger: {enc.trigger}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Foreshadowing */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      Foreshadowing
                    </h2>
                    <ul className="space-y-2 text-sm text-zinc-300">
                      {foreshadowingBeats.map((entry, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-zinc-300"
                        >
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-400" />
                          <span>{entry}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* GM Notes */}
                  <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3">
                      GM notes
                    </h2>
                    <ul className="space-y-2 text-sm text-zinc-300">
                      {gmNotes.map((entry, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-zinc-300"
                        >
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          <span>{entry}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </div>

            {/* METADATA STRIP */}
            <div className="mt-8 border-t border-white/10 pt-4 text-xs text-zinc-400 flex flex-wrap gap-4">
              <span>
                Campaign:{" "}
                <span className="text-zinc-200 font-medium">
                  {map.campaign}
                </span>
              </span>
              <span>
                Category:{" "}
                <span className="text-zinc-200 font-medium">
                  {map.category}
                </span>
              </span>
              <span>
                Creator:{" "}
                <span className="text-zinc-200 font-medium">
                  {map.creator}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Tags:{" "}
                <span className="text-zinc-200 font-medium">
                  {map.tags?.join(", ")}
                </span>
              </span>
              <span>
                Last updated:{" "}
                <span className="text-zinc-200 font-medium">
                  {map.lastUpdated}
                </span>
              </span>
            </div>
          </main>
        </div>
      </div>
    </GradientBackground>
  );
}