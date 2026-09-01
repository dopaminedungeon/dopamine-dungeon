export type TransactionalMailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
  replyTo?: string;
};

export class TransactionalMailError extends Error {
  constructor() {
    super("Transactional email delivery is unavailable");
  }
}

function mailbox(value: string) {
  const match = value.trim().match(/^(?:([^<]+)\s+)?<([^>]+)>$/);
  return match
    ? { email: match[2].trim(), ...(match[1]?.trim() ? { name: match[1].trim() } : {}) }
    : { email: value.trim() };
}

/** Server-only Brevo transport. Callers supply only rendered, authorized mail. */
export async function sendTransactionalEmail(
  message: TransactionalMailMessage,
  environment: Record<string, string | undefined> = process.env
) {
  const apiKey = environment.BREVO_API_KEY;
  if (!apiKey) throw new TransactionalMailError();

  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: mailbox(message.from),
        to: [mailbox(message.to)],
        ...(message.replyTo ? { replyTo: mailbox(message.replyTo) } : {}),
        subject: message.subject,
        htmlContent: message.html,
        ...(message.text ? { textContent: message.text } : {}),
      }),
    });
  } catch {
    throw new TransactionalMailError();
  }
  if (!response.ok) throw new TransactionalMailError();
}
