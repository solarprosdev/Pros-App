import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";
import { getRecruitByEmail, isAirtableConfigured } from "@/lib/airtable";

/**
 * GET /api/profile/debug - helps verify why profile might not populate.
 * Remove or restrict in production.
 */
export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({
      ok: false,
      error: "Not signed in",
      email: null,
      airtableConfigured: isAirtableConfigured(),
      recordFound: false,
    });
  }
  const email = session.email;
  const airtableConfigured = isAirtableConfigured();
  let recordFound = false;
  let recordPreview: Record<string, string> | null = null;
  if (airtableConfigured) {
    const recruit = await getRecruitByEmail(email);
    if (recruit) {
      recordFound = true;
      recordPreview = {
        name: recruit.name,
        email: recruit.email,
        bank: recruit.bank,
        account: recruit.account,
        routing: recruit.routing,
      };
    }
  }
  return NextResponse.json({
    ok: true,
    email,
    emailLower: email.trim().toLowerCase(),
    airtableConfigured,
    recordFound,
    recordPreview,
  });
}
