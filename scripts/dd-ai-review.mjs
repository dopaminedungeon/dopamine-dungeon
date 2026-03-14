import fs from "node:fs/promises";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = process.env.PR_NUMBER;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

if (!GITHUB_TOKEN || !REPO || !PR_NUMBER) {
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

async function askOllama(prompt) {
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
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
    throw new Error(`Ollama API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.message?.content || "No review produced.";
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
- Focus on real product and architecture risks.
- Prioritize GM/Player visibility boundaries.
- Call out uncertainty when the diff is incomplete.
- Give one concise PR-level review summary.
`;

  const review = await askOllama(prompt);

  const marker = "<!-- dd-ai-review -->";
  const body = `${marker}
## Dopamine Dungeon AI Review

_Model: \`${OLLAMA_MODEL}\`_

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