import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function OpportunityHeatmap({ series, loading }) {
  const data = Array.isArray(series) ? series : [];

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-pa-muted">Opportunity Heatmap</p>
        <p className="text-sm text-pa-text">Edge tier distribution over time</p>
      </div>

      {loading ? (
        <div className="h-[300px] animate-pulse rounded-lg bg-slate-800" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
            <YAxis stroke="#94A3B8" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0B1221",
                borderColor: "#334155",
                borderRadius: 8,
                color: "#F1F5F9",
              }}
            />
            <Bar dataKey="low" stackId="a" fill="#3B82F6" name="5-10% Edge" />
            <Bar dataKey="med" stackId="a" fill="#10B981" name="10-30% Edge" />
            <Bar dataKey="high" stackId="a" fill="#F59E0B" name="30%+ Edge" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default OpportunityHeatmap;
