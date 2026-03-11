/**
 * In-memory store for OTP codes. Keyed by email, expires after OTP_EXPIRY_MS.
 * Persisted on globalThis so hot reload in dev doesn't wipe codes.
 */

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const globalKey = "__pros_app_otp_store";
type Store = Map<string, { code: string; expiresAt: number }>;
const store: Store =
  typeof globalThis !== "undefined" && (globalThis as Record<string, Store>)[globalKey]
    ? (globalThis as Record<string, Store>)[globalKey]
    : new Map();
if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, Store>)[globalKey] = store;
}

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
