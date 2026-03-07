import { NextResponse } from "next/server";
import { setOtp } from "@/lib/otp-store";
import { sendOtpEmail, isSendGridConfigured } from "@/lib/sendgrid";

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 7 chars, no ambiguous 0/O, 1/I

function generateCode(length: number): string {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length];
  }
  return code;
}

export async function POST(request: Request) {
  if (!isSendGridConfigured()) {
    return NextResponse.json(
      { error: "SendGrid is not configured. Set SENDGRID_API_KEY in .env.local." },
      { status: 503 }
    );
  }
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  const code = generateCode(7);
  setOtp(email, code);
  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error("SendGrid error:", err);
    return NextResponse.json(
      { error: "Failed to send email. Check SENDGRID_API_KEY and sender." },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true });
}
