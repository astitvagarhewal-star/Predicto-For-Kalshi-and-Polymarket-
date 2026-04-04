import { formatPercent } from "../utils/priceFormatter";

function bestValue(values, metric) {
  if (values.length === 0) {
    return null;
  }

  if (metric === "spread") {
    return Math.min(...values);
  }

  return Math.max(...values);
}

function ComparisonMode({ opportunities, selectedKeys, onToggleComparison }) {
  const selected = opportunities.filter((opportunity) =>
    selectedKeys.includes(`${opportunity.market}:${opportunity.id}`)
  ).slice(0, 4);

  const quickSelect = opportunities.slice(0, 12);

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-lg font-semibold text-pa-text">Comparison Mode</p>
        <p className="text-xs text-pa-muted">Select 2-4 markets</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {quickSelect.map((opportunity) => {
          const key = `${opportunity.market}:${opportunity.id}`;
          const selectedClass = selectedKeys.includes(key)
            ? "border-pa-blue bg-pa-blue/20 text-pa-text"
            : "border-slate-700 bg-[#0f1b33] text-pa-muted";

          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggleComparison(opportunity)}
              className={`rounded-md border px-2 py-1 text-xs transition ${selectedClass}`}
            >
              {opportunity.name.slice(0, 28)}
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <p className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-3 text-sm text-pa-muted">
          Pick at least two markets to compare metrics side by side.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-700">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[#0f1b33] text-pa-muted">
              <tr>
                <th className="px-3 py-2">Metric</th>
                {selected.map((market) => (
                  <th key={market.id} className="px-3 py-2 font-medium text-pa-text">
                    {market.name.slice(0, 20)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Edge", "edge", formatPercent],
                ["Profit Potential", "profitPotential", formatPercent],
                ["Volume", "volume24h", (value) => Number(value || 0).toLocaleString()],
                ["Spread", "spread", formatPercent],
                ["Days to Expiry", "daysToExpiration", (value) => (value ?? "N/A")],
              ].map(([label, metric, formatter]) => {
                const values = selected.map((market) => Number(market[metric] || 0));
                const best = bestValue(values, metric);

                return (
                  <tr key={metric} className="border-t border-slate-700">
                    <td className="px-3 py-2 text-pa-muted">{label}</td>
                    {selected.map((market) => {
                      const rawValue = Number(market[metric] || 0);
                      const isBest = metric === "spread" ? rawValue === best : rawValue === best;
                      return (
                        <td
                          key={`${market.id}-${metric}`}
                          className={`px-3 py-2 ${isBest ? "text-pa-green" : "text-pa-text"}`}
                        >
                          {formatter(rawValue)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ComparisonMode;
