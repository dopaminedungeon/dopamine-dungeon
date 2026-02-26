import { readJson, writeJson } from "../storage/storage";
import { storageKeys } from "../storage/storageKeys";

export type Currency = { gp: number; sp: number; cp: number; pp: number };

const EMPTY: Currency = { gp: 0, sp: 0, cp: 0, pp: 0 };

export const currencyRepo = {
  get(): Currency {
    return readJson(storageKeys.currency, EMPTY);
  },
  save(next: Currency) {
    writeJson(storageKeys.currency, next);
  },
};