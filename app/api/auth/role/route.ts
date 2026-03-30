import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;

  if (!projectId || !apiKey) {
    console.warn("[Role] Firebase env vars not set");
    return NextResponse.json({ isAdmin: false });
  }

  const email = session.email.trim().toLowerCase();

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
              value: { stringValue: email },
            },
          },
          limit: 1,
        },
      }),
      cache: "no-store",
    });

    const data = await res.json() as Array<{ document?: { fields?: { role?: { stringValue?: string } } } }>;
    console.log("[Role] Firestore response for", email, ":", JSON.stringify(data));

    const role = data[0]?.document?.fields?.role?.stringValue ?? "";
    const isAdmin = role === "Admin";
    console.log("[Role] role:", role, "| isAdmin:", isAdmin);

    return NextResponse.json({ isAdmin });
  } catch (err) {
    console.error("[Role] Firestore REST error:", err);
    return NextResponse.json({ isAdmin: false });
  }
}
