import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET or SESSION_SECRET must be set (min 16 chars)");
  }
  return secret;
}

function encodePayload(payload: { email: string }): string {
  const json = JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  return Buffer.from(json, "utf8").toString("base64url");
}

function decodePayload(token: string): { email: string; exp: number } | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const data = JSON.parse(json) as { email: string; exp: number };
    if (typeof data.email !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function sign(payloadBase64: string): string {
  const secret = getSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(payloadBase64);
  return hmac.digest("base64url");
}

function verify(payloadBase64: string, signature: string): boolean {
  const expected = sign(payloadBase64);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function createSession(email: string): string {
  const payload = encodePayload({ email: email.trim().toLowerCase() });
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function getSession(token: string): { email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!verify(payload, signature)) return null;
  return decodePayload(payload);
}

export async function setSessionCookie(email: string): Promise<string> {
  const token = createSession(email);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return token;
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionFromCookie(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSession(token);
}
