import { useState } from "react";
import { buildApiUrl, fetchJson } from "../utils/api";

function BacktestSimulator() {
  const [minEdge, setMinEdge] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  async function runBacktest() {
    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson(buildApiUrl("/api/backtest"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          minEdge: minEdge / 100,
          platforms: ["polymarket", "kalshi"],
        }),
      });

      setResults(payload);
    } catch (requestError) {
      setError(requestError.message || "Backtest failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="mb-1 text-sm font-semibold text-pa-text">Backtest Simulator</p>
      <p className="text-xs text-pa-muted">Run 7-day strategy validation with 5% position sizing.</p>

      <div className="mt-3">
        <label className="mb-1 block text-xs text-pa-muted">
          Min edge: <span className="text-pa-text">{minEdge}%</span>
        </label>
        <input
          type="range"
          min="1"
          max="50"
          value={minEdge}
          onChange={(event) => setMinEdge(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <button
        type="button"
        onClick={runBacktest}
        disabled={loading}
        className="mt-3 rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Running..." : "Run Backtest"}
      </button>

      {error ? (
        <p className="mt-3 rounded-lg border border-pa-red/40 bg-pa-red/10 px-3 py-2 text-xs text-pa-red">
          {error}
        </p>
      ) : null}

      {results ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <article className="rounded-lg border border-pa-green/30 bg-pa-green/10 p-3">
            <p className="text-pa-muted">Win Rate</p>
            <p className="text-lg font-semibold text-pa-green">{(results.winRate * 100).toFixed(1)}%</p>
          </article>
          <article className="rounded-lg border border-pa-blue/30 bg-pa-blue/10 p-3">
            <p className="text-pa-muted">Total Return</p>
            <p className="text-lg font-semibold text-pa-blue">{(results.totalReturn * 100).toFixed(1)}%</p>
          </article>
          <article className="rounded-lg border border-pa-gold/30 bg-pa-gold/10 p-3">
            <p className="text-pa-muted">Max Win</p>
            <p className="text-lg font-semibold text-pa-gold">${Number(results.maxWin || 0).toFixed(0)}</p>
          </article>
          <article className="rounded-lg border border-pa-red/30 bg-pa-red/10 p-3">
            <p className="text-pa-muted">Max Loss</p>
            <p className="text-lg font-semibold text-pa-red">${Math.abs(Number(results.maxLoss || 0)).toFixed(0)}</p>
          </article>
          <article className="col-span-2 rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-pa-muted">Final Capital</p>
            <p className="text-lg font-semibold text-pa-text">${Number(results.finalCapital || 0).toFixed(0)}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}

export default BacktestSimulator;
