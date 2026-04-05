import { useMemo, useState } from "react";
import CrowdPrediction from "./CrowdPrediction";
import MarketChat from "./MarketChat";

function CommunityHub({ opportunities }) {
  const marketOptions = useMemo(
    () => (Array.isArray(opportunities) ? opportunities.slice(0, 50) : []),
    [opportunities]
  );

  const [marketId, setMarketId] = useState("");
  const selectedMarketId = marketId || marketOptions[0]?.id || "";

  const selectedMarket = marketOptions.find((item) => String(item.id) === String(selectedMarketId));

  if (marketOptions.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-pa-card p-4 text-xs text-pa-muted">
        No live markets available yet. Community chat unlocks once opportunities load.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-pa-card p-4">
        <p className="text-sm font-semibold text-pa-text">Community Hub</p>
        <p className="mt-1 text-xs text-pa-muted">Live discussions + crowd-driven market probability curve.</p>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-pa-muted">Select market</label>
          <select
            value={selectedMarketId}
            onChange={(event) => setMarketId(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
          >
            {marketOptions.map((market) => (
              <option key={market.id} value={market.id}>
                {market.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MarketChat marketId={selectedMarketId} marketName={selectedMarket?.name} />
        <CrowdPrediction marketId={selectedMarketId} />
      </div>
    </section>
  );
}

export default CommunityHub;
