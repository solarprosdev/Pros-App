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

  // Reset sign-in flow to email step when user signs out
  useEffect(() => {
    if (!user) {
      setStep("email");
      setEmail("");
      setCode("");
      setLoginError("");
      setBusy(false);
    }
  }, [user]);

  // Fetch profile when signed in and viewing Direct Deposit Info (sync from Airtable, no cache)
  useEffect(() => {
    if (!user || activeSection !== "direct-deposit") return;
    let cancelled = false;
    setProfileLoading(true);
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
        const profileEmail = typeof json.email === "string" ? json.email.trim().toLowerCase() : "";
        const currentUserEmail = user.email.trim().toLowerCase();
        if (profileEmail && profileEmail !== currentUserEmail) {
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
    return () => { cancelled = true; };
  }, [user, activeSection]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#cc0000]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[#0d0d0d] px-5">
        {/* Centered card */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.07] bg-[#161616] p-8 shadow-2xl">
            {/* Card header */}
            <div className="mb-7 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0d0d0d] ring-1 ring-white/[0.08]">
                <Image
                  src="/pros-app-logo.webp"
                  alt="Pros App"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Pros App</h1>
                <p className="mt-0.5 text-xs text-zinc-500 tracking-wide">Portal Login</p>
              </div>
            </div>

            {step === "email" ? (
              <form onSubmit={handleSendCode} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0d0d0d] px-4 py-3 text-sm text-white placeholder-zinc-600 transition focus:border-[#cc0000]/60 focus:outline-none focus:ring-1 focus:ring-[#cc0000]/40"
                    placeholder="you@solarpros.io"
                  />
                </div>
                {loginError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p className="text-sm text-red-400">{loginError}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b0000] px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-[#a00000] disabled:opacity-50"
                >
                  {busy ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Sending…</>
                  ) : "Get Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <div className="rounded-lg border border-white/[0.05] bg-[#0d0d0d]/60 px-4 py-2.5">
                  <p className="text-xs text-zinc-500">Code sent to</p>
                  <p className="text-sm font-medium text-white">{email}</p>
                </div>
                <div>
                  <label htmlFor="login-code" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                    Verification Code
                  </label>
                  <input
                    id="login-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 7))}
                    required
                    maxLength={7}
                    autoComplete="one-time-code"
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0d0d0d] px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-white placeholder-zinc-700 transition focus:border-[#cc0000]/60 focus:outline-none focus:ring-1 focus:ring-[#cc0000]/40"
                    placeholder="·······"
                  />
                </div>
                {loginError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p className="text-sm text-red-400">{loginError}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#8b0000] px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-[#a00000] disabled:opacity-50"
                >
                  {busy ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Verifying…</>
                  ) : "Verify & Sign In"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); setLoginError(""); }}
                  className="text-center text-xs text-zinc-600 transition hover:text-zinc-400"
                >
                  ← Use a different email
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="pb-5 text-center text-xs text-zinc-700">© {new Date().getFullYear()} Solar Pros</p>
      </div>
    );
  }

  const ORDER_BADGE_URL = "https://solarproslocker.com/products/id-badge";
  const ORDER_BUSINESS_CARDS_URL = "https://solarproslocker.com/collections/all-products/products/business-cards";

  const sectionTitle = activeSection === "direct-deposit" ? "Direct Deposit Info" : "Order Cards & Badge";

  const directDepositContent = (
    <div className="w-full max-w-lg mx-auto">
      {profileLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#cc0000]" />
        </div>
      ) : isEditing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="rounded-xl border border-white/[0.07] bg-[#161616] p-5 sm:p-6">
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Edit Information</h3>
            <div className="flex flex-col gap-4">
              {FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label htmlFor={`field-${key}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {label}
                  </label>
                  <input
                    id={`field-${key}`}
                    type={key === "email" ? "email" : "text"}
                    value={data[key]}
                    onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0d0d0d] px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-[#cc0000]/60 focus:outline-none focus:ring-1 focus:ring-[#cc0000]/40"
                  />
                </div>
              ))}
            </div>
          </div>
          {message && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${message.type === "ok" ? "border border-green-500/20 bg-green-500/10 text-green-400" : "border border-red-500/20 bg-red-500/10 text-red-400"}`}>
              {message.text}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#cc0000] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#b30000] disabled:opacity-50"
            >
              {saving ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              ) : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setMessage(null); }}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-white/[0.07] bg-[#161616] overflow-hidden">
            {FIELDS.map(({ key, label }, i) => (
              <div
                key={key}
                className={`flex flex-col gap-0.5 px-5 py-4 ${i < FIELDS.length - 1 ? "border-b border-white/[0.05]" : ""}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
                <p className="text-sm font-medium text-white">
                  {data[key] || <span className="text-zinc-600">—</span>}
                </p>
              </div>
            ))}
          </div>
          {message && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              {message.text}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Information
          </button>
        </div>
      )}
    </div>
  );

  const orderCardsContent = (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      <div className="rounded-xl border border-white/[0.07] bg-[#161616] p-5 sm:p-6">
        <p className="text-base font-medium leading-relaxed text-zinc-200">
          ID Badges and business cards are now available through the Pros Locker.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Badges are exempt from shipping costs and can be expected within 6 business days.
        </p>
        <p className="mt-3 text-xs text-zinc-600">
          *Badges and Business cards will ship separately from other items ordered on the Locker.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={ORDER_BADGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#cc0000] px-5 py-4 font-bold uppercase tracking-wide text-white transition hover:bg-[#b30000] active:scale-[0.98]"
        >
          <span className="text-sm">Order Badge Now</span>
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a
          href={ORDER_BUSINESS_CARDS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#cc0000] px-5 py-4 font-bold uppercase tracking-wide text-white transition hover:bg-[#b30000] active:scale-[0.98]"
        >
          <span className="text-sm">Order Business Cards</span>
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <p className="text-center text-xs text-zinc-600">
        *Right click to copy image if you wish to use for ID Badge.
      </p>
    </div>
  );

  return (
    <div className="relative flex min-h-screen bg-[#0d0d0d]">
      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative z-10 flex h-full flex-col">
            <AppNav
              activeSection={activeSection}
              onSelect={setActiveSection}
              onClose={() => setDrawerOpen(false)}
              userEmail={user.email}
              isDrawer
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col h-screen sticky top-0 border-r border-white/[0.06]">
        <AppNav
          activeSection={activeSection}
          onSelect={setActiveSection}
          userEmail={user.email}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0d0d0d]/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile: hamburger + logo + name */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors focus:outline-none md:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Logo + name on mobile (sidebar handles desktop) */}
            <div className="flex items-center gap-2 md:hidden">
              <Image src="/pros-app-logo.webp" alt="Pros App" width={26} height={26} className="object-contain" />
              <span className="text-sm font-bold tracking-wide text-white">Pros App</span>
            </div>
          </div>
          {/* Page title — centered on desktop, hidden on mobile */}
          <span className="hidden md:block absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-zinc-300">{sectionTitle}</span>
          <AuthHeader />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto px-4 py-7 sm:px-8 sm:py-8">
          {activeSection === "direct-deposit" ? directDepositContent : orderCardsContent}
        </main>
      </div>
    </div>
  );
}
