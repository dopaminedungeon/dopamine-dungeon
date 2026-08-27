import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AI_MODEL = process.env.AI_MODEL || "mistral-small-latest";
const AI_REASONING_EFFORT = process.env.AI_REASONING_EFFORT || "high";
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FINDING_TYPES = new Set(["DOCUMENTATION_DRIFT", "IMPLEMENTATION_RISK", "UNVERIFIED"]);
const RELATIONSHIPS = new Set(["CONTRADICTS", "MAY_VIOLATE_INVARIANT", "INSUFFICIENT_EVIDENCE", "AGREES", "OMISSION_ONLY"]);
const CONFIDENCES = new Set(["HIGH", "MEDIUM", "LOW"]);
const ACTIONS = new Set(["UPDATE_EXISTING_DOCUMENTATION", "HUMAN_VERIFICATION", "IMPLEMENTATION_REVIEW"]);
const CLAIM_KINDS = new Set(["EXPLICIT_CURRENT_STATE", "EXPLICIT_NOT_CURRENT", "EXPLICIT_INVARIANT", "EXPLICIT_ABSENCE", "OMISSION"]);
const CAPABILITY_EFFECTS = new Set(["GRANTS", "RESTRICTS", "FILTERS", "UNKNOWN", "NOT_APPLICABLE"]);

const STRUCTURED_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "documentation_reconciliation_report",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["findings"],
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "type", "confidence", "relationship", "documentation", "repository", "capabilityEffect", "action", "actionFile", "summary"],
            properties: {
              title: { type: "string" },
              type: { type: "string", enum: [...FINDING_TYPES] },
              confidence: { type: "string", enum: [...CONFIDENCES] },
              relationship: { type: "string", enum: [...RELATIONSHIPS] },
              documentation: {
                type: "object",
                additionalProperties: false,
                required: ["file", "claim", "claimKind"],
                properties: { file: { type: "string" }, claim: { type: "string" }, claimKind: { type: "string", enum: [...CLAIM_KINDS] } },
              },
              capabilityEffect: { type: "string", enum: [...CAPABILITY_EFFECTS] },
              repository: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["file", "fact"],
                  properties: { file: { type: "string" }, fact: { type: "string" } },
                },
              },
              action: { type: "string", enum: [...ACTIONS] },
              actionFile: { type: ["string", "null"] },
              summary: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const normalizeMarkdown = (value) => value.replace(/\\_/g, "_").replace(/\\-/g, "-").replace(/\\\./g, ".");

function normalizeFindingValue(value) {
  return typeof value === "string" ? normalizeMarkdown(value.trim()) : value;
}

export function parseStructuredReport(rawReport) {
  let parsed;
  try {
    parsed = JSON.parse(rawReport);
  } catch {
    throw new Error("Mistral returned invalid JSON; no findings were rendered.");
  }
  if (!parsed || !Array.isArray(parsed.findings)) {
    throw new Error("Mistral JSON did not contain a findings array.");
  }
  return parsed;
}

function uniqueAuthorizedPath(filePath, allowedFiles) {
  const normalized = normalizeFindingValue(filePath);
  if (allowedFiles.includes(normalized)) return normalized;
  const matches = allowedFiles.filter((candidate) => candidate.split("/").pop() === normalized);
  return matches.length === 1 ? matches[0] : null;
}

function invalid(reason) {
  return { valid: false, reason };
}

function claimOverlap(left, right) {
  const words = (value) => new Set(normalizeFindingValue(value).toLowerCase().match(/[a-z0-9]+/g) || []);
  const first = words(left);
  const second = words(right);
  if (!first.size || !second.size) return 0;
  let shared = 0;
  for (const word of first) if (second.has(word)) shared += 1;
  return shared / Math.min(first.size, second.size);
}

export function collapseDuplicateFindings(findings) {
  const retained = [];
  const collapsed = [];
  for (const finding of findings) {
    const duplicate = retained.find((prior) =>
      prior.type === finding.type &&
      prior.relationship === finding.relationship &&
      prior.documentation.file === finding.documentation.file &&
      prior.action === finding.action &&
      prior.actionFile === finding.actionFile &&
      claimOverlap(prior.documentation.claim, finding.documentation.claim) >= 0.45,
    );
    if (duplicate) collapsed.push({ title: finding.title, reason: "duplicate supported by the same document, relationship, action, and overlapping claim" });
    else retained.push(finding);
  }
  return { findings: retained, collapsed };
}

export function validateFinding(finding, { canonicalFiles, evidenceFiles }) {
  if (!finding || typeof finding !== "object") return invalid("finding is not an object");
  const type = normalizeFindingValue(finding.type);
  const relationship = normalizeFindingValue(finding.relationship);
  const confidence = normalizeFindingValue(finding.confidence);
  const action = normalizeFindingValue(finding.action);
  const claimKind = normalizeFindingValue(finding.documentation?.claimKind);
  const capabilityEffect = normalizeFindingValue(finding.capabilityEffect);
  if (!FINDING_TYPES.has(type)) return invalid("unsupported finding type");
  if (!RELATIONSHIPS.has(relationship)) return invalid("unsupported relationship");
  if (!CONFIDENCES.has(confidence)) return invalid("unsupported confidence");
  if (!ACTIONS.has(action)) return invalid("unsupported action");
  if (!CLAIM_KINDS.has(claimKind)) return invalid("unsupported documentation claim kind");
  if (!CAPABILITY_EFFECTS.has(capabilityEffect)) return invalid("unsupported capability effect");
  if (relationship === "AGREES") return invalid("agreement is not a finding");
  if (relationship === "OMISSION_ONLY") return invalid("omission-only finding");
  if (claimKind === "OMISSION") return invalid("omission is not a finding");
  if (type === "DOCUMENTATION_DRIFT" && relationship !== "CONTRADICTS") return invalid("documentation drift must contradict");
  if (type === "DOCUMENTATION_DRIFT" && !["EXPLICIT_CURRENT_STATE", "EXPLICIT_NOT_CURRENT", "EXPLICIT_ABSENCE"].includes(claimKind)) return invalid("documentation drift requires an explicit state or absence claim");
  if (type === "IMPLEMENTATION_RISK" && relationship !== "MAY_VIOLATE_INVARIANT") return invalid("implementation risk must may violate an invariant");
  if (type === "IMPLEMENTATION_RISK" && claimKind !== "EXPLICIT_INVARIANT") return invalid("implementation risk requires an explicit invariant");
  if (type === "UNVERIFIED" && relationship !== "INSUFFICIENT_EVIDENCE") return invalid("unverified must have insufficient evidence");
  if (type === "UNVERIFIED" && claimKind === "OMISSION") return invalid("unverified cannot represent omission-only uncertainty");
  if (type === "DOCUMENTATION_DRIFT" && !["HIGH", "MEDIUM"].includes(confidence)) return invalid("documentation drift requires high or medium confidence");
  if (confidence === "LOW" && action === "UPDATE_EXISTING_DOCUMENTATION") return invalid("low confidence cannot prescribe documentation updates");
  if (type === "IMPLEMENTATION_RISK" && action === "UPDATE_EXISTING_DOCUMENTATION") return invalid("implementation risk cannot prescribe changing documentation");
  if (type === "IMPLEMENTATION_RISK" && capabilityEffect === "RESTRICTS") return invalid("a restriction cannot be a privilege-elevation risk");
  if (type === "IMPLEMENTATION_RISK" && capabilityEffect === "FILTERS") return invalid("representation filtering cannot be a privilege-elevation risk");
  if (type === "IMPLEMENTATION_RISK" && capabilityEffect === "UNKNOWN" && confidence === "HIGH") return invalid("unknown capability effect cannot support high-confidence implementation risk");
  if (typeof finding.title !== "string" || !finding.title.trim()) return invalid("missing title");
  if (typeof finding.summary !== "string" || !finding.summary.trim()) return invalid("missing summary");
  if (!finding.documentation || typeof finding.documentation !== "object") return invalid("missing documentation evidence");
  const documentationFile = uniqueAuthorizedPath(finding.documentation.file, canonicalFiles);
  if (!documentationFile) return invalid("documentation file is outside the canonical set");
  if (typeof finding.documentation.claim !== "string" || !finding.documentation.claim.trim()) return invalid("missing documentation claim");
  if (!Array.isArray(finding.repository) || finding.repository.length === 0) return invalid("missing repository evidence");
  const repository = finding.repository.map((item) => ({ ...item, file: uniqueAuthorizedPath(item?.file, evidenceFiles) }));
  if (repository.some((item) => !item.file || typeof item.fact !== "string" || !item.fact.trim())) return invalid("repository evidence is outside the pass or incomplete");
  if (action === "UPDATE_EXISTING_DOCUMENTATION") {
    const actionFile = uniqueAuthorizedPath(finding.actionFile, canonicalFiles);
    if (!actionFile) return invalid("documentation action file is not canonical");
    return { valid: true, finding: { ...finding, type, relationship, confidence, action, documentation: { ...finding.documentation, file: documentationFile }, repository, actionFile } };
  }
  if (finding.actionFile !== null) return invalid("non-documentation action must have null actionFile");
  return { valid: true, finding: { ...finding, type, relationship, confidence, action, documentation: { ...finding.documentation, file: documentationFile }, repository, actionFile: null } };
}

export function validateStructuredReport(report, allowed) {
  const findings = [];
  const rejected = [];
  for (const finding of report.findings) {
    const result = validateFinding(finding, allowed);
    if (result.valid) findings.push(result.finding);
    else rejected.push({ title: finding?.title || "<untitled>", reason: result.reason });
  }
  const deduplicated = collapseDuplicateFindings(findings);
  return { findings: deduplicated.findings, rejected: [...rejected, ...deduplicated.collapsed] };
}

function renderFinding(finding) {
  const repository = finding.repository.map((item) => `- ${item.file}: ${item.fact}`).join("\n");
  const action = finding.action === "UPDATE_EXISTING_DOCUMENTATION"
    ? `Update existing documentation:\n${finding.actionFile}`
    : finding.action === "HUMAN_VERIFICATION"
      ? "Human verification required."
      : "Implementation review required.";
  return `### Finding: ${finding.title}\n\nFinding type: ${finding.type}\nConfidence: ${finding.confidence}\n\nDocumentation:\n- ${finding.documentation.file}\n- ${finding.documentation.claim}\n\nRepository evidence:\n${repository}\n\nAssessment:\n${finding.summary}\n\nAction:\n${action}`;
}

export function renderMarkdown(findings) {
  return findings.map(renderFinding).join("\n\n---\n\n");
}

export async function askAI(prompt, apiKey = process.env.MISTRAL_API_KEY) {
  if (!apiKey) throw new Error("Missing MISTRAL_API_KEY.");
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, reasoning_effort: AI_REASONING_EFFORT, response_format: STRUCTURED_RESPONSE_FORMAT, messages: [{ role: "system", content: "You are an expert software documentation auditor. Return only JSON matching the supplied schema. Before classifying a finding, verify that the evidence logically entails the conflict; do not treat missing evidence as absence or document scope as product state; evaluate complete boolean expressions; and distinguish server-side filtering or restriction from granting authorization." }, { role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`Mistral API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.filter((chunk) => chunk?.type === "text").map((chunk) => chunk.text || "").join("") || '{"findings":[]}';
  }
  return content || '{"findings":[]}';
}

async function readDocuments(filePaths) {
  return Promise.all(filePaths.map(async (filePath) => ({ filePath, content: await fs.readFile(path.resolve(REPOSITORY_ROOT, filePath), "utf8") })));
}

function formatDocuments(documents) {
  return documents.map(({ filePath, content }) => `FILE: ${filePath}\n\n${content}`).join("\n\n---\n\n");
}

function buildPrompt(rubric, passName, pass, canonicalDocuments, evidenceDocuments) {
  return `${rubric}\n\nYou are performing one isolated documentation reconciliation pass.\nCURRENT PASS: ${passName}\n\nPASS SCOPE (audit only these subjects):\n${(pass.scope || []).map((item) => `- ${item}`).join("\n")}\n\nOUT OF SCOPE (do not report these subjects):\n${(pass.outOfScope || []).map((item) => `- ${item}`).join("\n")}\n\nCanonical documentation:\n${formatDocuments(canonicalDocuments)}\n\nAUTHORIZED REPOSITORY EVIDENCE FILES:\n${evidenceDocuments.map(({ filePath }) => `- ${filePath}`).join("\n")}\n\nRepository evidence:\n${formatDocuments(evidenceDocuments)}\n\nReturn a JSON object with a findings array matching the response schema. Omit agreements and omission-only observations. Do not infer absence from a file not containing a control. Treat role capability and selected mode as separate: mode may restrict representation but never grants capability. Use only authorized files. Zero findings is valid.`;
}

async function writeStepSummary(results) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const eventName = process.env.GITHUB_EVENT_NAME || "unknown";
  const manual = eventName === "workflow_dispatch";
  const context = manual
    ? "- Manual run: yes"
    : `- Triggering closeout issue: #${process.env.CLOSEOUT_ISSUE_NUMBER || "unknown"} — ${process.env.CLOSEOUT_ISSUE_TITLE || "unknown"}`;
  const allFindings = results.flatMap(({ result }) => result.findings);
  const counts = Object.fromEntries([...FINDING_TYPES].map((type) => [type, allFindings.filter((finding) => finding.type === type).length]));
  const emptyPasses = results.filter(({ result }) => result.findings.length === 0).length;
  const sections = results.map(({ passName, result }) => `## ${passName}\n\n${renderMarkdown(result.findings) || "No material findings."}`).join("\n\n");
  const summary = `# Dopamine Dungeon Documentation Reconciliation\n\nRun context:\n${context}\n- Model: ${AI_MODEL}\n- Reasoning effort: ${AI_REASONING_EFFORT}\n\n${sections}\n\n## Reconciliation Summary\n\n- Documentation drift: ${counts.DOCUMENTATION_DRIFT}\n- Implementation risks: ${counts.IMPLEMENTATION_RISK}\n- Human verification required: ${counts.UNVERIFIED}\n- Passes with no findings: ${emptyPasses}\n`;
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}

export async function runPass(passName, pass, rubric) {
  const canonicalDocuments = await readDocuments(pass.canonical || []);
  const evidenceDocuments = await readDocuments(pass.evidence || []);
  const prompt = buildPrompt(rubric, passName, pass, canonicalDocuments, evidenceDocuments);
  console.log(`\n=== Reconciliation pass: ${passName} ===`);
  console.log(`Model: ${AI_MODEL}`);
  console.log(`Reasoning effort: ${AI_REASONING_EFFORT}`);
  console.log(`Prompt size: ${prompt.length.toLocaleString()} characters (~${Math.ceil(prompt.length / 4).toLocaleString()} rough tokens)`);
  const structured = parseStructuredReport(await askAI(prompt));
  const validated = validateStructuredReport(structured, { canonicalFiles: pass.canonical || [], evidenceFiles: pass.evidence || [] });
  for (const rejection of validated.rejected) console.warn(`[${passName}] dropped ${rejection.title}: ${rejection.reason}`);
  const markdown = renderMarkdown(validated.findings);
  console.log(markdown || "No findings.");
  return validated;
}

export async function main() {
  if (!process.env.MISTRAL_API_KEY) throw new Error("Missing MISTRAL_API_KEY.");
  const rubric = await fs.readFile(path.resolve(REPOSITORY_ROOT, "ai/dopamine-dungeon-doc-reconciliation-rubric.md"), "utf8");
  const manifest = JSON.parse(await fs.readFile(path.resolve(REPOSITORY_ROOT, "ai/documentation-manifest.json"), "utf8"));
  const results = [];
  for (const [passName, pass] of Object.entries(manifest.passes || {})) {
    results.push({ passName, result: await runPass(passName, pass, rubric) });
  }
  await writeStepSummary(results);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
