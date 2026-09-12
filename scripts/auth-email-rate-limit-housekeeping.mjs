import postgres from "postgres";

import {
  parseAuthEmailRateLimitHousekeepingArguments,
  runAuthEmailRateLimitHousekeeping,
} from "./auth-email-rate-limit-housekeeping-core.mjs";

export async function runAuthEmailRateLimitHousekeepingCli({
  argv = process.argv.slice(2),
  environment = process.env,
  createSql = postgres,
  write = (line) => console.log(line),
} = {}) {
  const options = parseAuthEmailRateLimitHousekeepingArguments(argv);
  const databaseUrl = String(environment.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in the approved operator environment");
  }

  const sql = createSql(databaseUrl, { max: 1, prepare: false });
  try {
    const result = await runAuthEmailRateLimitHousekeeping(sql, options);
    write(JSON.stringify(result));
    return result;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function formatAuthEmailRateLimitHousekeepingCliError(error) {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "DATABASE_URL is required in the approved operator environment" ||
    message.startsWith("--batch-size") ||
    message.startsWith("Specify only one of") ||
    message.startsWith("Unsupported argument:")
  ) {
    return `Authentication email limiter housekeeping failed: ${message}`;
  }
  return "Authentication email limiter housekeeping failed.";
}

export async function runAuthEmailRateLimitHousekeepingEntrypoint({
  argv = process.argv.slice(2),
  environment = process.env,
  runCli = runAuthEmailRateLimitHousekeepingCli,
  writeError = (line) => console.error(line),
} = {}) {
  const databaseUrl = String(environment.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    writeError(
      "Authentication email limiter housekeeping failed: DATABASE_URL is required in the approved operator environment"
    );
    return 1;
  }
  try {
    await runCli({ argv, environment });
    return 0;
  } catch (error) {
    // Database driver errors may include query parameters or connection data.
    writeError(formatAuthEmailRateLimitHousekeepingCliError(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runAuthEmailRateLimitHousekeepingEntrypoint().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
