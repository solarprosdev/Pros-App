"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function AuthHeader() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!user) return null;

  const initial = user.email.slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#cc0000] text-sm font-bold text-white transition hover:bg-[#b30000] focus:outline-none focus:ring-2 focus:ring-[#cc0000]/50"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-white/[0.08] bg-[#1a1a1a] py-1.5 shadow-2xl">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-medium text-white">
              {user.email}
            </p>
          </div>
          <div className="px-2 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); signOut(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
