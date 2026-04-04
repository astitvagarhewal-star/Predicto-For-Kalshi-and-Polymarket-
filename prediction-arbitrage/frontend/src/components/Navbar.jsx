import { BarChart3, Bookmark, Calculator, LayoutDashboard, Settings } from "lucide-react";

const TAB_CONFIG = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "watchlist", label: "Watchlist", icon: Bookmark },
  { key: "calculator", label: "Calculator", icon: Calculator },
  { key: "settings", label: "Settings", icon: Settings },
];

function Navbar({ activeTab, onTabChange, quickSearch, onQuickSearch }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0B1221]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-pa-text">Prediction Arbitrage</p>
            <p className="text-xs text-pa-muted">Trader cockpit for Polymarket + Kalshi mispricing</p>
          </div>

          <input
            type="text"
            value={quickSearch}
            onChange={(event) => onQuickSearch(event.target.value)}
            placeholder="Find market or paste link..."
            className="w-full rounded-lg border border-slate-700 bg-pa-card px-3 py-2 text-sm text-pa-text outline-none transition focus:border-pa-blue lg:max-w-md"
            aria-label="Search markets"
          />
        </div>

        <nav className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  activeTab === tab.key
                    ? "border-pa-blue bg-pa-blue/20 text-pa-text"
                    : "border-slate-700 bg-pa-card text-pa-muted hover:border-pa-blue hover:text-pa-text"
                }`}
                aria-label={`Switch to ${tab.label} tab`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
