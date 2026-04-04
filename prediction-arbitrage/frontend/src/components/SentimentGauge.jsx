function sentimentToNeedle(percentages) {
  const overpriced = percentages?.overpriced ?? 0;
  const underpriced = percentages?.underpriced ?? 0;
  const bias = underpriced - overpriced;

  return Math.max(-90, Math.min(90, (bias / 100) * 180));
}

function SentimentGauge({ sentiment }) {
  const percentages = sentiment?.percentages || {
    overpriced: 33,
    fair: 34,
    underpriced: 33,
  };

  const angle = sentimentToNeedle(percentages);

  return (
    <div className="rounded-xl border border-slate-700 bg-pa-card p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-pa-muted">Market Sentiment</p>
      <div className="relative mx-auto h-28 w-56 overflow-hidden">
        <div className="absolute left-1/2 top-24 h-24 w-48 -translate-x-1/2 rounded-t-full border-x border-t border-slate-600 bg-gradient-to-r from-pa-red/40 via-slate-700 to-pa-green/40" />
        <div
          className="absolute left-1/2 top-24 h-20 w-[2px] origin-bottom bg-pa-text transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
        />
        <div className="absolute left-1/2 top-[88px] h-4 w-4 -translate-x-1/2 rounded-full bg-pa-text" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-pa-red">Overpriced</p>
          <p className="font-semibold text-pa-text">{percentages.overpriced}%</p>
        </div>
        <div>
          <p className="text-pa-muted">Fair</p>
          <p className="font-semibold text-pa-text">{percentages.fair}%</p>
        </div>
        <div>
          <p className="text-pa-green">Underpriced</p>
          <p className="font-semibold text-pa-text">{percentages.underpriced}%</p>
        </div>
      </div>
    </div>
  );
}

export default SentimentGauge;
