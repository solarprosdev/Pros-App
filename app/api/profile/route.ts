import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";
import { getProfile, setProfile, type UserProfile } from "@/lib/profile-store";
import { fetchProfileFromBubble, isBubbleConfigured } from "@/lib/bubble";
import { syncRampBankAccount, RampRoutingNumberError } from "@/lib/ramp";
import { joinFullName, parseFullName } from "@/lib/name-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const log = (msg: string, ...args: unknown[]) => console.log("[Profile GET]", msg, ...args);
  const session = await getSessionFromCookie();
  if (!session) {
    log("no session – 401");
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  log("session email:", session.email);
  const bubbleOk = isBubbleConfigured();
  log("Bubble configured:", bubbleOk);

  let fetchError: string | undefined;

  if (bubbleOk) {
    try {
      const bubbleProfile = await fetchProfileFromBubble(session.email);
      if (bubbleProfile) {
        log("returning profile from Bubble (see [Bubble] logs above for raw response)");
        return NextResponse.json(
          {
            ...bubbleProfile,
            _debug: { source: "bubble" as const, bubbleConfigured: true },
          },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
        );
      }
      fetchError = "Bubble returned no usable profile (see server logs [Bubble] for response body).";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("Bubble threw (details in [Bubble] logs):", message);
      fetchError = message;
    }
    const debug = {
      source: "memory" as const,
      bubbleConfigured: true,
      ...(fetchError ? { error: fetchError } : {}),
    };
    const profile = getProfile(session.email);
    const data: UserProfile = profile ?? {
      bank: "",
      account: "",
      routing: "",
      email: session.email,
      firstName: "",
      middleName: "",
      lastName: "",
    };
    log("Bubble configured but no profile — returning in-memory/empty");
    return NextResponse.json(
      { ...data, _debug: debug },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  }

  fetchError =
    "Bubble not configured. Set BUBBLE_SEARCH_URL or BUBBLE_WORKFLOW_URL in pros-app/.env.local and restart the server.";

  const profile = getProfile(session.email);
  const data: UserProfile = profile ?? {
    bank: "",
    account: "",
    routing: "",
    email: session.email,
    firstName: "",
    middleName: "",
    lastName: "",
  };
  log("returning in-memory/empty profile —", fetchError);
  return NextResponse.json(
    {
      ...data,
      _debug: {
        source: "memory" as const,
        bubbleConfigured: false,
        error: fetchError,
      },
    },
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

  const legacyName = typeof (body as { name?: string }).name === "string" ? (body as { name: string }).name : undefined;
  const hasNameParts =
    typeof body.firstName === "string" ||
    typeof body.middleName === "string" ||
    typeof body.lastName === "string";
  const parsedFromLegacy = legacyName !== undefined && !hasNameParts ? parseFullName(legacyName) : null;

  const incoming: Partial<UserProfile> = {
    bank: typeof body.bank === "string" ? body.bank : undefined,
    account: typeof body.account === "string" ? body.account : undefined,
    routing: typeof body.routing === "string" ? body.routing : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    firstName: hasNameParts
      ? typeof body.firstName === "string"
        ? body.firstName
        : undefined
      : parsedFromLegacy
        ? parsedFromLegacy.firstName
        : undefined,
    middleName: hasNameParts
      ? typeof body.middleName === "string"
        ? body.middleName
        : undefined
      : parsedFromLegacy
        ? parsedFromLegacy.middleName
        : undefined,
    lastName: hasNameParts
      ? typeof body.lastName === "string"
        ? body.lastName
        : undefined
      : parsedFromLegacy
        ? parsedFromLegacy.lastName
        : undefined,
  };

  // ── Step 1: Validate routing number with Ramp BEFORE saving or calling Make ──
  console.log("[Profile POST] ========== RAMP BANK SYNC SECTION (pre-save) ==========");
  const existing = getProfile(session.email);
  const mergedForRamp: UserProfile = {
    bank: incoming.bank ?? existing?.bank ?? "",
    account: incoming.account ?? existing?.account ?? "",
    routing: incoming.routing ?? existing?.routing ?? "",
    email: incoming.email ?? existing?.email ?? session.email,
    firstName: incoming.firstName ?? existing?.firstName ?? "",
    middleName: incoming.middleName ?? existing?.middleName ?? "",
    lastName: incoming.lastName ?? existing?.lastName ?? "",
  };
  const fullNameForRamp = joinFullName(mergedForRamp.firstName, mergedForRamp.middleName, mergedForRamp.lastName);
  const accountForRamp = (incoming.account || "").trim();
  const routingForRamp = (incoming.routing || "").trim();

  if (!fullNameForRamp || !accountForRamp || !routingForRamp) {
    console.log("[Profile POST] [Ramp] Missing name, account, or routing – skipping Ramp sync");
  } else {
    try {
      await syncRampBankAccount(fullNameForRamp, accountForRamp, routingForRamp);
      console.log("[Profile POST] [Ramp] Bank account sync succeeded");
    } catch (rampErr) {
      if (rampErr instanceof RampRoutingNumberError) {
        console.error("[Profile POST] [Ramp] Invalid routing number – aborting save:", rampErr.message);
        return NextResponse.json({ error: rampErr.message }, { status: 422 });
      }
      // Other Ramp errors (vendor not found, network, etc.) – log but don't block save
      const message = rampErr instanceof Error ? rampErr.message : String(rampErr);
      console.error("[Profile POST] [Ramp] Non-blocking error – continuing with save:", message);
    }
  }

  // ── Step 2: Save profile ──
  const updated = setProfile(session.email, incoming);

  // ── Step 3: Send to Make.com webhook ──
  console.log("[Profile POST] ========== MAKE WEBHOOK SECTION ==========");
  const webhookUrl = process.env.MAKE_WEBHOOK_URL?.trim();
  const makeLog = (msg: string, ...args: unknown[]) => console.log("[Profile POST] [Make]", msg, ...args);
  const makeErr = (msg: string, ...args: unknown[]) => console.error("[Profile POST] [Make]", msg, ...args);

  makeLog("MAKE_WEBHOOK_URL present?", !!webhookUrl, "length:", webhookUrl?.length ?? 0);

  if (!webhookUrl) {
    makeLog("MAKE_WEBHOOK_URL is not set – skipping Make.com webhook");
  } else {
    const makePayload = {
      Bank: updated.bank,
      Account: updated.account,
      Routing: updated.routing,
      Email: updated.email,
      First: (updated.firstName || "").trim(),
      Middle: (updated.middleName || "").trim(),
      Last: (updated.lastName || "").trim(),
    };
    makeLog("Calling Make.com webhook – payload:", JSON.stringify(makePayload, null, 2));
    try {
      makeLog("Webhook URL (host only):", new URL(webhookUrl).host);
    } catch {
      makeLog("Webhook URL:", webhookUrl.slice(0, 50) + "...");
    }

    const MAKE_TIMEOUT_MS = 60000;
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
