const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateMetrics,
  toOpportunity,
  rankTopOpportunities,
  FAIR_PRICE,
} = require("../services/arbitrageMath");

test("calculateMetrics computes expected edge and profit potential", () => {
  const metrics = calculateMetrics(45, 55, FAIR_PRICE);

  assert.equal(metrics.spread, 10);
  assert.equal(metrics.truePrice, 50);
  assert.equal(metrics.trueProb, 0.5);
  assert.equal(metrics.signedEdge, 0);
  assert.equal(metrics.edge, 0);
  assert.equal(metrics.profitPotential, -5);
});

test("toOpportunity maps normalized market to response shape", () => {
  const result = toOpportunity({
    id: "abc",
    name: "Will this test pass?",
    market: "polymarket",
    bestBid: 30,
    bestAsk: 34,
    volume24h: 1234.56,
    url: "https://example.com",
    expirationDate: "2026-12-01T00:00:00.000Z",
  });

  assert.equal(result.id, "abc");
  assert.equal(result.market, "polymarket");
  assert.equal(result.trueProb, 0.32);
  assert.equal(result.fairPrice, 50);
  assert.equal(result.edge, 18);
  assert.equal(result.signedEdge, -18);
  assert.equal(result.profitPotential, 16);
});

test("rankTopOpportunities sorts by profit potential descending", () => {
  const input = [
    {
      id: "1",
      name: "A",
      market: "polymarket",
      bestBid: 45,
      bestAsk: 47,
      volume24h: 100,
      url: "https://example.com/a",
      expirationDate: null,
    },
    {
      id: "2",
      name: "B",
      market: "kalshi",
      bestBid: 20,
      bestAsk: 22,
      volume24h: 100,
      url: "https://example.com/b",
      expirationDate: null,
    },
  ];

  const ranked = rankTopOpportunities(input, 2);
  assert.equal(ranked[0].id, "2");
  assert.equal(ranked[1].id, "1");
});
