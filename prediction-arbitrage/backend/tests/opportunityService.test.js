const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyOpportunityFilters,
  normalizeFilters,
} = require("../services/opportunityService");

const SAMPLE = [
  {
    id: "p-1",
    name: "Will ETH be above 4k?",
    market: "polymarket",
    edge: 12,
    spread: 2,
    volume24h: 5000,
    profitPotential: 11,
  },
  {
    id: "k-1",
    name: "Will CPI beat estimate?",
    market: "kalshi",
    edge: 8,
    spread: 1,
    volume24h: 10000,
    profitPotential: 7.5,
  },
  {
    id: "p-2",
    name: "Will BTC close green?",
    market: "polymarket",
    edge: 3,
    spread: 0.5,
    volume24h: 2500,
    profitPotential: 2.75,
  },
];

test("normalizeFilters applies defaults and bounds", () => {
  const result = normalizeFilters({ limit: "999", minEdge: "-1", sortBy: "bad" });

  assert.equal(result.limit, 200);
  assert.equal(result.minEdge, 0);
  assert.equal(result.market, "all");
  assert.equal(result.sortBy, "profitPotential");
});

test("applyOpportunityFilters supports market and minEdge filters", () => {
  const result = applyOpportunityFilters(SAMPLE, {
    market: "polymarket",
    minEdge: "5",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "p-1");
});

test("applyOpportunityFilters supports text search and limit", () => {
  const result = applyOpportunityFilters(SAMPLE, {
    search: "will",
    limit: "2",
    sortBy: "volume",
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].id, "k-1");
  assert.equal(result[1].id, "p-1");
});
