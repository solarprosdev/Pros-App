/**
 * Airtable client: fetch/update Recruits record by Email Lower or Work Email.
 * Table: Recruits Private. Lookup order: 1) Email Lower, 2) Name/Rep Work Email Final (from Recruit ID Analysis Link).
 * Login and sync are only allowed when a record matches one of these columns.
 */

const RAW_BASE_ID = process.env.AIRTABLE_BASE_ID?.trim() ?? "";
// Base ID in API: with "app" prefix to match URL (https://airtable.com/appKVhLzI2bcHulQc/...)
const BASE_ID = RAW_BASE_ID ? (RAW_BASE_ID.startsWith("app") ? RAW_BASE_ID : `app${RAW_BASE_ID}`) : "";
const API_KEY = process.env.AIRTABLE_API_KEY?.trim() ?? "";
// Prefer table ID (tbl...) from your URL to avoid 403 "model not found" with table name
const RECRUITS_TABLE = process.env.AIRTABLE_RECRUITS_TABLE?.trim() || "Recruits Private";

// Airtable field names in your Recruits Private table
const FIELD_EMAIL = process.env.AIRTABLE_FIELD_EMAIL || "Email Lower";
const FIELD_WORK_EMAIL = process.env.AIRTABLE_FIELD_WORK_EMAIL || "Name/Rep Work Email Final (from Recruit ID Analysis Link)";
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

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function encodeFormulaForField(fieldName: string, email: string): string {
  const normalized = normalizedEmail(email);
  const escaped = normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `{${fieldName}}='${escaped}'`;
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

/** Fetch first record matching the given filter formula. */
async function fetchRecruitByFormula(formula: string): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(RECRUITS_TABLE)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
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
  return data.records?.[0] ?? null;
}

function recordToRecruit(record: { id: string; fields: Record<string, unknown> }, loginEmail: string): RecruitRecord {
  const fields = record.fields;
  const name = getFieldValue(fields, FIELD_NAME, "Full Name", "Name", "full name", "name");
  const emailVal = getFieldValue(fields, FIELD_EMAIL, "Email Lower", "Email", "email lower", "email");
  const bank = getFieldValue(fields, FIELD_BANK, "Bank Name", "Bank", "bank name", "bank");
  const account = getFieldValue(fields, FIELD_ACCOUNT, "Account Number", "Account", "account number", "account");
  const routing = getFieldValue(fields, FIELD_ROUTING, "Routing Number", "Routing", "routing number", "routing");
  return {
    id: record.id,
    name,
    email: emailVal || loginEmail,
    bank,
    account,
    routing,
  };
}

/**
 * Fetch the first Recruits record where the login email matches.
 * Lookup order: 1) Email Lower, 2) Name/Rep Work Email Final (from Recruit ID Analysis Link).
 * If neither matches, returns null (user cannot login or sync).
 */
export async function getRecruitByEmail(email: string): Promise<RecruitRecord | null> {
  const log = (msg: string, ...args: unknown[]) => console.log("[Airtable]", msg, ...args);
  if (!BASE_ID || !API_KEY) {
    log("getRecruitByEmail skipped: missing BASE_ID or API_KEY", { hasBase: !!BASE_ID, hasKey: !!API_KEY, keyLength: API_KEY?.length ?? 0 });
    return null;
  }
  const normalized = normalizedEmail(email);
  log("fetching recruit", { email: normalized, table: RECRUITS_TABLE });

  // 1) Try Email Lower first
  const formulaEmailLower = encodeFormulaForField(FIELD_EMAIL, email);
  let record = await fetchRecruitByFormula(formulaEmailLower);
  if (record) {
    log("match on Email Lower", { recordId: record.id });
    log("record fields (exact keys from Airtable):", Object.keys(record.fields));
    return recordToRecruit(record, normalized);
  }

  // 2) If no match, try Name/Rep Work Email Final (from Recruit ID Analysis Link)
  const formulaWorkEmail = encodeFormulaForField(FIELD_WORK_EMAIL, email);
  record = await fetchRecruitByFormula(formulaWorkEmail);
  if (record) {
    log("match on Name/Rep Work Email Final", { recordId: record.id });
    log("record fields (exact keys from Airtable):", Object.keys(record.fields));
    return recordToRecruit(record, normalized);
  }

  log("no record found for this email (checked Email Lower and Name/Rep Work Email Final)");
  return null;
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
