import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Dashboard from "./components/Dashboard";
import ErrorBoundary from "./components/ErrorBoundary";
import LiveTicker from "./components/LiveTicker";
import MarketLinkAnalyzer from "./components/MarketLinkAnalyzer";
import Navbar from "./components/Navbar";
import SmartWatchlist from "./components/SmartWatchlist";
import SourceStatusPanel from "./components/SourceStatusPanel";
import Stats from "./components/Stats";
import {
  useFetchOpportunities,
  useFetchOpportunityHistory,
} from "./hooks/useFetchOpportunities";
import { useWatchlist } from "./hooks/useWatchlist";

const EdgeLandscape3D = lazy(() => import("./components/EdgeLandscape3D"));
const OpportunityHeatmap = lazy(() => import("./components/OpportunityHeatmap"));
const AnalyticsTab = lazy(() => import("./components/AnalyticsTab"));
const ProfitCalculator = lazy(() => import("./components/ProfitCalculator"));

const SEARCH_DEBOUNCE_MS = 350;
const MIN_EDGE_VALUES = new Set([0, 2, 5, 10]);
const MARKET_VALUES = new Set(["all", "polymarket", "kalshi"]);
const SORT_VALUES = new Set(["profitPotential", "edge", "volume", "spread"]);
const LIMIT_VALUES = new Set([25, 50, 100, 200]);

const DEFAULT_FILTERS = {
  minEdge: 0,
  sortBy: "edge",
  search: "",
  market: "all",
  limit: 50,
};

function sanitizeFilters(filters) {
  const rawMinEdge = Number.parseFloat(filters?.minEdge);
  const minEdge = MIN_EDGE_VALUES.has(rawMinEdge) ? rawMinEdge : DEFAULT_FILTERS.minEdge;

  const rawMarket = String(filters?.market || DEFAULT_FILTERS.market).toLowerCase();
  const market = MARKET_VALUES.has(rawMarket) ? rawMarket : DEFAULT_FILTERS.market;

  const rawSortBy = String(filters?.sortBy || DEFAULT_FILTERS.sortBy);
  const sortBy = SORT_VALUES.has(rawSortBy) ? rawSortBy : DEFAULT_FILTERS.sortBy;

  const rawLimit = Number.parseInt(filters?.limit, 10);
  const limit = LIMIT_VALUES.has(rawLimit) ? rawLimit : DEFAULT_FILTERS.limit;

  const search = String(filters?.search || "").slice(0, 120);

  return {
    minEdge,
    market,
    sortBy,
    limit,
    search,
  };
}

function parseFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeFilters({
    minEdge: params.get("minEdge"),
    market: params.get("market"),
    sortBy: params.get("sortBy"),
    limit: params.get("limit"),
    search: params.get("search") || "",
  });
}

function buildQueryString(filters) {
  const safeFilters = sanitizeFilters(filters);
  const params = new URLSearchParams();

  if (safeFilters.minEdge > 0) {
    params.set("minEdge", String(safeFilters.minEdge));
  }

  if (safeFilters.market !== DEFAULT_FILTERS.market) {
    params.set("market", safeFilters.market);
  }

  if (safeFilters.search.trim()) {
    params.set("search", safeFilters.search.trim());
  }

  if (safeFilters.sortBy !== DEFAULT_FILTERS.sortBy) {
    params.set("sortBy", safeFilters.sortBy);
  }

  if (safeFilters.limit !== DEFAULT_FILTERS.limit) {
    params.set("limit", String(safeFilters.limit));
  }

  return params.toString();
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filters, setFilters] = useState(() => parseFiltersFromUrl());
  const [quickSearch, setQuickSearch] = useState(() => parseFiltersFromUrl().search || "");
  const [comparisonIds, setComparisonIds] = useState([]);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  const {
    watchlist,
    watchlistIds,
    localVotes,
    toggleWatchlist,
    setAlertPrice,
    togglePin,
    castSentimentVote,
  } = useWatchlist();

  const {
    data: opportunitiesPayload,
    isPending: opportunitiesLoading,
    isFetching: opportunitiesFetching,
    error: opportunitiesError,
    refetch: refetchOpportunities,
  } = useFetchOpportunities(filters);

  const {
    data: historyPayload,
    isPending: historyLoading,
    refetch: refetchHistory,
  } = useFetchOpportunityHistory();

  const opportunities = useMemo(
    () => opportunitiesPayload?.opportunities ?? [],
    [opportunitiesPayload?.opportunities]
  );
  const historySeries = useMemo(
    () => historyPayload?.series ?? [],
    [historyPayload?.series]
  );
  const sourceStatus = opportunitiesPayload?.sourceStatus || null;

  const lastUpdate = opportunitiesPayload?.timestamp
    ? new Date(opportunitiesPayload.timestamp)
    : null;
  const isLive = lastUpdate ? nowTimestamp - lastUpdate.getTime() < 150000 : false;
  const refreshCountdown = lastUpdate
    ? Math.max(0, 120 - (Math.floor((nowTimestamp - lastUpdate.getTime()) / 1000) % 120))
    : 120;

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((previous) => sanitizeFilters({ ...previous, search: quickSearch.trim() }));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [quickSearch]);

  useEffect(() => {
    const queryString = buildQueryString(filters);
    const nextPath = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
    const currentPath = `${window.location.pathname}${window.location.search}`;

    if (nextPath !== currentPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, [filters]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const trendByKey = useMemo(() => {
    const nextTrend = {};

    opportunities.forEach((opportunity) => {
      const key = `${opportunity.market}:${opportunity.id}`;
      const signedEdge = Number(opportunity.signedEdge || 0);

      if (signedEdge > 0.2) {
        nextTrend[key] = "up";
      } else if (signedEdge < -0.2) {
        nextTrend[key] = "down";
      } else {
        nextTrend[key] = "flat";
      }
    });

    return nextTrend;
  }, [opportunities]);

  const handleFiltersChange = useCallback((nextValues) => {
    setFilters((previous) => sanitizeFilters({ ...previous, ...nextValues }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setQuickSearch("");
  }, []);

  const handleManualRefresh = useCallback(async () => {
    await Promise.all([refetchOpportunities(), refetchHistory()]);
  }, [refetchHistory, refetchOpportunities]);

  const handleQuickSearchChange = useCallback((value) => {
    setQuickSearch(value);
    setActiveTab("dashboard");
  }, []);

  const handleToggleComparison = useCallback((opportunity) => {
    if (!opportunity) {
      return;
    }

    const key = `${opportunity.market}:${opportunity.id}`;

    setComparisonIds((previous) => {
      if (previous.includes(key)) {
        return previous.filter((item) => item !== key);
      }

      if (previous.length >= 4) {
        return [...previous.slice(1), key];
      }

      return [...previous, key];
    });
  }, []);

  const handleSelectOpportunity = useCallback((opportunity) => {
    if (!opportunity) {
      return;
    }

    setActiveTab("dashboard");

    window.requestAnimationFrame(() => {
      const element = document.getElementById(`market-${opportunity.market}-${opportunity.id}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const renderDashboard = useMemo(
    () => (
      <section className="space-y-4">
        <MarketLinkAnalyzer
          onAddWatchlist={toggleWatchlist}
          onViewMarket={(name) => {
            setQuickSearch(name || "");
            setActiveTab("dashboard");
          }}
          localVotes={localVotes}
          onCastVote={castSentimentVote}
        />

        <LiveTicker opportunities={opportunities} trendByKey={trendByKey} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
            <Dashboard
              opportunities={opportunities}
              loading={opportunitiesLoading || opportunitiesFetching}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onResetFilters={handleResetFilters}
              onRefresh={handleManualRefresh}
              watchlistIds={watchlistIds}
              onToggleWatchlist={toggleWatchlist}
              comparisonIds={comparisonIds}
              onToggleComparison={handleToggleComparison}
            />
          </div>

          <aside className="space-y-4 xl:col-span-2 xl:sticky xl:top-24 xl:self-start">
            <Stats opportunities={opportunities} historySeries={historySeries} />
            <SourceStatusPanel sourceStatus={sourceStatus} />
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl border border-slate-700 bg-slate-800" />}>
              <EdgeLandscape3D
                opportunities={opportunities}
                onSelectOpportunity={handleSelectOpportunity}
              />
            </Suspense>
            <Suspense fallback={<div className="h-80 animate-pulse rounded-xl border border-slate-700 bg-slate-800" />}>
              <OpportunityHeatmap series={historySeries} loading={historyLoading} />
            </Suspense>
          </aside>
        </div>
      </section>
    ),
    [
      castSentimentVote,
      comparisonIds,
      filters,
      handleFiltersChange,
      handleManualRefresh,
      handleResetFilters,
      handleSelectOpportunity,
      handleToggleComparison,
      historyLoading,
      historySeries,
      localVotes,
      opportunities,
      opportunitiesFetching,
      opportunitiesLoading,
      sourceStatus,
      toggleWatchlist,
      trendByKey,
      watchlistIds,
    ]
  );

  return (
    <div className="min-h-screen bg-pa-bg text-pa-text">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        quickSearch={quickSearch}
        onQuickSearch={handleQuickSearchChange}
      />

      <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-pa-card px-4 py-3 text-xs">
          <div className="flex items-center gap-3 text-pa-muted">
            <span>
              Last update: <span className="text-pa-text">{lastUpdate ? lastUpdate.toLocaleString() : "Waiting..."}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${isLive ? "bg-pa-green" : "bg-pa-red"}`} />
              {isLive ? "Live" : "Stale"}
            </span>
            <span>Next refresh in {refreshCountdown}s</span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={opportunitiesFetching}
            className="inline-flex items-center gap-1 rounded-lg border border-pa-blue bg-pa-blue px-3 py-1.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={opportunitiesFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {opportunitiesError ? (
          <div className="mb-4 rounded-lg border border-pa-red/40 bg-pa-red/10 px-4 py-3 text-sm text-pa-red">
            Failed to fetch opportunities: {opportunitiesError.message}
          </div>
        ) : null}

        <ErrorBoundary>
          {activeTab === "dashboard" ? renderDashboard : null}

          {activeTab === "analytics" ? (
            <Suspense fallback={<div className="h-80 animate-pulse rounded-xl border border-slate-700 bg-slate-800" />}>
              <AnalyticsTab opportunities={opportunities} historySeries={historySeries} />
            </Suspense>
          ) : null}

          {activeTab === "watchlist" ? (
            <SmartWatchlist
              watchlist={watchlist}
              opportunities={opportunities}
              onTogglePin={togglePin}
              onSetAlertPrice={setAlertPrice}
              onRemove={toggleWatchlist}
            />
          ) : null}

          {activeTab === "calculator" ? (
            <Suspense fallback={<div className="h-80 animate-pulse rounded-xl border border-slate-700 bg-slate-800" />}>
              <ProfitCalculator opportunities={opportunities} defaultSearch={quickSearch} />
            </Suspense>
          ) : null}

          {activeTab === "settings" ? (
            <section className="rounded-2xl border border-slate-700 bg-pa-card p-5">
              <p className="text-lg font-semibold text-pa-text">Settings</p>
              <p className="mt-2 text-sm text-pa-muted">
                MVP mode is active: no account required. Preferences persist in local storage.
              </p>
            </section>
          ) : null}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
