import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPrompt, buildReviewInput, getPullRequestFiles, PATCH_BUDGET } from "./dd-ai-review.mjs";

const file = (filename, patch = "diff --git a/x b/x") => ({ filename, status: "modified", additions: 1, deletions: 1, patch });

test("small PR includes complete per-file patches", () => {
  const result = buildReviewInput([file("src/server/auth.ts", "auth change"), file("README.md", "docs")]);
  assert.equal(result.coverage.totalFiles, 2);
  assert.equal(result.coverage.patchComplete, 2);
  assert.match(result.patchText, /src\/server\/auth\.ts/);
  assert.match(result.patchText, /README\.md/);
});

test("large conceptual PR never requests a whole PR diff", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const page = new URL(url).searchParams.get("page");
    const entries = page === "1" ? Array.from({ length: 100 }, (_, index) => file(`src/server/file-${index}.ts`)) : [file("README.md")];
    return { ok: true, status: 200, async json() { return entries; } };
  };
  try {
    const files = await getPullRequestFiles({ repo: "o/r", prNumber: "1", defaultHeaders: {} });
    assert.equal(files.length, 101);
    assert.equal(calls.length, 2);
    assert.equal(calls.every((url) => url.includes("/pulls/1/files?")), true);
    assert.equal(calls.some((url) => url.includes("application/vnd.github.v3.diff")), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("pagination retrieves all pages beyond 100 files", async () => {
  let pages = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    pages += 1;
    const page = Number(new URL(url).searchParams.get("page"));
    const entries = page < 3 ? Array.from({ length: 100 }, (_, index) => file(`file-${page}-${index}.txt`)) : [file("file-3.txt")];
    return { ok: true, status: 200, async json() { return entries; } };
  };
  try { assert.equal((await getPullRequestFiles({ repo: "o/r", prNumber: "1", defaultHeaders: {} })).length, 201); assert.equal(pages, 3); }
  finally { globalThis.fetch = originalFetch; }
});

test("patch input stays within budget and high-risk files are prioritized", () => {
  const result = buildReviewInput([file("README.md", "r".repeat(20_000)), file("api/auth.ts", "a".repeat(20_000)), file("src/server/db.ts", "s".repeat(20_000))], 10_000);
  assert.ok(result.patchText.length <= 10_000);
  assert.equal(result.orderedFiles[0].filename, "api/auth.ts");
  assert.ok(result.coverage.patchTruncated + result.coverage.patchOmitted > 0);
});

test("missing and oversized patches are explicit", () => {
  const result = buildReviewInput([{ ...file("assets/image.png"), patch: undefined }, file("src/server/auth.ts", "x".repeat(PATCH_BUDGET + 100))], PATCH_BUDGET);
  assert.equal(result.coverage.patchUnavailable, 1);
  assert.equal(result.coverage.patchTruncated, 1);
  assert.match(result.coverageNotes.join("\n"), /Patch unavailable|patch unavailable/);
  assert.match(result.patchText, /truncated/);
});

test("coverage metadata names every changed file and warns against false safety", () => {
  const files = [file("api/auth.ts", "x".repeat(10_000)), file("README.md", "y".repeat(10_000)), file("blob.bin", undefined)];
  const input = buildReviewInput(files, 1_000);
  const prompt = buildPrompt({ rubric: "rubric", pr: { title: "large", body: "body" }, files, reviewInput: input });
  for (const name of files.map((entry) => entry.filename)) assert.match(prompt, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(prompt, /High-risk files without complete patches/);
  assert.match(prompt, /Do not return SAFE with high confidence/);
});
