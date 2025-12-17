// src/data/mockBagOfHolding.js
export const mockBagOfHolding = [
  // Seed these from your Excel rows
  // { id: "boh-001", name: "Healing Potion", qty: 2, worth: 50, type: "Consumable", addedBy: "player", createdAt: Date.now() }
  { id: "boh-001", 
    name: "Healing Potion", 
    qty: 2, 
    worth: 50, 
    type: "Consumable", 
    addedBy: "player", 
    createdAt: Date.now() },
  { id: "boh-003", 
    name: "Diamond", 
    qty: 4, 
    worth: 1000, 
    type: "Spell Component", 
    addedBy: "player", 
    createdAt: Date.now() },
  { id: "boh-004", 
    name: "Armor of Gleaming", 
    qty: 1, 
    worth: 150, 
    type: "Armor", 
    addedBy: "player", 
    createdAt: Date.now() },
  { id: "boh-005", 
    name: "Enspelled Shortsword", 
    qty: 1, 
    worth: 250, 
    type: "Weapon", 
    addedBy: "player", 
    createdAt: Date.now() },
  { id: "boh-006", 
    name: "Thieves' Tools", 
    qty: 4, 
    worth: 10, 
    type: "Other", 
    addedBy: "player", 
    createdAt: Date.now() }
];

export const bagTypes = ["All", "Weapon", "Armor", "Consumable", "Currency", "Spell Component", "Other"];
// NEW ✅
export const mockPartyCurrency = {
  gp: 0,
  sp: 0,
  cp: 0,
  pp: 0,
  ep: 0,
};