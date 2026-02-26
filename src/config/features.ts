// src/config/features.ts
export const features = {
  sessions: true,
  items: true,
  bag: true,

  // everything else OFF for v0.1
  quests: false,
  arcs: false,
  conditions: false,
  maps: false,
  lore: false,
  npcs: false,

  // internal
  debugPanel: false,
} as const;