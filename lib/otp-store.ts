/**
 * In-memory store for OTP codes. Keyed by email, expires after OTP_EXPIRY_MS.
 */

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map<
  string,
  { code: string; expiresAt: number }
>();

export function setOtp(email: string, code: string): void {
  const normalized = email.trim().toLowerCase();
  store.set(normalized, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });
}

export function verifyOtp(email: string, code: string): boolean {
  const normalized = email.trim().toLowerCase();
  const entry = store.get(normalized);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(normalized);
    return false;
  }
  const match = code.trim().toUpperCase() === entry.code.toUpperCase();
  if (match) store.delete(normalized);
  return match;
}
