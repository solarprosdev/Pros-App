/**
 * In-memory store for user profile (Bank, Account, Routing, Email, Name).
 * Keyed by authenticated user email. Replace with Airtable when ready.
 */

export interface UserProfile {
  bank: string;
  account: string;
  routing: string;
  email: string;
  name: string;
}

const store = new Map<string, UserProfile>();

function key(email: string): string {
  return email.trim().toLowerCase();
}

export function getProfile(userEmail: string): UserProfile | null {
  return store.get(key(userEmail)) ?? null;
}

export function setProfile(userEmail: string, data: Partial<UserProfile>): UserProfile {
  const k = key(userEmail);
  const existing = store.get(k) ?? {
    bank: "",
    account: "",
    routing: "",
    email: userEmail,
    name: "",
  };
  const updated: UserProfile = {
    bank: data.bank ?? existing.bank,
    account: data.account ?? existing.account,
    routing: data.routing ?? existing.routing,
    email: data.email ?? existing.email,
    name: data.name ?? existing.name,
  };
  store.set(k, updated);
  return updated;
}
