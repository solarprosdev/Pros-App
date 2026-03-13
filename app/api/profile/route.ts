import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";
import { getProfile, setProfile, type UserProfile } from "@/lib/profile-store";
import { getRecruitByEmail, isAirtableConfigured } from "@/lib/airtable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toProfile(recruit: { name: string; email: string; bank: string; account: string; routing: string }): UserProfile {
  return {
    name: recruit.name,
    email: recruit.email,
    bank: recruit.bank,
    account: recruit.account,
    routing: recruit.routing,
  };
}

export async function GET() {
  const log = (msg: string, ...args: unknown[]) => console.log("[Profile GET]", msg, ...args);
  const session = await getSessionFromCookie();
  if (!session) {
    log("no session – 401");
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  log("session email:", session.email);
  const configured = isAirtableConfigured();
  log("Airtable configured:", configured);

  let debug: { source: string; airtableConfigured: boolean; error?: string } = {
    source: "memory",
    airtableConfigured: configured,
  };

  if (configured) {
    try {
      const recruit = await getRecruitByEmail(session.email);
      log("recruit from Airtable:", recruit ? "found" : "null");
      if (recruit) {
        const payload = toProfile(recruit);
        log("returning Airtable profile");
        return NextResponse.json(
          { ...payload, _debug: { source: "airtable", airtableConfigured: true } },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
        );
      }
      debug.error = "No Airtable record found for this email (Email Lower or Name/Rep Work Email Final).";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("Airtable error:", message);
      debug.error = message;
    }
  } else {
    debug.error = "AIRTABLE_API_KEY or AIRTABLE_BASE_ID not set in .env.local.";
  }

  const profile = getProfile(session.email);
  const data: UserProfile = profile ?? {
    bank: "",
    account: "",
    routing: "",
    email: session.email,
    name: "",
  };
  log("returning in-memory/empty profile");
  return NextResponse.json(
    { ...data, _debug: debug },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}

export async function POST(request: Request) {
  process.stdout.write("[Profile POST] request received\n");
  console.log("[Profile POST] ========== SAVE START ==========");

  const session = await getSessionFromCookie();
  if (!session) {
    console.log("[Profile POST] abort: not signed in (401)");
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: Partial<UserProfile>;
  try {
    body = await request.json();
  } catch {
    console.log("[Profile POST] abort: invalid JSON (400)");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  console.log("[Profile POST] body keys:", Object.keys(body ?? {}));

  const updated = setProfile(session.email, {
    bank: typeof body.bank === "string" ? body.bank : undefined,
    account: typeof body.account === "string" ? body.account : undefined,
    routing: typeof body.routing === "string" ? body.routing : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
  });

  // Send to Make.com webhook (structure: Bank, Account, Routing, Email, First – First = name without last word)
  console.log("[Profile POST] ========== MAKE WEBHOOK SECTION ==========");
  const webhookUrl = process.env.MAKE_WEBHOOK_URL?.trim();
  const makeLog = (msg: string, ...args: unknown[]) => console.log("[Profile POST] [Make]", msg, ...args);
  const makeErr = (msg: string, ...args: unknown[]) => console.error("[Profile POST] [Make]", msg, ...args);

  makeLog("MAKE_WEBHOOK_URL present?", !!webhookUrl, "length:", webhookUrl?.length ?? 0);

  if (!webhookUrl) {
    makeLog("MAKE_WEBHOOK_URL is not set – skipping Make.com webhook");
  } else {
    const fullName = (updated.name || "").trim();
    const makePayload = {
      Bank: updated.bank,
      Account: updated.account,
      Routing: updated.routing,
      Email: updated.email,
      First: fullName,
    };
    makeLog("Calling Make.com webhook – payload:", JSON.stringify(makePayload, null, 2));
    try {
      makeLog("Webhook URL (host only):", new URL(webhookUrl).host);
    } catch {
      makeLog("Webhook URL:", webhookUrl.slice(0, 50) + "...");
    }

    const MAKE_TIMEOUT_MS = 60000; // 60s – wait for Make to accept (required on serverless so request completes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MAKE_TIMEOUT_MS);

    try {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePayload),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      const resText = await webhookRes.text();
      makeLog("Make.com response status:", webhookRes.status, webhookRes.statusText);
      makeLog("Make.com response body (first 500 chars):", resText.slice(0, 500));

      if (webhookRes.ok) {
        makeLog("Make.com webhook call succeeded – workflow was triggered");
      } else {
        makeErr("Make.com webhook returned error status:", webhookRes.status, resText.slice(0, 300));
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : "";
      makeErr("Make.com webhook request failed – error:", name, message);
      if (err instanceof Error && err.name === "AbortError") {
        makeErr("Request timed out after 60 seconds – check that the Make scenario is running and responds to the webhook");
      }
    }
  }

  console.log("[Profile POST] ========== SAVE END (returning 200) ==========");
  return NextResponse.json(updated);
}
