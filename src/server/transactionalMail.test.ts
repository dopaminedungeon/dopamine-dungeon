import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { sendTransactionalEmail, TransactionalMailError } from "./transactionalMail.js";

afterEach(() => vi.unstubAllGlobals());

test("Brevo transport sends only the approved rendered payload", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  await sendTransactionalEmail({ to: "recipient@example.test", from: "DD <from@example.test>", replyTo: "Help <help@example.test>", subject: "Subject", html: "<p>Body</p>", text: "Body" }, { BREVO_API_KEY: "server-only" });
  assert.equal(fetchMock.mock.calls[0][0], "https://api.brevo.com/v3/smtp/email");
  const init = fetchMock.mock.calls[0][1];
  assert.equal(init.headers["api-key"], "server-only");
  assert.deepEqual(JSON.parse(init.body), { sender: { name: "DD", email: "from@example.test" }, to: [{ email: "recipient@example.test" }], replyTo: { name: "Help", email: "help@example.test" }, subject: "Subject", htmlContent: "<p>Body</p>", textContent: "Body" });
});

test("Brevo transport normalizes missing credentials and provider failures", async () => {
  await assert.rejects(() => sendTransactionalEmail({ to: "a@example.test", from: "from@example.test", subject: "s", html: "h" }, {}), TransactionalMailError);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await assert.rejects(() => sendTransactionalEmail({ to: "a@example.test", from: "from@example.test", subject: "s", html: "h" }, { BREVO_API_KEY: "server-only" }), TransactionalMailError);
});
