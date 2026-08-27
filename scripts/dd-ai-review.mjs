import fs from "node:fs/promises";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = process.env.PR_NUMBER;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "mistral-small-latest";

if (!GITHUB_TOKEN || !REPO || !PR_NUMBER || !MISTRAL_API_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const defaultHeaders = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "dd-ai-review",
};

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getPullRequest() {
  return github(`/repos/${REPO}/pulls/${PR_NUMBER}`);
}

async function getPullRequestFiles() {
  return github(`/repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100`);
}

async function getPullRequestDiff() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/pulls/${PR_NUMBER}`, {
    headers: {
      ...defaultHeaders,
      Accept: "application/vnd.github.v3.diff",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch PR diff: ${response.status} ${text}`);
  }

  return response.text();
}

async function getIssueComments() {
  return github(`/repos/${REPO}/issues/${PR_NUMBER}/comments?per_page=100`);
}

async function createComment(body) {
  return github(`/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
}

async function updateComment(commentId, body) {
  return github(`/repos/${REPO}/issues/comments/${commentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[truncated]`;
}

async function askAI(prompt) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert software reviewer.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content ||
    "No review produced."
  );
}

async function main() {
  const rubric = await fs.readFile("ai/dopamine-dungeon-review-rubric.md", "utf8");
  const pr = await getPullRequest();
  const files = await getPullRequestFiles();
  let diff = await getPullRequestDiff();

  diff = truncate(diff, 50000);

  const changedFiles = files
    .map((file) => `- ${file.filename} (+${file.additions}/-${file.deletions})`)
    .join("\n");
// instructions //
  const prompt = `
${rubric}

Pull request title:
${pr.title}

Pull request description:
${pr.body || "(none)"}

Changed files:
${changedFiles}

Diff:
${diff}

Instructions:
- Determine whether this pull request is safe to merge.
- Report every material issue you identify.
- Prioritize GM/Player visibility leaks, access-control failures,
  security issues, data integrity risks, persistence/state bugs,
  architectural regressions, and significant product regressions.
- Do not omit serious findings for brevity.
- Keep each finding concise.
- Group related findings where appropriate.
- Do not report stylistic preferences or trivial nitpicks unless they
  meaningfully affect correctness or maintainability.
- Call out uncertainty when the diff does not provide enough information.
- If no material issues are found, say so clearly.

Output format:

Verdict: SAFE / REVIEW / UNSAFE

Findings:
- Include every material finding.
- Prefix each finding with CRITICAL, HIGH, or MEDIUM severity.
- If there are no material findings, write: "No material issues identified."

Summary:
- Give a brief overall assessment.
`;

  const review = await askAI(prompt);

  const marker = "<!-- dd-ai-review -->";
  const body = `${marker}
## Dopamine Dungeon AI Review

 _Model:\`${AI_MODEL}\`_

${review}
`;

  const existingComments = await getIssueComments();
  const existingReview = existingComments.find((comment) => comment.body?.includes(marker));

  if (existingReview) {
    await updateComment(existingReview.id, body);
    console.log("Updated existing AI review comment.");
  } else {
    await createComment(body);
    console.log("Created new AI review comment.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});