"use client";

export type AppSection = "order-cards" | "direct-deposit";

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ReactNode;
}

const CardIcon = () => (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const DepositIcon = () => (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: "order-cards", label: "Order Cards & Badge", icon: <CardIcon /> },
  { id: "direct-deposit", label: "Direct Deposit Info", icon: <DepositIcon /> },
];

interface AppNavProps {
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
  onClose?: () => void;
  userEmail: string;
  isDrawer?: boolean;
}

export function AppNav({ activeSection, onSelect, onClose, userEmail, isDrawer }: AppNavProps) {
  const nav = (
    <div className="flex flex-col h-full bg-[#0f0f0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <img src="/pros-app-logo.webp" alt="Pros App" className="h-7 w-7 object-contain" />
          <span className="text-sm font-bold tracking-wide text-white">Pros App</span>
        </div>
        {isDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors focus:outline-none"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Menu</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon }) => {
            const active = activeSection === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => { onSelect(id); onClose?.(); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#cc0000] text-white"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className={active ? "text-white" : "text-zinc-500"}>{icon}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <p className="truncate text-xs text-zinc-500">{userEmail}</p>
      </div>
    </div>
  );

  if (isDrawer) {
    return (
      <div className="w-[min(272px,82vw)] h-full shadow-2xl">
        {nav}
      </div>
    );
  }

  return (
    <aside className="w-56 shrink-0 h-full">
      {nav}
    </aside>
  );
}
