import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp-store";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }
  if (!email.endsWith("@solarpros.io")) {
    return NextResponse.json(
      { error: "Only @solarpros.io email addresses can sign in." },
      { status: 403 }
    );
  }
  if (!verifyOtp(email, code)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }
  try {
    await setSessionCookie(email);
  } catch (err) {
    console.error("Session error:", err);
    return NextResponse.json(
      { error: "Server session error. Set JWT_SECRET in .env.local." },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, email });
}
