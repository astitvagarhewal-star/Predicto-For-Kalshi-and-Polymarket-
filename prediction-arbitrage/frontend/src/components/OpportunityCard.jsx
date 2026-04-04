import { Bookmark, GitCompareArrows, MoveUpRight } from "lucide-react";

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString();
}

function formatVolume(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return numeric.toLocaleString();
}

function OpportunityCard({
  opportunity,
  onToggleWatchlist,
  isWatchlisted,
  onToggleComparison,
  isCompared,
}) {
  const {
    id,
    name,
    market,
    bestBid,
    bestAsk,
    spread,
    volume24h,
    signedEdge,
    profitPotential,
    fairPrice,
    url,
    expirationDate,
  } = opportunity;

  const signedEdgeValue = Number(signedEdge || 0);
  const edgeColor = signedEdgeValue >= 0 ? "text-pa-green" : "text-pa-red";
  const actionText = market === "kalshi" ? "Bet on Kalshi ->" : "Bet on Polymarket ->";
  const tintClass = market === "kalshi"
    ? "from-pa-purple/15 to-transparent"
    : "from-pa-blue/15 to-transparent";

  return (
    <article
      id={`market-${market}-${id}`}
      className={`rounded-xl border border-slate-700 bg-gradient-to-br ${tintClass} bg-pa-card p-4 shadow-sm transition hover:border-pa-blue`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base font-semibold text-white">{name}</h3>
        <span className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] uppercase text-slate-300">
          {market}
        </span>
      </div>

      <div className="space-y-2 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Best Bid / Ask</span>
          <span className="font-mono font-medium text-white">{bestBid}% / {bestAsk}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fair Price</span>
          <span className="font-medium text-white">{fairPrice}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Edge</span>
          <span className={`font-semibold ${edgeColor}`}>{signedEdgeValue}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Spread Width</span>
          <span className="font-mono font-medium text-white">{spread}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Profit Potential</span>
          <span className="font-medium text-white">{Number(profitPotential || 0).toFixed(2)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Volume (24h)</span>
          <span className="font-medium text-white">{formatVolume(volume24h)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Expiration</span>
          <span className="font-medium text-white">{formatDate(expirationDate)}</span>
        </div>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-pa-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#4A90E2]"
      >
        {actionText} <MoveUpRight size={13} className="ml-1" />
      </a>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onToggleWatchlist(opportunity)}
          className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
            isWatchlisted
              ? "border-pa-gold/50 bg-pa-gold/10 text-pa-gold"
              : "border-slate-700 bg-slate-900/40 text-pa-muted hover:border-pa-blue hover:text-pa-text"
          }`}
        >
          <Bookmark size={13} /> {isWatchlisted ? "Watchlisted" : "Add Watch"}
        </button>

        <button
          type="button"
          onClick={() => onToggleComparison(opportunity)}
          className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
            isCompared
              ? "border-pa-blue/50 bg-pa-blue/10 text-pa-blue"
              : "border-slate-700 bg-slate-900/40 text-pa-muted hover:border-pa-blue hover:text-pa-text"
          }`}
        >
          <GitCompareArrows size={13} /> {isCompared ? "Comparing" : "Compare"}
        </button>
      </div>
    </article>
  );
}

export default OpportunityCard;
