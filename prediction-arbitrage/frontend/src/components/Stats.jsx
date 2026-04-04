import { formatCompactNumber, formatPercent } from "../utils/priceFormatter";

function MiniSparkline({ values, colorClass }) {
  const max = Math.max(...values, 1);

  return (
    <div className="mt-2 flex items-end gap-1">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`inline-block w-1.5 rounded-sm ${colorClass}`}
          style={{ height: `${Math.max(6, (value / max) * 26)}px` }}
        />
      ))}
    </div>
  );
}

function Stats({ opportunities, historySeries = [] }) {
  const count = opportunities.length;
  const averageEdge = count > 0
    ? opportunities.reduce((total, item) => total + Number(item.edge || 0), 0) / count
    : 0;
  const totalVolume = opportunities.reduce(
    (total, item) => total + Number(item.volume24h || 0),
    0
  );

  const sortedByEdge = [...opportunities].sort((a, b) => Number(b.edge || 0) - Number(a.edge || 0));
  const bestDeal = sortedByEdge[0];

  const seriesValues = historySeries.map((point) => Number(point.total || 0));
  const last = seriesValues[seriesValues.length - 1] || 0;
  const prev = seriesValues[seriesValues.length - 2] || last;
  const change = last - prev;

  const cards = [
    {
      label: "Opportunities",
      value: count.toLocaleString(),
      detail: `${change >= 0 ? "+" : ""}${change} from prior snapshot`,
      color: change >= 0 ? "text-pa-green" : "text-pa-red",
      spark: historySeries.map((point) => Number(point.total || 0)),
      sparkColor: "bg-pa-blue",
    },
    {
      label: "Avg Edge",
      value: formatPercent(averageEdge),
      detail: `${formatPercent(averageEdge - 8)} vs 7d baseline`,
      color: averageEdge >= 8 ? "text-pa-green" : "text-pa-muted",
      spark: historySeries.map((point) => Number(point.med || 0)),
      sparkColor: "bg-pa-green",
    },
    {
      label: "Total Volume",
      value: `$${formatCompactNumber(totalVolume)}`,
      detail: "Liquidity across displayed opportunities",
      color: "text-pa-muted",
      spark: historySeries.map((point) => Number(point.high || 0) + Number(point.med || 0)),
      sparkColor: "bg-pa-purple",
    },
    {
      label: "Best Deal",
      value: formatPercent(bestDeal?.edge || 0),
      detail: bestDeal ? bestDeal.name.slice(0, 36) : "No opportunities",
      color: "text-pa-gold",
      spark: historySeries.map((point) => Number(point.high || 0)),
      sparkColor: "bg-pa-gold",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-xl border border-slate-700 bg-pa-card p-4">
          <p className="text-xs uppercase tracking-wide text-pa-muted">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-pa-text">{card.value}</p>
          <p className={`mt-1 text-xs ${card.color}`}>{card.detail}</p>
          <MiniSparkline values={card.spark.length ? card.spark : [1, 1, 1]} colorClass={card.sparkColor} />
        </article>
      ))}
    </section>
  );
}

export default Stats;
