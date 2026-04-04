import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Link2, XCircle } from "lucide-react";
import { analyzeMarketRequest } from "../hooks/useFetchOpportunities";
import { parseMarketLink } from "../utils/linkParser";
import { formatCompactNumber, formatPercent } from "../utils/priceFormatter";
import { mergeSentimentWithLocalVotes } from "../utils/sentimentAnalyzer";
import SentimentGauge from "./SentimentGauge";

function MarketLinkAnalyzer({ onAddWatchlist, onViewMarket, localVotes, onCastVote }) {
  const [inputValue, setInputValue] = useState("");

  const parsed = useMemo(() => parseMarketLink(inputValue), [inputValue]);

  const analyzerMutation = useMutation({
    mutationFn: analyzeMarketRequest,
  });

  const analyzed = analyzerMutation.data;
  const marketKey = analyzed?.market
    ? `${analyzed.market.platform}:${analyzed.market.id}`
    : null;
  const blendedSentiment = mergeSentimentWithLocalVotes(
    analyzed?.sentiment,
    marketKey ? localVotes?.[marketKey] : null
  );

  function handleAnalyze() {
    if (!parsed) {
      return;
    }

    analyzerMutation.mutate({
      platform: parsed.platform,
      marketId: parsed.marketId,
    });
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-gradient-to-r from-[#13223f] to-[#142a46] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="w-full">
          <p className="mb-1 text-sm font-semibold text-pa-text">Market Link Analyzer</p>
          <p className="mb-2 text-xs text-pa-muted">
            Paste any Polymarket/Kalshi link and get instant mispricing analysis.
          </p>
          <input
            type="url"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="e.g., polymarket.com/event/... or kalshi.com/markets/..."
            className="w-full rounded-lg border border-slate-700 bg-pa-card px-3 py-2 text-sm text-pa-text outline-none transition focus:border-pa-blue"
            aria-label="Paste market link"
          />
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!parsed || analyzerMutation.isPending}
          className="rounded-lg border border-pa-blue bg-pa-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {analyzerMutation.isPending ? "Analyzing..." : "Analyze Link"}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        {inputValue.length === 0 ? null : parsed ? (
          <>
            <CheckCircle2 size={14} className="text-pa-green" />
            <span className="text-pa-green">Link valid</span>
          </>
        ) : (
          <>
            <XCircle size={14} className="text-pa-red" />
            <span className="text-pa-red">Invalid link</span>
          </>
        )}
      </div>

      {analyzerMutation.error ? (
        <p className="mt-3 rounded-lg border border-pa-red/40 bg-pa-red/10 px-3 py-2 text-xs text-pa-red">
          {analyzerMutation.error.message}
        </p>
      ) : null}

      {analyzed?.market ? (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-slate-700 bg-pa-card p-4 xl:col-span-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-pa-text">{analyzed.market.name}</h3>
              <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] uppercase text-pa-muted">
                {analyzed.market.platform}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-pa-muted md:grid-cols-4">
              <p>Bid: <span className="font-mono text-pa-text">{formatPercent(analyzed.market.bid)}</span></p>
              <p>Ask: <span className="font-mono text-pa-text">{formatPercent(analyzed.market.ask)}</span></p>
              <p>Fair: <span className="font-mono text-pa-text">{formatPercent(analyzed.market.fair_price)}</span></p>
              <p>
                Edge: <span className={`font-mono ${analyzed.market.signedEdge >= 0 ? "text-pa-green" : "text-pa-red"}`}>
                  {formatPercent(analyzed.market.signedEdge)}
                </span>
              </p>
              <p>Profit: <span className="font-mono text-pa-gold">{formatPercent(analyzed.market.profit_potential)}</span></p>
              <p>Volume: <span className="font-mono text-pa-text">{formatCompactNumber(analyzed.market.volume)}</span></p>
              <p>Liquidity: <span className="font-mono text-pa-text">{formatCompactNumber(analyzed.market.liquidity)}</span></p>
              <p>PA consensus: <span className="font-semibold text-pa-text">{blendedSentiment.consensus.replace("_", " ")}</span></p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAddWatchlist({
                  ...analyzed.market,
                  market: analyzed.market.platform,
                  bestBid: analyzed.market.bid,
                  bestAsk: analyzed.market.ask,
                  edge: analyzed.market.edge,
                  signedEdge: analyzed.market.signedEdge,
                  profitPotential: analyzed.market.profit_potential,
                })}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-pa-text transition hover:border-pa-blue"
              >
                Add to watchlist
              </button>

              <button
                type="button"
                onClick={() => onViewMarket(analyzed.market.name)}
                className="rounded-lg border border-pa-blue bg-pa-blue/20 px-3 py-2 text-xs font-semibold text-pa-text transition hover:bg-pa-blue/30"
              >
                View in full dashboard
              </button>

              <a
                href={analyzed.market.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-pa-text transition hover:border-pa-blue"
              >
                Open market <Link2 size={12} />
              </a>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-pa-muted">Your vote:</span>
              <button
                type="button"
                onClick={() => onCastVote(marketKey, "overpriced")}
                className="rounded-md border border-pa-red/40 bg-pa-red/10 px-2 py-1 text-pa-red"
              >
                Overpriced
              </button>
              <button
                type="button"
                onClick={() => onCastVote(marketKey, "fair")}
                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-pa-text"
              >
                Fair
              </button>
              <button
                type="button"
                onClick={() => onCastVote(marketKey, "underpriced")}
                className="rounded-md border border-pa-green/40 bg-pa-green/10 px-2 py-1 text-pa-green"
              >
                Underpriced
              </button>
            </div>
          </article>

          <SentimentGauge sentiment={blendedSentiment} />
        </div>
      ) : null}
    </section>
  );
}

export default MarketLinkAnalyzer;
