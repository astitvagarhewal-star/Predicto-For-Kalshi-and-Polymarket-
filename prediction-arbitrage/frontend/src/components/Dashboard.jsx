import { AnimatePresence } from "framer-motion";
import ComparisonMode from "./ComparisonMode";
import Filters from "./Filters";
import OpportunityCard from "./OpportunityCard";

function Dashboard({
  opportunities,
  loading,
  filters,
  onFiltersChange,
  onResetFilters,
  onRefresh,
  watchlistIds,
  onToggleWatchlist,
  comparisonIds,
  onToggleComparison,
}) {
  const displayedOpportunities = Array.isArray(opportunities) ? opportunities : [];

  return (
    <section className="space-y-4">
      <Filters
        filters={filters}
        onFiltersChange={onFiltersChange}
        onResetFilters={onResetFilters}
        onRefresh={onRefresh}
        loading={loading}
      />

      <div className="rounded-xl border border-slate-700 bg-pa-card px-4 py-3 text-sm text-pa-muted">
        Showing <span className="font-semibold text-pa-text">{displayedOpportunities.length}</span> opportunities with
        server-side filtering.
      </div>

      {loading && displayedOpportunities.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array.from({ length: 6 })].map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-xl border border-slate-700 bg-slate-800" />
          ))}
        </div>
      ) : displayedOpportunities.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-pa-card p-8 text-center">
          <p className="text-lg font-semibold text-pa-text">Market is fair-priced right now</p>
          <p className="mt-2 text-sm text-pa-muted">
            Try adjusting filters or wait for the next refresh cycle.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {displayedOpportunities.map((opportunity) => {
              const key = `${opportunity.market}:${opportunity.id}`;

              return (
                <OpportunityCard
                  key={key}
                  opportunity={opportunity}
                  onToggleWatchlist={onToggleWatchlist}
                  isWatchlisted={watchlistIds.has(key)}
                  onToggleComparison={onToggleComparison}
                  isCompared={comparisonIds.includes(key)}
                />
              );
            })}
          </div>
        </AnimatePresence>
      )}

      <ComparisonMode
        opportunities={displayedOpportunities}
        selectedKeys={comparisonIds}
        onToggleComparison={onToggleComparison}
      />
    </section>
  );
}

export default Dashboard;
