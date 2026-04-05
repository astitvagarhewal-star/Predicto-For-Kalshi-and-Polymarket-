import { useEffect, useState } from "react";
import { buildApiUrl, fetchJson } from "../utils/api";

function heatClass(intensity) {
  if (intensity > 0.8) {
    return "bg-pa-red/80";
  }

  if (intensity > 0.6) {
    return "bg-orange-500/80";
  }

  if (intensity > 0.4) {
    return "bg-pa-gold/80";
  }

  return "bg-pa-blue/80";
}

function MarketHeatmap() {
  const [heatData, setHeatData] = useState([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchJson(buildApiUrl("/api/market-activity"));
        if (active) {
          setHeatData(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (active) {
          setHeatData([]);
        }
      }
    }

    load();
    const interval = window.setInterval(load, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="text-sm font-semibold text-pa-text">Market Heatmap</p>
      <p className="mt-1 text-xs text-pa-muted">Real-time activity intensity by 24h volume.</p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {heatData.map((market) => (
          <article key={market.id} className={`rounded-lg p-3 text-xs text-white ${heatClass(Number(market.intensity || 0))}`}>
            <p className="line-clamp-2 font-semibold">{market.name}</p>
            <p className="mt-1 opacity-90">Vol: ${(Number(market.volume24h || 0) / 1000).toFixed(0)}k</p>
            <p className="mt-1 uppercase opacity-75">{market.platform}</p>
          </article>
        ))}

        {heatData.length === 0 ? (
          <p className="text-xs text-pa-muted">No market activity data available yet.</p>
        ) : null}
      </div>
    </section>
  );
}

export default MarketHeatmap;
