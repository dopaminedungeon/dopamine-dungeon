const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailAddress(email) {
  return email.trim();
}

export function isValidEmailAddress(email) {
  return EMAIL_PATTERN.test(normalizeEmailAddress(email));
}
