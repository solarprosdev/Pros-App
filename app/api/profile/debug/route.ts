import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";
import { fetchProfileFromBubble, isBubbleConfigured } from "@/lib/bubble";

/**
 * GET /api/profile/debug — Bubble-only (Airtable is not used for profile sync).
 */
export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({
      ok: false,
      error: "Not signed in",
      email: null,
      bubbleConfigured: isBubbleConfigured(),
      recordFound: false,
    });
  }
  const email = session.email;
  const bubbleConfigured = isBubbleConfigured();
  let recordFound = false;
  let recordPreview: Record<string, string> | null = null;
  let source: "bubble" | null = null;
  let bubbleError: string | undefined;

  if (bubbleConfigured) {
    try {
      const bubble = await fetchProfileFromBubble(email);
      if (bubble) {
        recordFound = true;
        source = "bubble";
        recordPreview = {
          email: bubble.email,
          bank: bubble.bank,
          account: bubble.account,
          routing: bubble.routing,
          firstName: bubble.firstName,
          middleName: bubble.middleName,
          lastName: bubble.lastName,
        };
      }
    } catch (e) {
      bubbleError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    ok: true,
    email,
    emailLower: email.trim().toLowerCase(),
    bubbleConfigured,
    source,
    recordFound,
    recordPreview,
    ...(bubbleError ? { bubbleError } : {}),
  });
}
