import { Pin, PinOff, Trash2 } from "lucide-react";
import { formatPercent } from "../utils/priceFormatter";

function SmartWatchlist({ watchlist, opportunities, onTogglePin, onSetAlertPrice, onRemove }) {
  const latestByKey = new Map(
    opportunities.map((opportunity) => [`${opportunity.market}:${opportunity.id}`, opportunity])
  );

  if (watchlist.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
        <p className="text-lg font-semibold text-pa-text">Smart Watchlist</p>
        <p className="mt-2 text-sm text-pa-muted">
          No markets yet. Add markets from the analyzer or dashboard cards.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="mb-3 text-lg font-semibold text-pa-text">Smart Watchlist</p>

      <div className="space-y-3">
        {watchlist.map((item) => {
          const key = `${item.market}:${item.id}`;
          const latest = latestByKey.get(key) || item;
          const alertTriggered =
            item.alertPrice !== null && Number(latest.bestBid || 0) >= Number(item.alertPrice);

          return (
            <article key={key} className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="line-clamp-2 text-sm font-semibold text-pa-text">{latest.name}</p>
                  <p className="text-xs text-pa-muted">{latest.market}</p>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onTogglePin(key)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-pa-text"
                    aria-label="Pin market"
                  >
                    {item.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(latest)}
                    className="rounded-md border border-pa-red/40 px-2 py-1 text-xs text-pa-red"
                    aria-label="Remove market"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-pa-muted md:grid-cols-4">
                <p>Bid: <span className="font-mono text-pa-text">{formatPercent(latest.bestBid)}</span></p>
                <p>Ask: <span className="font-mono text-pa-text">{formatPercent(latest.bestAsk)}</span></p>
                <p>Edge: <span className="font-mono text-pa-green">{formatPercent(latest.edge)}</span></p>
                <p>
                  Alert: <span className={`font-mono ${alertTriggered ? "text-pa-gold" : "text-pa-text"}`}>
                    {item.alertPrice !== null ? formatPercent(item.alertPrice) : "None"}
                  </span>
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-xs text-pa-muted">Notify when bid &gt;</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={item.alertPrice ?? ""}
                  onBlur={(event) => onSetAlertPrice(key, event.target.value)}
                  className="w-24 rounded-md border border-slate-600 bg-pa-card px-2 py-1 text-xs text-pa-text outline-none"
                />
                {alertTriggered ? (
                  <span className="rounded-md border border-pa-gold/40 bg-pa-gold/10 px-2 py-1 text-xs text-pa-gold">
                    Alert triggered
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default SmartWatchlist;
