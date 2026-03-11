"use client";

export type AppSection = "order-cards" | "direct-deposit";

const NAV_ITEMS: { id: AppSection; label: string; icon: string }[] = [
  { id: "order-cards", label: "Order Cards & Badge", icon: "🛒" },
  { id: "direct-deposit", label: "Direct Deposit Info", icon: "👤" },
];

interface AppNavProps {
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
  onClose?: () => void;
  userEmail: string;
  /** When true, render as overlay drawer (mobile); otherwise inline sidebar (web) */
  isDrawer?: boolean;
}

export function AppNav({ activeSection, onSelect, onClose, userEmail, isDrawer }: AppNavProps) {
  const base = "flex flex-col h-full bg-[#171717] text-white";
  const padding = "px-4 sm:px-5";
  const nav = (
    <>
      <div className={`flex items-center justify-between ${padding} pt-4 pb-4`}>
        <span className="text-xl font-bold tracking-tight">PROS</span>
        {isDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Close menu"
          >
            <span className="text-xl font-light">×</span>
          </button>
        )}
      </div>
      <nav className={`flex-1 ${padding}`}>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(id);
                  onClose?.();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                  activeSection === id
                    ? "bg-[#420000] text-white"
                    : "text-white/90 hover:bg-white/10"
                }`}
              >
                <span className="text-lg" aria-hidden>{icon}</span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={`${padding} pb-6 pt-4 border-t border-white/10 flex items-center justify-between gap-2`}>
        <span className="truncate text-sm text-white/80">{userEmail}</span>
      </div>
    </>
  );

  if (isDrawer) {
    return (
      <div className={`${base} w-[min(280px,85vw)] shadow-xl`}>
        {nav}
      </div>
    );
  }

  return (
    <aside className={`${base} w-56 shrink-0 py-4`}>
      {nav}
    </aside>
  );
}
