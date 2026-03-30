/**
 * In-memory store for user profile (Bank, Account, Routing, Email, name parts).
 * Keyed by authenticated user email. Replace with Airtable when ready.
 */

export interface UserProfile {
  bank: string;
  account: string;
  routing: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
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
    firstName: "",
    middleName: "",
    lastName: "",
  };
  const updated: UserProfile = {
    bank: data.bank ?? existing.bank,
    account: data.account ?? existing.account,
    routing: data.routing ?? existing.routing,
    email: data.email ?? existing.email,
    firstName: data.firstName ?? existing.firstName,
    middleName: data.middleName ?? existing.middleName,
    lastName: data.lastName ?? existing.lastName,
  };
  store.set(k, updated);
  return updated;
}
