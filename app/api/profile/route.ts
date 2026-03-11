import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";
import { getProfile, setProfile, type UserProfile } from "@/lib/profile-store";
import { getRecruitByEmail, isAirtableConfigured } from "@/lib/airtable";

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
        return NextResponse.json({ ...payload, _debug: { source: "airtable", airtableConfigured: true } });
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
  return NextResponse.json({ ...data, _debug: debug });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: Partial<UserProfile>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updated = setProfile(session.email, {
    bank: typeof body.bank === "string" ? body.bank : undefined,
    account: typeof body.account === "string" ? body.account : undefined,
    routing: typeof body.routing === "string" ? body.routing : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
  });

  // Send to Make.com webhook (structure: Bank, Account, Routing, Email, First – First = name without last word)
  const webhookUrl = process.env.MAKE_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const nameParts = (updated.name || "").trim().split(/\s+/).filter(Boolean);
      const firstOnly = nameParts.slice(0, -1).join(" ");
      const makePayload = {
        Bank: updated.bank,
        Account: updated.account,
        Routing: updated.routing,
        Email: updated.email,
        First: firstOnly,
      };
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePayload),
      });
      if (!webhookRes.ok) {
        console.error("[Profile POST] Make.com webhook error", webhookRes.status, await webhookRes.text());
      }
    } catch (err) {
      console.error("[Profile POST] Make.com webhook failed", err);
    }
  }

  return NextResponse.json(updated);
}
