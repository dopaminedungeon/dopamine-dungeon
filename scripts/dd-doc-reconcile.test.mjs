import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { askAI, parseStructuredReport, renderMarkdown, renderScopeSummary, selectPassInputs, validateManifestCoverage, validateManifestFiles, validateStructuredReport } from "./dd-doc-reconcile.mjs";

const manifest = JSON.parse(readFileSync(new URL("../ai/documentation-manifest.json", import.meta.url), "utf8"));

const allowed = {
  canonicalFiles: ["docs/architecture/adr/0004-firebase-identity-and-email-verification.md", "docs/permissions-table.md"],
  evidenceFiles: ["src/server/auth.ts", "src/server/access.ts", "src/server/viewer-mode.ts"],
};

const base = (overrides = {}) => ({
  title: "Finding",
  type: "DOCUMENTATION_DRIFT",
  confidence: "HIGH",
  relationship: "CONTRADICTS",
  documentation: { file: allowed.canonicalFiles[0], claim: "Verification is proposed and not current on dev.", claimKind: "EXPLICIT_NOT_CURRENT" },
  repository: [{ file: allowed.evidenceFiles[0], fact: "Email verification is enforced." }],
  capabilityEffect: "NOT_APPLICABLE",
  action: "UPDATE_EXISTING_DOCUMENTATION",
  actionFile: allowed.canonicalFiles[0],
  summary: "The documented current state is stale.",
  ...overrides,
});

test("drops agreements, omission-only findings, and mismatched relationships individually", () => {
  const report = { findings: [
    base({ title: "Valid drift" }),
    base({ title: "Agreement", type: "IMPLEMENTATION_RISK", relationship: "AGREES", action: "IMPLEMENTATION_REVIEW", actionFile: null }),
    base({ title: "Omission", relationship: "OMISSION_ONLY" }),
    base({ title: "Omission claim kind", documentation: { file: allowed.canonicalFiles[0], claim: "Authentication is current; email verification is not mentioned.", claimKind: "OMISSION" } }),
    base({ title: "Wrong drift relationship", relationship: "MAY_VIOLATE_INVARIANT" }),
  ] };
  const result = validateStructuredReport(report, allowed);
  assert.deepEqual(result.findings.map(({ title }) => title), ["Valid drift"]);
  assert.equal(result.rejected.length, 4);
});

test("preserves concrete ADR 0004 drift, collapses duplicate stale claims, and rejects weak drift", () => {
  const result = validateStructuredReport({ findings: [
    base({ title: "ADR 0004 verification and invitation status" }),
    base({ title: "ADR 0004 invitation status duplicate", documentation: { file: allowed.canonicalFiles[0], claim: "Invitation continuation is proposed and not current on dev.", claimKind: "EXPLICIT_NOT_CURRENT" }, repository: [{ file: allowed.evidenceFiles[0], fact: "Invitation continuation is implemented." }] }),
    base({ title: "Low confidence drift", confidence: "LOW" }),
    base({ title: "Unrelated evidence", repository: [{ file: "src/unknown.ts", fact: "Not authorized." }] }),
  ] }, allowed);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].title, "ADR 0004 verification and invitation status");
  assert.equal(result.rejected.length, 3);
});

test("keeps role/mode semantics structural and drops agreement claims", () => {
  const result = validateStructuredReport({ findings: [
    base({ title: "Owner access agrees", type: "IMPLEMENTATION_RISK", relationship: "AGREES", action: "IMPLEMENTATION_REVIEW", actionFile: null, documentation: { file: "docs/permissions-table.md", claim: "Owner access requires an allowed role.", claimKind: "EXPLICIT_INVARIANT" }, repository: [{ file: "src/server/access.ts", fact: "The deny guard requires GM capability and an allowed role." }] }),
    base({ title: "Conjunctive role and mode", type: "IMPLEMENTATION_RISK", relationship: "MAY_VIOLATE_INVARIANT", action: "IMPLEMENTATION_REVIEW", actionFile: null, capabilityEffect: "RESTRICTS", documentation: { file: "docs/permissions-table.md", claim: "Role and selected mode are both required for GM capability.", claimKind: "EXPLICIT_INVARIANT" }, repository: [{ file: "src/server/access.ts", fact: "campaignRole === gm && selectedMode === gm." }] }),
    base({ title: "Filtered representation", type: "IMPLEMENTATION_RISK", relationship: "MAY_VIOLATE_INVARIANT", action: "IMPLEMENTATION_REVIEW", actionFile: null, capabilityEffect: "FILTERS", documentation: { file: "docs/permissions-table.md", claim: "Player mode returns spoiler-safe representation.", claimKind: "EXPLICIT_INVARIANT" }, repository: [{ file: "src/server/viewer-mode.ts", fact: "Selected mode filters returned fields after authorization." }] }),
    base({ title: "Owner literal domain unknown", type: "IMPLEMENTATION_RISK", relationship: "MAY_VIOLATE_INVARIANT", action: "IMPLEMENTATION_REVIEW", actionFile: null, capabilityEffect: "UNKNOWN", confidence: "HIGH", documentation: { file: "docs/permissions-table.md", claim: "Workspace and campaign roles must remain distinct.", claimKind: "EXPLICIT_INVARIANT" }, repository: [{ file: "src/server/viewer-mode.ts", fact: "normalize(owner) returns gm; the ownership domain is not established." }] }),
    base({ title: "Concrete mode elevation", type: "IMPLEMENTATION_RISK", relationship: "MAY_VIOLATE_INVARIANT", action: "IMPLEMENTATION_REVIEW", actionFile: null, capabilityEffect: "GRANTS", documentation: { file: "docs/permissions-table.md", claim: "Role verification is required before GM capability.", claimKind: "EXPLICIT_INVARIANT" }, repository: [{ file: "src/server/viewer-mode.ts", fact: "If mode is gm, GM data is exposed without checking role." }] }),
  ] }, allowed);
  assert.deepEqual(result.findings.map(({ title }) => title), ["Concrete mode elevation"]);
});

test("rejects incomplete UNVERIFIED and low-confidence documentation actions", () => {
  const result = validateStructuredReport({ findings: [
    base({ title: "Unverified agreement", type: "UNVERIFIED", relationship: "AGREES", confidence: "MEDIUM", action: "HUMAN_VERIFICATION", actionFile: null }),
    base({ title: "Valid unresolved", type: "UNVERIFIED", relationship: "INSUFFICIENT_EVIDENCE", confidence: "LOW", action: "HUMAN_VERIFICATION", actionFile: null }),
    base({ title: "Low confidence update", confidence: "LOW" }),
  ] }, allowed);
  assert.deepEqual(result.findings.map(({ title }) => title), ["Valid unresolved"]);
});

test("parses JSON only and renders Markdown after validation", () => {
  assert.deepEqual(parseStructuredReport('{"findings":[]}'), { findings: [] });
  assert.throws(() => parseStructuredReport("```json\\n{}\\n```"), /invalid JSON/);
  const result = validateStructuredReport({ findings: [base()] }, allowed);
  assert.match(renderMarkdown(result.findings), /Finding type: DOCUMENTATION_DRIFT/);
});

test("sends the configured reasoning effort with native structured output", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"findings":[]}' } }] }) };
  };
  try {
    await askAI("test prompt", "test-key");
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(request.reasoning_effort, "high");
  assert.equal(request.response_format.type, "json_schema");
});

test("declared documentation inventory is fully assigned to explicit passes", async () => {
  assert.equal(validateManifestCoverage(manifest), manifest);
  await validateManifestFiles(manifest);
  const selected = selectPassInputs(manifest);
  assert.deepEqual(selected.map(({ passName }) => passName), [
    "security-auth",
    "security-access",
    "architecture-persistence",
    "operations-ci",
    "iteration-handoff",
  ]);
  for (const kind of ["canonical", "evidence"]) {
    const declared = new Set(manifest[kind]);
    const supplied = new Set(selected.flatMap(({ pass }) => pass[kind]));
    assert.deepEqual(supplied, declared);
  }
});

test("coverage validation fails when an inventory item is omitted or a pass adds an undeclared path", () => {
  const fixture = {
    canonical: ["docs/a.md", "docs/b.md"],
    evidence: ["src/a.js"],
    passes: { alpha: { scope: ["topic"], outOfScope: ["other"], canonical: ["docs/a.md"], evidence: ["src/a.js"] } },
  };
  assert.throws(() => validateManifestCoverage(fixture), /canonical inventory is not covered[\s\S]*docs\/b\.md/);
  fixture.passes.alpha.canonical.push("docs/b.md");
  assert.equal(validateManifestCoverage(fixture), fixture);
  fixture.passes.alpha.evidence.push("src/undeclared.js");
  assert.throws(() => validateManifestCoverage(fixture), /missing from the top-level inventory: src\/undeclared\.js/);
});

test("pass selection returns only its explicit inputs and never falls back to top-level lists", () => {
  const fixture = {
    canonical: ["docs/a.md", "docs/b.md"],
    evidence: ["src/a.js", "src/b.js"],
    passes: {
      alpha: { scope: ["alpha"], outOfScope: ["beta"], canonical: ["docs/a.md"], evidence: ["src/a.js"] },
      beta: { scope: ["beta"], outOfScope: ["alpha"], canonical: ["docs/b.md"], evidence: ["src/b.js"] },
    },
  };
  assert.deepEqual(selectPassInputs(fixture).map(({ passName, pass }) => ({ passName, canonical: pass.canonical, evidence: pass.evidence })), [
    { passName: "alpha", canonical: ["docs/a.md"], evidence: ["src/a.js"] },
    { passName: "beta", canonical: ["docs/b.md"], evidence: ["src/b.js"] },
  ]);
});

test("summary scope names exact passes and inputs without claiming a whole-repository audit", () => {
  const summary = renderScopeSummary([{
    passName: "sample-pass",
    pass: { scope: ["sample subject"], canonical: ["docs/sample.md"], evidence: ["src/sample.js"] },
  }]);
  assert.match(summary, /Passes executed \(1\): `sample-pass`/);
  assert.match(summary, /Scope: sample subject/);
  assert.match(summary, /Out of scope:/);
  assert.match(summary, /Canonical documents inspected \(1\):[\s\S]*docs\/sample\.md/);
  assert.match(summary, /Repository evidence inspected \(1\):[\s\S]*src\/sample\.js/);
  assert.match(summary, /not a whole-repository audit/);
});
