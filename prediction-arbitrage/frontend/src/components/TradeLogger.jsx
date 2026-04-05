import { useMemo, useState } from "react";
import { buildApiUrl, fetchJson } from "../utils/api";

function TradeLogger({ opportunities }) {
  const [email, setEmail] = useState(() => localStorage.getItem("pa-user-email") || "");
  const [marketId, setMarketId] = useState("");
  const [betAmount, setBetAmount] = useState(1000);
  const [profitLoss, setProfitLoss] = useState(100);
  const [status, setStatus] = useState("");

  const options = useMemo(
    () => (Array.isArray(opportunities) ? opportunities.slice(0, 100) : []),
    [opportunities]
  );

  async function submitTrade() {
    try {
      await fetchJson(buildApiUrl("/api/trades/log"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          marketId,
          betAmount: Number(betAmount),
          outcome: Number(profitLoss) >= 0 ? "win" : "loss",
          profitLoss: Number(profitLoss),
        }),
      });

      localStorage.setItem("pa-user-email", email);
      setStatus("Trade logged");
      window.setTimeout(() => setStatus(""), 1600);
    } catch (error) {
      setStatus(error.message || "Log failed");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="text-sm font-semibold text-pa-text">Trade Logger</p>
      <p className="mt-1 text-xs text-pa-muted">Log simulated or real outcomes to feed leaderboard rankings.</p>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value.trim())}
          placeholder="you@example.com"
          className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />

        <select
          value={marketId}
          onChange={(event) => setMarketId(event.target.value)}
          className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        >
          <option value="">Choose market</option>
          {options.map((market) => (
            <option key={market.id} value={market.id}>{market.name}</option>
          ))}
        </select>

        <input
          type="number"
          value={betAmount}
          onChange={(event) => setBetAmount(event.target.value)}
          placeholder="Bet amount"
          className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />

        <input
          type="number"
          value={profitLoss}
          onChange={(event) => setProfitLoss(event.target.value)}
          placeholder="Profit/Loss"
          className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submitTrade}
          disabled={!email || !marketId}
          className="rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Log Trade
        </button>

        {status ? <span className="text-xs text-pa-muted">{status}</span> : null}
      </div>
    </section>
  );
}

export default TradeLogger;
