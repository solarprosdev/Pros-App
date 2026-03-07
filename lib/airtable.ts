/**
 * Airtable client: fetch/update Recruits record by Email Lower (login email).
 * Table: Recruits Private. Fields: Full Name, Email Lower, Bank Name, Account Number, Routing Number.
 */

const RAW_BASE_ID = process.env.AIRTABLE_BASE_ID?.trim() ?? "";
// Base ID in API: with "app" prefix to match URL (https://airtable.com/appKVhLzI2bcHulQc/...)
const BASE_ID = RAW_BASE_ID ? (RAW_BASE_ID.startsWith("app") ? RAW_BASE_ID : `app${RAW_BASE_ID}`) : "";
const API_KEY = process.env.AIRTABLE_API_KEY?.trim() ?? "";
// Prefer table ID (tbl...) from your URL to avoid 403 "model not found" with table name
const RECRUITS_TABLE = process.env.AIRTABLE_RECRUITS_TABLE?.trim() || "Recruits Private";

// Airtable field names in your Recruits Private table
const FIELD_EMAIL = process.env.AIRTABLE_FIELD_EMAIL || "Email Lower";
const FIELD_NAME = process.env.AIRTABLE_FIELD_NAME || "Full Name";
const FIELD_BANK = process.env.AIRTABLE_FIELD_BANK || "Bank Name";
const FIELD_ACCOUNT = process.env.AIRTABLE_FIELD_ACCOUNT || "Account Number";
const FIELD_ROUTING = process.env.AIRTABLE_FIELD_ROUTING || "Routing Number";

export interface RecruitRecord {
  id: string;
  name: string;
  email: string;
  bank: string;
  account: string;
  routing: string;
}

function getAuthHeader(): string {
  if (!API_KEY) throw new Error("AIRTABLE_API_KEY is not set");
  return `Bearer ${API_KEY}`;
}

function encodeFormula(email: string): string {
  // Email Lower in Airtable is typically lowercase; compare with lowercased login email
  const normalized = email.trim().toLowerCase();
  const escaped = normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `{${FIELD_EMAIL}}='${escaped}'`;
}

/** Get field value from Airtable record; try exact key then case-insensitive match (Airtable can return different casing). */
function getFieldValue(fields: Record<string, unknown>, ...possibleKeys: string[]): string {
  const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? (v[0] as string) ?? "" : "");
  for (const key of possibleKeys) {
    if (fields[key] !== undefined && fields[key] !== null) return str(fields[key]);
  }
  const lower = (s: string) => s.toLowerCase().trim();
  for (const preferred of possibleKeys) {
    const found = Object.keys(fields).find((k) => lower(k) === lower(preferred));
    if (found) return str(fields[found]);
  }
  return "";
}

export function isAirtableConfigured(): boolean {
  return Boolean(BASE_ID && API_KEY);
}

/**
 * Fetch the first Recruits record where Email Lower matches the login email.
 */
export async function getRecruitByEmail(email: string): Promise<RecruitRecord | null> {
  const log = (msg: string, ...args: unknown[]) => console.log("[Airtable]", msg, ...args);
  if (!BASE_ID || !API_KEY) {
    log("getRecruitByEmail skipped: missing BASE_ID or API_KEY", { hasBase: !!BASE_ID, hasKey: !!API_KEY, keyLength: API_KEY?.length ?? 0 });
    return null;
  }
  const formula = encodeFormula(email);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(RECRUITS_TABLE)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  log("fetching recruit", { email, emailLower: email.trim().toLowerCase(), formula, table: RECRUITS_TABLE });
  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader() },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("[Airtable] GET failed", res.status, errText);
    throw new Error(`Airtable ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { records?: { id: string; fields: Record<string, unknown> }[] };
  const record = data.records?.[0];
  const recordCount = data.records?.length ?? 0;
  log("response", { recordCount, hasRecord: !!record });
  if (!record) {
    log("no record found for this email – check that a row in Recruits Private has Email Lower =", email.trim().toLowerCase());
    return null;
  }
  const fields = record.fields;
  log("record fields (exact keys from Airtable):", Object.keys(fields));
  log("raw fields (values):", Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : Array.isArray(v) ? v[0] : v])));

  const name = getFieldValue(fields, FIELD_NAME, "Full Name", "Name", "full name", "name");
  const emailVal = getFieldValue(fields, FIELD_EMAIL, "Email Lower", "Email", "email lower", "email");
  const bank = getFieldValue(fields, FIELD_BANK, "Bank Name", "Bank", "bank name", "bank");
  const account = getFieldValue(fields, FIELD_ACCOUNT, "Account Number", "Account", "account number", "account");
  const routing = getFieldValue(fields, FIELD_ROUTING, "Routing Number", "Routing", "routing number", "routing");

  const result = {
    id: record.id,
    name,
    email: emailVal || email.trim(),
    bank,
    account,
    routing,
  };
  log("mapped profile:", result);
  return result;
}

/**
 * Update a Recruits record by id with the given fields.
 */
export async function updateRecruit(
  recordId: string,
  fields: { name?: string; email?: string; bank?: string; account?: string; routing?: string }
): Promise<RecruitRecord | null> {
  if (!BASE_ID || !API_KEY) return null;
  const body: Record<string, string> = {};
  if (fields.name !== undefined) body[FIELD_NAME] = fields.name;
  if (fields.email !== undefined) body[FIELD_EMAIL] = fields.email;
  if (fields.bank !== undefined) body[FIELD_BANK] = fields.bank;
  if (fields.account !== undefined) body[FIELD_ACCOUNT] = fields.account;
  if (fields.routing !== undefined) body[FIELD_ROUTING] = fields.routing;
  if (Object.keys(body).length === 0) return null;
  const url = `https://api.airtable.com/v0/${encodeURIComponent(BASE_ID)}/${encodeURIComponent(RECRUITS_TABLE)}/${encodeURIComponent(recordId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: body }),
  });
  if (!res.ok) {
    console.error("Airtable PATCH error", res.status, await res.text());
    return null;
  }
  const record = (await res.json()) as { id: string; fields: Record<string, unknown> };
  const f = record.fields;
  const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? (v[0] as string) ?? "" : "");
  return {
    id: record.id,
    name: str(f[FIELD_NAME]),
    email: str(f[FIELD_EMAIL]),
    bank: str(f[FIELD_BANK]),
    account: str(f[FIELD_ACCOUNT]),
    routing: str(f[FIELD_ROUTING]),
  };
}
