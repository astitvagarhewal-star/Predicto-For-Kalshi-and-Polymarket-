const FAIR_PRICE = 50;

function toFixedNumber(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

function calculateDaysToExpiration(expirationDate) {
  if (!expirationDate) {
    return null;
  }

  const end = new Date(expirationDate);
  if (Number.isNaN(end.getTime())) {
    return null;
  }

  const msDiff = end.getTime() - Date.now();
  return toFixedNumber(msDiff / (1000 * 60 * 60 * 24), 2);
}

function getEdgeTier(edge) {
  if (edge >= 30) {
    return "high";
  }

  if (edge >= 10) {
    return "medium";
  }

  if (edge >= 5) {
    return "low";
  }

  return "minimal";
}

function calculateMetrics(bestBid, bestAsk, fairPrice = FAIR_PRICE) {
  const spread = Math.max(0, bestAsk - bestBid);
  const truePrice = (bestBid + bestAsk) / 2;
  const trueProb = truePrice / 100;
  const signedEdge = truePrice - fairPrice;
  const edge = Math.abs(signedEdge);
  const profitPotential = edge - spread / 2;

  return {
    spread,
    truePrice,
    trueProb,
    signedEdge,
    edge,
    profitPotential,
  };
}

function toOpportunity(market) {
  const metrics = calculateMetrics(market.bestBid, market.bestAsk);

  return {
    id: market.id,
    name: market.name,
    market: market.market,
    bestBid: toFixedNumber(market.bestBid, 2),
    bestAsk: toFixedNumber(market.bestAsk, 2),
    spread: toFixedNumber(metrics.spread, 2),
    volume24h: toFixedNumber(market.volume24h || 0, 2),
    liquidity: toFixedNumber(market.liquidity || 0, 2),
    trueProb: toFixedNumber(metrics.trueProb, 4),
    fairPrice: FAIR_PRICE,
    edge: toFixedNumber(metrics.edge, 2),
    signedEdge: toFixedNumber(metrics.signedEdge, 2),
    profitPotential: toFixedNumber(metrics.profitPotential, 2),
    edgeTier: getEdgeTier(metrics.edge),
    daysToExpiration: calculateDaysToExpiration(market.expirationDate),
    url: market.url,
    expirationDate: market.expirationDate,
  };
}

function rankTopOpportunities(markets, limit = 50) {
  return markets
    .map(toOpportunity)
    .sort((a, b) => {
      if (b.profitPotential !== a.profitPotential) {
        return b.profitPotential - a.profitPotential;
      }

      if (b.edge !== a.edge) {
        return b.edge - a.edge;
      }

      if (b.volume24h !== a.volume24h) {
        return b.volume24h - a.volume24h;
      }

      return a.spread - b.spread;
    })
    .slice(0, limit);
}

module.exports = {
  rankTopOpportunities,
  calculateMetrics,
  calculateDaysToExpiration,
  getEdgeTier,
  toOpportunity,
  FAIR_PRICE,
};
