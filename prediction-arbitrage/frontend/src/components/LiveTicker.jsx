import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPercent } from "../utils/priceFormatter";

function TrendIcon({ trend }) {
  if (trend === "up") {
    return <ArrowUpRight size={14} className="text-pa-green" aria-hidden="true" />;
  }

  if (trend === "down") {
    return <ArrowDownRight size={14} className="text-pa-red" aria-hidden="true" />;
  }

  return <Minus size={14} className="text-pa-muted" aria-hidden="true" />;
}

function TickerItem({ opportunity, trend }) {
  return (
    <div className="mr-3 inline-flex min-w-[280px] items-center gap-2 rounded-lg border border-slate-700 bg-pa-card px-3 py-2 text-xs">
      <span className="max-w-[110px] truncate text-pa-text">{opportunity.name}</span>
      <span className="font-mono text-pa-muted">B {formatPercent(opportunity.bestBid)}</span>
      <span className="font-mono text-pa-muted">A {formatPercent(opportunity.bestAsk)}</span>
      <span className="font-semibold text-pa-green">{formatPercent(opportunity.edge)}</span>
      <TrendIcon trend={trend} />
    </div>
  );
}

function LiveTicker({ opportunities, trendByKey }) {
  const top = opportunities.slice(0, 10);

  if (top.length === 0) {
    return null;
  }

  const doubled = [...top, ...top];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#111b31] p-2">
      <div className="inline-flex w-[200%] animate-marquee whitespace-nowrap">
        {doubled.map((opportunity, index) => {
          const key = `${opportunity.market}:${opportunity.id}`;
          return (
            <TickerItem
              key={`${key}-${index}`}
              opportunity={opportunity}
              trend={trendByKey[key] || "flat"}
            />
          );
        })}
      </div>
    </section>
  );
}

export default LiveTicker;
