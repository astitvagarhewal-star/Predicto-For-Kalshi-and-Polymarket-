import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function bucketEdge(opportunities) {
  const buckets = [0, 5, 10, 15, 20, 25, 30, 40, 50];
  const result = buckets.slice(0, -1).map((start, index) => ({
    range: `${start}-${buckets[index + 1]}%`,
    count: 0,
  }));

  opportunities.forEach((opportunity) => {
    const edge = Number(opportunity.edge || 0);
    const idx = result.findIndex((bucket, index) => {
      const [start, end] = [buckets[index], buckets[index + 1]];
      return edge >= start && edge < end;
    });

    if (idx >= 0) {
      result[idx].count += 1;
    }
  });

  return result;
}

function platformSummary(opportunities) {
  const summary = {
    polymarket: { platform: "Polymarket", avgEdge: 0, volume: 0, count: 0 },
    kalshi: { platform: "Kalshi", avgEdge: 0, volume: 0, count: 0 },
  };

  opportunities.forEach((opportunity) => {
    const key = opportunity.market === "kalshi" ? "kalshi" : "polymarket";
    summary[key].count += 1;
    summary[key].avgEdge += Number(opportunity.edge || 0);
    summary[key].volume += Number(opportunity.volume24h || 0);
  });

  return Object.values(summary).map((entry) => ({
    ...entry,
    avgEdge: entry.count ? Number((entry.avgEdge / entry.count).toFixed(2)) : 0,
    volume: Number(entry.volume.toFixed(2)),
  }));
}

function AnalyticsTab({ opportunities, historySeries }) {
  const edgeHistogram = bucketEdge(opportunities);
  const platformData = platformSummary(opportunities);
  const scatterData = opportunities.slice(0, 120).map((opportunity) => ({
    x: Math.log10(Math.max(1, Number(opportunity.volume24h || 0))),
    y: Number(opportunity.edge || 0),
    z: Math.max(20, Number(opportunity.profitPotential || 0) * 4),
    name: opportunity.name,
  }));
  const expiryData = opportunities
    .filter((opportunity) => Number.isFinite(opportunity.daysToExpiration))
    .slice(0, 100)
    .map((opportunity) => ({
      x: Number(opportunity.daysToExpiration),
      y: Number(opportunity.edge || 0),
    }))
    .sort((a, b) => a.x - b.x);

  const simulatedPerformance = historySeries?.map((row, index) => ({
    label: row.time,
    winRate: Math.max(40, Math.min(85, 52 + index * 3)),
    roi: Math.max(-10, Math.min(60, 8 + index * 6)),
  })) || [];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-pa-card p-4">
        <p className="mb-3 text-sm font-semibold text-pa-text">Edge Distribution Histogram</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={edgeHistogram}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="range" stroke="#94A3B8" />
            <YAxis stroke="#94A3B8" />
            <Tooltip />
            <Bar dataKey="count" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-pa-card p-4">
          <p className="mb-3 text-sm font-semibold text-pa-text">Polymarket vs Kalshi</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={platformData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="platform" stroke="#94A3B8" />
              <YAxis yAxisId="left" stroke="#94A3B8" />
              <YAxis yAxisId="right" orientation="right" stroke="#94A3B8" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="avgEdge" fill="#10B981" name="Avg Edge %" />
              <Bar yAxisId="right" dataKey="volume" fill="#3B82F6" name="Total Volume" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-pa-card p-4">
          <p className="mb-3 text-sm font-semibold text-pa-text">Volume vs Edge Scatter</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid stroke="#334155" />
              <XAxis type="number" dataKey="x" name="log10(Volume)" stroke="#94A3B8" />
              <YAxis type="number" dataKey="y" name="Edge %" stroke="#94A3B8" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatterData} fill="#F59E0B" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-pa-card p-4">
          <p className="mb-3 text-sm font-semibold text-pa-text">Time to Expiration vs Mispricing</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={expiryData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="x" stroke="#94A3B8" name="Days" />
              <YAxis dataKey="y" stroke="#94A3B8" name="Edge" />
              <Tooltip />
              <Line type="monotone" dataKey="y" stroke="#A855F7" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-pa-card p-4">
          <p className="mb-3 text-sm font-semibold text-pa-text">Trade Performance (Local Journal)</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={simulatedPerformance}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94A3B8" />
              <YAxis stroke="#94A3B8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="winRate" stroke="#10B981" name="Win Rate %" />
              <Line type="monotone" dataKey="roi" stroke="#3B82F6" name="ROI %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

export default AnalyticsTab;
