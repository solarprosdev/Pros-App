import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local since this runs outside of Next.js
const envPath = resolve(import.meta.dirname ?? __dirname, "..", ".env.local");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error(`Could not read ${envPath}`);
}

const API_KEY = process.env.SENDGRID_API_KEY;
const DOMAIN = "solarpros.io";

if (!API_KEY) {
  console.error("SENDGRID_API_KEY not found. Make sure .env.local is loaded.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

type SuppressionEntry = { email: string; created: number; reason?: string; status?: string };

async function fetchAll(list: string): Promise<SuppressionEntry[]> {
  const all: SuppressionEntry[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const res = await fetch(
      `https://api.sendgrid.com/v3/suppression/${list}?limit=${limit}&offset=${offset}`,
      { headers }
    );
    if (!res.ok) {
      console.error(`  Failed to fetch ${list} (HTTP ${res.status}):`, await res.text());
      break;
    }
    const batch: SuppressionEntry[] = await res.json();
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return all;
}

async function deleteEntry(list: string, email: string): Promise<boolean> {
  const res = await fetch(
    `https://api.sendgrid.com/v3/suppression/${list}/${encodeURIComponent(email)}`,
    { method: "DELETE", headers }
  );
  return res.ok || res.status === 404;
}

async function clearList(list: string) {
  console.log(`\n--- ${list.toUpperCase()} ---`);

  const entries = await fetchAll(list);
  const matches = entries.filter((e) => e.email.endsWith(`@${DOMAIN}`));

  console.log(`  Total entries: ${entries.length}`);
  console.log(`  @${DOMAIN} entries: ${matches.length}`);

  if (matches.length === 0) {
    console.log("  Nothing to clear.");
    return 0;
  }

  let removed = 0;
  for (const entry of matches) {
    const ok = await deleteEntry(list, entry.email);
    if (ok) {
      removed++;
      console.log(`  ✓ Removed: ${entry.email}${entry.reason ? ` (reason: ${entry.reason})` : ""}`);
    } else {
      console.log(`  ✗ Failed:  ${entry.email}`);
    }
  }

  console.log(`  Removed ${removed}/${matches.length}`);
  return removed;
}

async function main() {
  console.log(`Clearing all @${DOMAIN} addresses from SendGrid suppression lists...\n`);

  let total = 0;
  for (const list of ["bounces", "blocks", "spam_reports"]) {
    total += await clearList(list);
  }

  console.log(`\nDone. Removed ${total} total suppression entries.`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
