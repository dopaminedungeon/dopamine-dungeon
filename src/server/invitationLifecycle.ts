// Invitation delivery state is authoritative on the server. Clients receive
// only the derived next-eligible timestamp, never an independent cooldown policy.
export const INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function getInvitationResendAvailableAt(lastSentAt: Date | null) {
  if (!lastSentAt) return null;

  return new Date(lastSentAt.getTime() + INVITATION_RESEND_COOLDOWN_MS);
}
