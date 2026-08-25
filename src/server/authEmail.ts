type AuthEmailEnvironment = Record<string, string | undefined>;

export const DEFAULT_AUTH_EMAIL_FROM = "no-reply@dopamine-dungeon.com";
export const DEFAULT_AUTH_EMAIL_FROM_NAME = "Dopamine Dungeon";
export const DEFAULT_AUTH_EMAIL_REPLY_TO = "dopamine.dungeon.info@gmail.com";
export const DEFAULT_AUTH_EMAIL_REPLY_TO_NAME = "Dopamine Dungeon";

export function formatMailbox(name: string, email: string) {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim();
  return normalizedName ? `${normalizedName} <${normalizedEmail}>` : normalizedEmail;
}

export function getAuthEmailDelivery(
  environment: AuthEmailEnvironment = process.env
) {
  const fromName =
    environment.AUTH_EMAIL_FROM_NAME || DEFAULT_AUTH_EMAIL_FROM_NAME;
  const fromEmail = environment.AUTH_EMAIL_FROM || DEFAULT_AUTH_EMAIL_FROM;
  const from = formatMailbox(fromName, fromEmail);
  const replyToEmail =
    environment.AUTH_EMAIL_REPLY_TO || DEFAULT_AUTH_EMAIL_REPLY_TO;
  const replyToName =
    environment.AUTH_EMAIL_REPLY_TO_NAME || DEFAULT_AUTH_EMAIL_REPLY_TO_NAME;

  return {
    from,
    replyTo: formatMailbox(replyToName, replyToEmail),
  };
}
