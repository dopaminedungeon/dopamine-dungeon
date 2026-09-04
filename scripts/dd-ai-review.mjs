import fs from "node:fs/promises";

export const PATCH_BUDGET = 50_000;
const MAX_DESCRIPTION = 12_000;
const MAX_RUBRIC = 24_000;
const PAGE_SIZE = 100;

function truncate(text, maxLength) {
  if (text.length <= maxLength) return { text, truncated: false };
  const marker = "\n\n[truncated]";
  return { text: `${text.slice(0, Math.max(0, maxLength - marker.length))}${marker}`, truncated: true };
}

function riskScore(filename) {
  const path = filename.toLowerCase();
  if (/^(api\/|src\/server\/|src\/auth\/|src\/firebase\/|db\/|\.github\/)/.test(path)) return 100;
  if (/(migration|auth|invitation|membership|permission|security|rate.?limit|firestore|neon|email|mail)/.test(path)) return 90;
  if (/src\/(data|context|domain)\//.test(path)) return 80;
  return 10;
}

export function prioritizeFiles(files) {
  return [...files].sort((left, right) => riskScore(right.filename) - riskScore(left.filename) || left.filename.localeCompare(right.filename));
}

export function buildReviewInput(files, budget = PATCH_BUDGET) {
  const ordered = prioritizeFiles(files);
  const coverage = { totalFiles: files.length, patchAvailable: 0, patchComplete: 0, patchTruncated: 0, patchUnavailable: 0, patchOmitted: 0, highRiskUnavailable: 0 };
  const sections = [];
  const coverageNotes = [];
  let remaining = budget;

  for (const file of ordered) {
    const patch = typeof file.patch === "string" ? file.patch : "";
    if (!patch) {
      coverage.patchUnavailable += 1;
      if (riskScore(file.filename) >= 80) coverage.highRiskUnavailable += 1;
      coverageNotes.push(`- ${file.filename}: patch unavailable (binary, generated, or oversized file).`);
      continue;
    }
    coverage.patchAvailable += 1;
    const header = `### ${file.filename}\nStatus: ${file.status}; additions: ${file.additions}; deletions: ${file.deletions}\n`;
    if (remaining <= header.length + 40) {
      coverage.patchOmitted += 1;
      if (riskScore(file.filename) >= 80) coverage.highRiskUnavailable += 1;
      coverageNotes.push(`- ${file.filename}: patch omitted because the bounded patch budget was exhausted.`);
      continue;
    }
    const allowance = remaining - header.length - "Patch:\n".length;
    const clipped = truncate(patch, allowance);
    const text = `${header}Patch:\n${clipped.text}`;
    const separatorCost = sections.length ? 2 : 0;
    if (text.length + separatorCost > remaining) {
      coverage.patchOmitted += 1;
      if (riskScore(file.filename) >= 80) coverage.highRiskUnavailable += 1;
      coverageNotes.push(`- ${file.filename}: patch omitted because the bounded patch budget was exhausted.`);
      continue;
    }
    remaining -= text.length + separatorCost;
    if (clipped.truncated) {
      coverage.patchTruncated += 1;
      if (riskScore(file.filename) >= 80) coverage.highRiskUnavailable += 1;
    } else coverage.patchComplete += 1;
    sections.push({ file, text });
  }

  return { patchText: sections.map((section) => section.text).join("\n\n"), coverage, coverageNotes, orderedFiles: ordered };
}

export function coverageText(coverage) {
  return [
    "Review-input coverage (changed-file metadata is complete; patch bodies are bounded):",
    `- Total changed files: ${coverage.totalFiles}`,
    `- Complete patches included: ${coverage.patchComplete}`,
    `- Partially truncated patches: ${coverage.patchTruncated}`,
    `- Patches unavailable from GitHub: ${coverage.patchUnavailable}`,
    `- Patches omitted because the budget was exhausted: ${coverage.patchOmitted}`,
    `- High-risk files without complete patches: ${coverage.highRiskUnavailable}`,
  ].join("\n");
}

async function github(path, options = {}, context) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { ...context.defaultHeaders, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

export async function getPullRequestFiles(context) {
  const files = [];
  for (let page = 1; ; page += 1) {
    const pageFiles = await github(`/repos/${context.repo}/pulls/${context.prNumber}/files?per_page=${PAGE_SIZE}&page=${page}`, {}, context);
    files.push(...pageFiles);
    if (pageFiles.length < PAGE_SIZE) return files;
  }
}

async function askAI(prompt, context) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${context.mistralApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: context.aiModel, messages: [{ role: "system", content: "You are an expert software reviewer." }, { role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`AI API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No review produced.";
}

export function buildPrompt({ rubric, pr, files, reviewInput }) {
  const changedFiles = files.map((file) => `- ${file.filename} (+${file.additions}/-${file.deletions}) [${file.status}]`).join("\n");
  return `${truncate(rubric, MAX_RUBRIC).text}

Pull request title:
${pr.title}

Pull request description:
${truncate(pr.body || "(none)", MAX_DESCRIPTION).text}

Changed-file inventory (all changed filenames represented):
${changedFiles}

${coverageText(reviewInput.coverage)}
${reviewInput.coverageNotes.length ? `\nCoverage notes:\n${reviewInput.coverageNotes.join("\n")}` : ""}

Per-file review input:
${reviewInput.patchText}

Instructions:
- Determine whether this pull request is safe to merge.
- Report every material issue you identify, prioritizing security, authorization,
  GM/Player visibility, persistence, migrations, and deployment changes.
- Changed-file metadata represents the complete PR, but patch coverage may be incomplete.
- Do not return SAFE with high confidence when material high-risk files have unavailable,
  omitted, or truncated patches; call out that uncertainty and prefer REVIEW.
- Do not infer that an unshown file is safe merely because its patch is unavailable.
- Keep each finding concise and do not report stylistic preferences.

Output format:

Verdict: SAFE / REVIEW / UNSAFE

Findings:
- Include every material finding with CRITICAL, HIGH, or MEDIUM severity.
- If there are no material findings, write: "No material issues identified."

Summary:
- Give a brief overall assessment and explicitly mention any coverage limitation.
`;
}

export async function run() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const mistralApiKey = process.env.MISTRAL_API_KEY;
  const aiModel = process.env.AI_MODEL || "mistral-small-latest";
  if (!token || !repo || !prNumber || !mistralApiKey) throw new Error("Missing required environment variables.");
  const context = { repo, prNumber, mistralApiKey, aiModel, defaultHeaders: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "dd-ai-review" } };
  const rubric = await fs.readFile("ai/dopamine-dungeon-review-rubric.md", "utf8");
  const pr = await github(`/repos/${repo}/pulls/${prNumber}`, {}, context);
  const files = await getPullRequestFiles(context);
  const reviewInput = buildReviewInput(files);
  const review = await askAI(buildPrompt({ rubric, pr, files, reviewInput }), context);
  const marker = "<!-- dd-ai-review -->";
  const body = `${marker}\n## Dopamine Dungeon AI Review\n\n _Model:\`${aiModel}\`_\n\n${review}\n`;
  const comments = await github(`/repos/${repo}/issues/${prNumber}/comments?per_page=100`, {}, context);
  const existing = comments.find((comment) => comment.body?.includes(marker));
  if (existing) {
    await github(`/repos/${repo}/issues/comments/${existing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }, context);
    console.log("Updated existing AI review comment.");
  } else {
    await github(`/repos/${repo}/issues/${prNumber}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }, context);
    console.log("Created new AI review comment.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) run().catch((error) => { console.error(error); process.exit(1); });
