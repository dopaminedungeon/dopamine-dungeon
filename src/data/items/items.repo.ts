import { readJson, writeJson } from "../storage/storage";
import { storageKeys } from "../storage/storageKeys";

export type Item = {
  id: string;
  name: string;
  description?: string;
  mechanics?: string;
};

const EMPTY: Item[] = [];

export const itemsRepo = {
  getAll(): Item[] {
    return readJson(storageKeys.items, EMPTY);
  },
  upsert(item: Item) {
    const all = itemsRepo.getAll();
    const idx = all.findIndex(i => i.id === item.id);
    const next = idx >= 0 ? all.map(i => (i.id === item.id ? item : i)) : [item, ...all];
    writeJson(storageKeys.items, next);
  },
  remove(id: string) {
    writeJson(storageKeys.items, itemsRepo.getAll().filter(i => i.id !== id));
  },
};