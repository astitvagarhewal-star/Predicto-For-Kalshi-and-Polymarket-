import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { buildApiUrl, fetchJson } from "../utils/api";

function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchJson(buildApiUrl("/api/leaderboard"))
      .then((payload) => {
        if (!active) {
          return;
        }
        setEntries(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (active) {
          setEntries([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <section className="rounded-2xl border border-slate-700 bg-pa-card p-4 text-sm text-pa-muted">Loading leaderboard...</section>;
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-pa-gold" />
        <p className="text-sm font-semibold text-pa-text">Leaderboard</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-pa-muted">No trades logged yet. Start logging trades to unlock rankings.</p>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-pa-muted">
                <th className="px-2 py-2 text-left">Rank</th>
                <th className="px-2 py-2 text-left">Trader</th>
                <th className="px-2 py-2 text-right">ROI</th>
                <th className="px-2 py-2 text-right">Win Rate</th>
                <th className="px-2 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((trader, index) => (
                <tr key={trader.email} className="border-b border-slate-800 text-pa-text">
                  <td className="px-2 py-2">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </td>
                  <td className="px-2 py-2">
                    {trader.name}
                    {trader.badge === "consistent" ? " 🏆" : ""}
                    {trader.badge === "highroller" ? " 🚀" : ""}
                  </td>
                  <td className="px-2 py-2 text-right text-pa-green">{Number(trader.roi || 0).toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right text-pa-blue">{Number(trader.winRate || 0).toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right text-pa-gold">${Number(trader.profit || 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default Leaderboard;
