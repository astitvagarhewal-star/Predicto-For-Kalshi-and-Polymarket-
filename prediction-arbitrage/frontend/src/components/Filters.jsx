import { Activity, Clock3, Gauge, TrendingUp, Users, Zap } from "lucide-react";

const MARKET_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Polymarket", value: "polymarket" },
  { label: "Kalshi", value: "kalshi" },
];

const MIN_EDGE_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "2%", value: 2 },
  { label: "5%", value: 5 },
  { label: "10%", value: 10 },
];

const SORT_OPTIONS = [
  { label: "Profit", value: "profitPotential" },
  { label: "Edge", value: "edge" },
  { label: "Volume", value: "volume" },
  { label: "Spread", value: "spread" },
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

const PRESETS = [
  {
    label: "High Volume + Edge",
    icon: Zap,
    values: { minEdge: 10, sortBy: "volume", limit: 50 },
  },
  {
    label: "Closing in 7 days",
    icon: Clock3,
    values: { sortBy: "edge", limit: 100, search: "" },
  },
  {
    label: "Most Trending",
    icon: TrendingUp,
    values: { sortBy: "profitPotential", minEdge: 5 },
  },
  {
    label: "Crowd Disagrees",
    icon: Users,
    values: { minEdge: 5, sortBy: "edge" },
  },
  {
    label: "Low Spread",
    icon: Gauge,
    values: { sortBy: "spread", minEdge: 2 },
  },
  {
    label: "Most Volatile",
    icon: Activity,
    values: { sortBy: "edge", limit: 100 },
  },
];

function ToggleGroup({ label, options, value, onChange }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-pa-muted">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-2 text-xs transition ${
              value === option.value
                ? "border-pa-blue bg-pa-blue/20 text-pa-text"
                : "border-slate-700 bg-[#0f1b33] text-pa-muted hover:border-pa-blue"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Filters({ filters, onFiltersChange, onResetFilters, onRefresh, loading }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onFiltersChange(preset.values)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0f1b33] px-2.5 py-1.5 text-xs text-pa-muted transition hover:border-pa-blue hover:text-pa-text"
            >
              <Icon size={13} /> {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-4">
        <ToggleGroup
          label="Market"
          options={MARKET_OPTIONS}
          value={filters.market}
          onChange={(value) => onFiltersChange({ market: value })}
        />

        <ToggleGroup
          label="Min edge"
          options={MIN_EDGE_OPTIONS}
          value={filters.minEdge}
          onChange={(value) => onFiltersChange({ minEdge: value })}
        />

        <ToggleGroup
          label="Sort by"
          options={SORT_OPTIONS}
          value={filters.sortBy}
          onChange={(value) => onFiltersChange({ sortBy: value })}
        />

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-pa-muted">Result limit</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LIMIT_OPTIONS.map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => onFiltersChange({ limit })}
                className={`rounded-lg border px-3 py-2 text-xs transition ${
                  filters.limit === limit
                    ? "border-pa-blue bg-pa-blue/20 text-pa-text"
                    : "border-slate-700 bg-[#0f1b33] text-pa-muted hover:border-pa-blue"
                }`}
              >
                {limit}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-pa-blue bg-pa-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>

          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-lg border border-slate-600 bg-transparent px-4 py-2 text-sm font-semibold text-pa-muted transition hover:border-pa-blue hover:text-pa-text"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </section>
  );
}

export default Filters;
