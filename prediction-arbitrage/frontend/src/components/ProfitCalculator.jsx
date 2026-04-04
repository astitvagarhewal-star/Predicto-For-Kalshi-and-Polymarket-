import { useMemo, useState } from "react";
import { formatCurrency, formatPercent } from "../utils/priceFormatter";

function calculateScenario({ opportunity, amount, bankroll, position }) {
  if (!opportunity || amount <= 0) {
    return null;
  }

  const yesEntry = Number(opportunity.bestAsk || 0) / 100;
  const noEntry = (100 - Number(opportunity.bestBid || 0)) / 100;
  const fairProbYes = Number(opportunity.trueProb || 0.5);
  const fairProb = position === "yes" ? fairProbYes : 1 - fairProbYes;
  const entry = position === "yes" ? yesEntry : noEntry;

  if (entry <= 0 || entry >= 1) {
    return null;
  }

  const shares = amount / entry;
  const bestProfit = shares * (1 - entry);
  const worstLoss = amount;
  const riskRewardRatio = worstLoss > 0 ? bestProfit / worstLoss : 0;

  const b = (1 - entry) / entry;
  const q = 1 - fairProb;
  const kellyFraction = Math.max(0, (b * fairProb - q) / b);
  const kellyBet = bankroll * Math.min(0.25, kellyFraction);

  return {
    bestProfit,
    worstLoss,
    breakEven: entry,
    kellyFraction,
    kellyBet,
    riskRewardRatio,
    expectedValue: amount * (fairProb * b - q),
  };
}

function ProfitCalculator({ opportunities, defaultSearch = "" }) {
  const [marketInput, setMarketInput] = useState(defaultSearch);
  const [amount, setAmount] = useState(1000);
  const [bankroll, setBankroll] = useState(20000);
  const [position, setPosition] = useState("yes");
  const [currency, setCurrency] = useState("USD");

  const selectedOpportunity = useMemo(() => {
    const normalized = marketInput.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return opportunities.find((opportunity) => {
      const name = String(opportunity.name || "").toLowerCase();
      const url = String(opportunity.url || "").toLowerCase();
      return name.includes(normalized) || url.includes(normalized);
    }) || null;
  }, [marketInput, opportunities]);

  const scenario = useMemo(
    () =>
      calculateScenario({
        opportunity: selectedOpportunity,
        amount: Number(amount),
        bankroll: Number(bankroll),
        position,
      }),
    [amount, bankroll, position, selectedOpportunity]
  );

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="mb-2 text-lg font-semibold text-pa-text">Profit Potential Calculator</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-pa-muted">Market link or name</label>
          <input
            type="text"
            value={marketInput}
            onChange={(event) => setMarketInput(event.target.value)}
            list="market-options"
            placeholder="Search market..."
            className="w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
          />
          <datalist id="market-options">
            {opportunities.slice(0, 200).map((opportunity) => (
              <option key={`${opportunity.market}-${opportunity.id}`} value={opportunity.name} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-pa-muted">Bet amount</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-pa-muted">Bankroll</label>
            <input
              type="number"
              min="1"
              value={bankroll}
              onChange={(event) => setBankroll(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-pa-muted">Position</label>
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-pa-muted">Currency</label>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
          >
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </div>
      </div>

      {!scenario ? (
        <p className="mt-4 rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-3 text-sm text-pa-muted">
          Select a valid market and amount to calculate scenarios.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-xs text-pa-muted">Potential profit (best)</p>
            <p className="text-lg font-semibold text-pa-green">{formatCurrency(scenario.bestProfit, currency)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-xs text-pa-muted">Potential loss (worst)</p>
            <p className="text-lg font-semibold text-pa-red">{formatCurrency(scenario.worstLoss, currency)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-xs text-pa-muted">Break-even price</p>
            <p className="text-lg font-semibold text-pa-text">{formatPercent(scenario.breakEven * 100)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-xs text-pa-muted">Kelly recommendation</p>
            <p className="text-lg font-semibold text-pa-gold">{formatCurrency(scenario.kellyBet, currency)}</p>
            <p className="text-xs text-pa-muted">{formatPercent(scenario.kellyFraction * 100)} of bankroll</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-xs text-pa-muted">Risk / Reward</p>
            <p className="text-lg font-semibold text-pa-text">1 : {scenario.riskRewardRatio.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-xs text-pa-muted">Expected value</p>
            <p className={`text-lg font-semibold ${scenario.expectedValue >= 0 ? "text-pa-green" : "text-pa-red"}`}>
              {formatCurrency(scenario.expectedValue, currency)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProfitCalculator;
