"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { AuthHeader } from "@/components/AuthHeader";
import { AppNav, type AppSection } from "@/components/AppNav";

interface ProfileData {
  bank: string;
  account: string;
  routing: string;
  email: string;
  name: string;
}

const empty: ProfileData = {
  bank: "",
  account: "",
  routing: "",
  email: "",
  name: "",
};

const FIELDS: { key: keyof ProfileData; label: string }[] = [
  { key: "bank", label: "Bank Name" },
  { key: "account", label: "Account Number" },
  { key: "routing", label: "Routing Number" },
  { key: "email", label: "Email" },
  { key: "name", label: "Full Name" },
];

export default function Home() {
  const { user, loading: authLoading, sendCode, verifyCode } = useAuth();
  const [data, setData] = useState<ProfileData>(empty);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("direct-deposit");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sign-in state (when not logged in)
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store", credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setData({ ...empty, email: user.email });
          setProfileLoading(false);
          return;
        }
        setData({
          bank: typeof json.bank === "string" ? json.bank : "",
          account: typeof json.account === "string" ? json.account : "",
          routing: typeof json.routing === "string" ? json.routing : "",
          email: typeof json.email === "string" ? json.email : user.email,
          name: typeof json.name === "string" ? json.name : "",
        });
      } catch {
        if (!cancelled) setData({ ...empty, email: user.email });
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: json.error || "Failed to save" });
        return;
      }
      setData({ ...empty, ...json });
      setMessage({ type: "ok", text: "Saved." });
      setIsEditing(false);
    } catch {
      setMessage({ type: "err", text: "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      await sendCode(email);
      setStep("code");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      await verifyCode(email, code);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  // Not signed in: show sign-in page (no separate "home" or "Go to Login")
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-4">
        <span className="text-2xl font-bold text-[#420000]">Pros App</span>
        <Image
          src="/pros-app-logo.webp"
          alt="Pros App"
          width={160}
          height={80}
          className="object-contain"
          priority
        />
        <h1 className="text-2xl font-semibold text-[#171717]">
          Sign in
        </h1>
        <p className="text-center text-zinc-600">
          {step === "email"
            ? "Enter your email to receive a one-time login code."
            : "Enter the 7-character code we sent to your email."}
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="flex w-full max-w-sm flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-[#420000] focus:outline-none focus:ring-1 focus:ring-[#420000]"
                placeholder="you@solarpros.io"
              />
            </div>
            {loginError && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#420000] px-4 py-3 font-medium text-white transition hover:bg-[#5a0000] disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="flex w-full max-w-sm flex-col gap-4">
            <p className="text-sm text-zinc-500">Code sent to {email}</p>
            <div>
              <label htmlFor="code" className="mb-1 block text-sm font-medium text-zinc-700">
                Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 7))}
                required
                maxLength={7}
                autoComplete="one-time-code"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-lg tracking-widest text-zinc-900 placeholder-zinc-400 focus:border-[#420000] focus:outline-none focus:ring-1 focus:ring-[#420000]"
                placeholder="XXXXXXX"
              />
            </div>
            {loginError && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#420000] px-4 py-3 font-medium text-white transition hover:bg-[#5a0000] disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify and sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setLoginError(""); }}
              className="text-sm text-zinc-500 underline hover:text-zinc-700"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    );
  }

  // Signed in: app with nav (mobile drawer + web sidebar)
  const nav = (
    <AppNav
      activeSection={activeSection}
      onSelect={setActiveSection}
      onClose={() => setDrawerOpen(false)}
      userEmail={user.email}
      isDrawer
    />
  );
  const sidebar = (
    <AppNav
      activeSection={activeSection}
      onSelect={setActiveSection}
      userEmail={user.email}
    />
  );

  const directDepositContent = (
    <>
      {profileLoading ? (
        <p className="text-zinc-400 text-lg">Loading your info…</p>
      ) : isEditing ? (
        <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-5 mx-auto">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={key} className="mb-1.5 block text-base font-medium text-zinc-300">
                {label}
              </label>
              <input
                id={key}
                type={key === "email" ? "email" : "text"}
                value={data[key]}
                onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-base text-white placeholder-zinc-500 focus:border-[#420000] focus:outline-none focus:ring-1 focus:ring-[#420000]"
              />
            </div>
          ))}
          {message && (
            <p
              className={
                message.type === "ok"
                  ? "text-base text-green-400"
                  : "text-base text-red-400"
              }
            >
              {message.text}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#420000] px-5 py-3 text-base font-medium text-white transition hover:bg-[#5a0000] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setMessage(null);
              }}
              className="rounded-lg border border-zinc-600 px-5 py-3 text-base font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex w-full max-w-md flex-col gap-5 mx-auto">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="border-b border-zinc-700 pb-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-400">{label}</p>
              <p className="mt-1 text-lg font-medium text-zinc-200">
                {data[key] || "—"}
              </p>
            </div>
          ))}
          {message && (
            <p className="text-base text-green-400">{message.text}</p>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="mt-2 w-fit rounded-lg bg-[#420000] px-5 py-2.5 text-base font-medium text-white transition hover:bg-[#5a0000]"
          >
            Edit
          </button>
        </div>
      )}
    </>
  );

  const ORDER_BADGE_URL = "https://solarproslocker.com/products/id-badge";
  const ORDER_BUSINESS_CARDS_URL = "https://solarproslocker.com/collections/all-products/products/business-cards";

  const orderCardsContent = (
    <div className="flex w-full max-w-md flex-col gap-5 mx-auto">
      <p className="text-zinc-200">
        ID Badges and business cards are now available through the Pros Locker.
      </p>
      <p className="text-zinc-400 text-sm">
        Badges are exempt from shipping costs and can be expected within 6 business days.
      </p>
      <p className="text-zinc-500 text-xs">
        *Badges and Business cards will ship separately from other items ordered on the Locker.
      </p>
      <div className="flex flex-col gap-3 pt-2">
        <a
          href={ORDER_BADGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#420000] px-4 py-3.5 font-medium text-white transition hover:bg-[#5a0000]"
        >
          Order Badge Now
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a
          href={ORDER_BUSINESS_CARDS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#420000] px-4 py-3.5 font-medium text-white transition hover:bg-[#5a0000]"
        >
          Order Business Cards
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#171717]">
      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative z-10 flex flex-col">
            {nav}
          </div>
        </div>
      )}

      <header className="bg-[#420000] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40 md:hidden"
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Image
              src="/pros-app-logo.webp"
              alt="Pros App"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-lg font-semibold text-white">Pros App</span>
          </div>
          <AuthHeader />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-5rem)]">
        {/* Web: left sidebar */}
        <div className="hidden md:block border-r border-zinc-800 bg-[#171717]">
          {sidebar}
        </div>

        <main className="flex flex-1 flex-col items-center justify-start w-full bg-[#171717] px-4 py-6 sm:px-6 pt-6 overflow-auto">
          {activeSection === "direct-deposit" ? directDepositContent : orderCardsContent}
        </main>
      </div>
    </div>
  );
}
