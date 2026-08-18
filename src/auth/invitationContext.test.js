import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.window = {
  location: { search: "" },
  localStorage: new MemoryStorage(),
};

const {
  clearInvitationContext,
  getPostVerificationPath,
  hasPendingInvitationContext,
  preserveInvitationContext,
} = await import("./invitationContext.js");

test("invitation continuation stores only a routing hint", () => {
  clearInvitationContext();
  assert.equal(preserveInvitationContext("?invited=true&campaign=secret"), true);
  assert.equal(hasPendingInvitationContext(), true);
  assert.equal(getPostVerificationPath(), "/welcome?invited=true");

  const stored = [...window.localStorage.values.values()].join("");
  assert.doesNotMatch(stored, /campaign|secret|workspace|role/i);

  clearInvitationContext();
  assert.equal(getPostVerificationPath(), "/");
});
