/**
 * Bubble.io workflow API: fetch direct-deposit profile by login email.
 * POST workflow URL with body email=<login email> (form or JSON — both tried).
 *
 * In pros-app/.env.local set **one** of:
 * - `BUBBLE_SEARCH_URL` — full workflow URL, or
 * - `BUBBLE_WORKFLOW_URL` — same, e.g. `https://portal.solarpros.io/version-test/api/1.1/wf/search`
 *
 * Restart `next dev` after changing env.
 */

import type { UserProfile } from "@/lib/profile-store";

const LOG = "[Bubble]";

function bubbleLog(...args: unknown[]) {
  console.log(LOG, ...args);
}

function bubbleErr(...args: unknown[]) {
  console.error(LOG, ...args);
}

/** Log origin + pathname only (no query string in logs). */
function safeUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "(invalid URL)";
  }
}

function truncate(s: string, max = 2500): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated ${s.length - max} chars]`;
}

/** Resolved POST URL, or null if Bubble is not configured. */
export function getBubbleWorkflowUrl(): string | null {
  const full = process.env.BUBBLE_SEARCH_URL?.trim();
  if (full) return full;
  const base = process.env.BUBBLE_WORKFLOW_URL?.trim();
  return base || null;
}

export function isBubbleConfigured(): boolean {
  return Boolean(getBubbleWorkflowUrl());
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/** Match Bubble keys case-insensitively (API may vary). */
function pickField(obj: Record<string, unknown>, ...names: string[]): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const byNorm = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    byNorm.set(norm(k), v);
  }
  for (const n of names) {
    const v = byNorm.get(norm(n));
    if (v !== undefined && v !== null && String(v) !== "") return str(v);
  }
  return "";
}

function extractResponsePayload(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const inner = root.response;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  // Flat payload (some workflows return fields at top level)
  if (
    pickField(root, "email", "Email") ||
    pickField(root, "firstName", "first name") ||
    pickField(root, "first", "First") ||
    pickField(root, "account number", "Account number", "account") ||
    pickField(root, "bank name", "Bank name", "bank")
  ) {
    return root;
  }
  return null;
}

function isSuccessStatus(status: unknown): boolean {
  if (status === undefined || status === null) return true;
  const s = String(status).toLowerCase();
  return s === "success" || s === "ok" || s === "200";
}

function responseToProfile(payload: Record<string, unknown>, loginEmail: string): UserProfile {
  const bank = pickField(payload, "bank name", "Bank name", "bank");
  const account = pickField(payload, "account number", "Account number", "account");
  const routing = pickField(payload, "routing number", "Routing number", "routing");
  const email = pickField(payload, "email", "Email").trim() || loginEmail.trim();
  const firstName = pickField(payload, "firstName", "first name", "first", "First").trim();
  const middleName = pickField(payload, "middleName", "middle name", "middle", "Middle").trim();
  const lastName = pickField(payload, "lastName", "last name", "last", "Last").trim();
  return {
    bank,
    account,
    routing,
    email,
    firstName,
    middleName,
    lastName,
  };
}

async function postBubble(
  url: string,
  loginEmail: string,
  mode: "form" | "json"
): Promise<{ ok: boolean; status: number; rawText: string }> {
  const email = loginEmail.trim();
  bubbleLog(`request ${mode.toUpperCase()} →`, safeUrlForLog(url), "| email:", email);
  const res =
    mode === "form"
      ? await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ email }).toString(),
          cache: "no-store",
        })
      : await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          cache: "no-store",
        });
  const rawText = await res.text();
  bubbleLog(
    `response ${mode.toUpperCase()} | HTTP ${res.status} | ok=${res.ok} | body:`,
    truncate(rawText)
  );
  return { ok: res.ok, status: res.status, rawText };
}

function parseBubbleBody(
  rawText: string,
  httpStatus: number,
  httpOk: boolean,
  loginEmail: string
): UserProfile | null {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch (e) {
    bubbleErr("parse JSON failed:", e instanceof Error ? e.message : e);
    bubbleErr("raw (first 500 chars):", rawText.slice(0, 500));
    if (!httpOk) throw new Error(`Bubble HTTP ${httpStatus} (non-JSON): ${rawText.slice(0, 200)}`);
    bubbleLog("parse outcome: FAIL (not JSON)");
    return null;
  }

  bubbleLog("parsed JSON keys (root):", json && typeof json === "object" ? Object.keys(json as object) : typeof json);

  const root = json as Record<string, unknown>;
  if (!httpOk) {
    bubbleErr("HTTP not OK — throwing");
    throw new Error(`Bubble HTTP ${httpStatus}: ${rawText.slice(0, 200)}`);
  }

  const statusVal = root.status;
  if (!isSuccessStatus(statusVal)) {
    bubbleLog("parse outcome: FAIL — workflow status not success:", statusVal);
    return null;
  }

  const payload = extractResponsePayload(json);
  if (!payload) {
    bubbleLog("parse outcome: FAIL — no extractable payload (expected .response object or flat fields)");
    return null;
  }

  const profile = responseToProfile(payload, loginEmail);
  bubbleLog(
    "parse outcome: SUCCESS — mapped profile:",
    JSON.stringify({ ...profile, account: profile.account ? "[set]" : "", routing: profile.routing ? "[set]" : "" })
  );
  return profile;
}

/**
 * POST email to the Bubble workflow (form-urlencoded, then JSON if needed); maps JSON to UserProfile.
 */
export async function fetchProfileFromBubble(loginEmail: string): Promise<UserProfile | null> {
  const url = getBubbleWorkflowUrl();
  if (!url) {
    bubbleLog("fetch skipped — no URL (set BUBBLE_SEARCH_URL or BUBBLE_WORKFLOW_URL in .env.local)");
    return null;
  }

  bubbleLog("========== Bubble profile fetch START ==========");
  bubbleLog("target:", safeUrlForLog(url));

  let last = await postBubble(url, loginEmail, "form");
  let profile = parseBubbleBody(last.rawText, last.status, last.ok, loginEmail);

  if (!profile) {
    bubbleLog("FORM did not yield a profile — retrying with JSON body { email }");
    last = await postBubble(url, loginEmail, "json");
    profile = parseBubbleBody(last.rawText, last.status, last.ok, loginEmail);
  }

  if (profile) {
    bubbleLog("========== Bubble profile fetch SUCCESS ==========");
  } else {
    bubbleErr("========== Bubble profile fetch END — no profile (both FORM and JSON failed) ==========");
  }

  return profile;
}
