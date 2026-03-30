import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";
import { getLogs } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function checkIsAdmin(email: string): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!projectId || !apiKey) return false;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "users" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "email" },
              op: "EQUAL",
              value: { stringValue: email.trim().toLowerCase() },
            },
          },
          limit: 1,
        },
      }),
      cache: "no-store",
    });
    const data = (await res.json()) as Array<{
      document?: { fields?: { role?: { stringValue?: string } } };
    }>;
    return data[0]?.document?.fields?.role?.stringValue === "Admin";
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const isAdmin = await checkIsAdmin(session.email);
  if (!isAdmin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const logs = await getLogs(200);
  return NextResponse.json(
    { logs },
    { headers: { "Cache-Control": "no-store" } }
  );
}
