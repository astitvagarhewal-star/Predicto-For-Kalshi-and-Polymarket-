const {
  fetchPolymarketMarkets,
  fetchKalshiMarkets,
  fetchPolymarketMarket,
  fetchKalshiMarket,
} = require("./marketProviders");
const { rankTopOpportunities, calculateMetrics } = require("./arbitrageMath");

const CACHE_TTL_MS = 30 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STALE_AFTER_MS = 5 * 60 * 1000;
const SNAPSHOT_RETENTION_MS = 8 * 24 * 60 * 60 * 1000;

function createProviderStatus(name) {
  return {
    name,
    status: "idle",
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastMarketCount: 0,
  };
}

const cache = {
  payload: null,
  fetchedAt: 0,
  sourceData: {
    polymarket: [],
    kalshi: [],
  },
  sourceStatus: {
    polymarket: createProviderStatus("Polymarket"),
    kalshi: createProviderStatus("Kalshi"),
  },
  historySnapshots: [],
};

function isNotExpired(market) {
  if (!market.expirationDate) {
    return true;
  }

  const expirationDate = new Date(market.expirationDate);
  if (Number.isNaN(expirationDate.getTime())) {
    return true;
  }

  return expirationDate.getTime() > Date.now();
}

function deduplicateMarkets(markets) {
  const byKey = new Map();

  markets.forEach((market) => {
    const key = `${market.market}:${market.id}`;
    const existing = byKey.get(key);

    if (!existing || Number(market.volume24h || 0) > Number(existing.volume24h || 0)) {
      byKey.set(key, market);
    }
  });

  return [...byKey.values()];
}

function emptyPayload() {
  return {
    count: 0,
    timestamp: new Date().toISOString(),
    opportunities: [],
  };
}

function getEdgeBucketSnapshot(opportunities, timestamp = new Date().toISOString()) {
  const snapshot = {
    timestamp,
    low: 0,
    med: 0,
    high: 0,
    total: opportunities.length,
  };

  opportunities.forEach((opportunity) => {
    const edge = Number(opportunity.edge || 0);
    if (edge >= 30) {
      snapshot.high += 1;
      return;
    }

    if (edge >= 10) {
      snapshot.med += 1;
      return;
    }

    if (edge >= 5) {
      snapshot.low += 1;
    }
  });

  return snapshot;
}

function pruneOldSnapshots() {
  const cutoff = Date.now() - SNAPSHOT_RETENTION_MS;
  cache.historySnapshots = cache.historySnapshots.filter((snapshot) => {
    const snapshotTime = new Date(snapshot.timestamp).getTime();
    return Number.isFinite(snapshotTime) && snapshotTime >= cutoff;
  });
}

function captureHistorySnapshot(opportunities, timestamp) {
  const snapshot = getEdgeBucketSnapshot(opportunities, timestamp);
  const latest = cache.historySnapshots[cache.historySnapshots.length - 1];

  if (latest?.timestamp === snapshot.timestamp) {
    return;
  }

  cache.historySnapshots.push(snapshot);
  pruneOldSnapshots();
}

function getClosestSnapshot(targetTimestamp) {
  const targetTime = new Date(targetTimestamp).getTime();
  if (!Number.isFinite(targetTime) || cache.historySnapshots.length === 0) {
    return null;
  }

  let candidate = null;

  for (const snapshot of cache.historySnapshots) {
    const snapshotTime = new Date(snapshot.timestamp).getTime();
    if (!Number.isFinite(snapshotTime)) {
      continue;
    }

    if (snapshotTime <= targetTime) {
      candidate = snapshot;
    }
  }

  return candidate || cache.historySnapshots[0] || null;
}

function getHistorySeries() {
  const now = Date.now();
  const buckets = [
    { key: "Now", offsetMs: 0 },
    { key: "1h ago", offsetMs: 1 * 60 * 60 * 1000 },
    { key: "6h ago", offsetMs: 6 * 60 * 60 * 1000 },
    { key: "24h ago", offsetMs: 24 * 60 * 60 * 1000 },
    { key: "7d ago", offsetMs: 7 * 24 * 60 * 60 * 1000 },
  ];

  return buckets.map((bucket) => {
    const targetTimestamp = new Date(now - bucket.offsetMs).toISOString();
    const snapshot = getClosestSnapshot(targetTimestamp);

    return {
      time: bucket.key,
      low: snapshot?.low || 0,
      med: snapshot?.med || 0,
      high: snapshot?.high || 0,
      total: snapshot?.total || 0,
      timestamp: snapshot?.timestamp || null,
    };
  });
}

function deterministicHash(input) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1000003;
  }

  return hash;
}

function createSentimentFromMarket(market) {
  const signedEdge = Number(market.signedEdge || 0);
  const absoluteEdge = Math.abs(signedEdge);
  const volumeWeight = Math.min(
    300,
    Math.max(20, Math.round(Number(market.volume24h ?? market.volume ?? 0) / 80))
  );
  const deterministicNoise = deterministicHash(`${market.market}:${market.id}`) % 9;

  const confidence = Math.min(0.82, 0.46 + absoluteEdge / 70 + deterministicNoise / 200);

  let consensus = "fair_priced";
  if (signedEdge > 3.5) {
    consensus = "overpriced";
  } else if (signedEdge < -3.5) {
    consensus = "underpriced";
  }

  const agreeCount = Math.max(12, Math.round(volumeWeight * confidence));
  const disagreeCount = Math.max(6, volumeWeight - agreeCount);
  const fairCount = Math.max(4, Math.round(volumeWeight * (1 - confidence) * 0.6));
  const totalVotes = agreeCount + disagreeCount + fairCount;

  let overpricedPct = 33;
  let fairPct = 34;
  let underpricedPct = 33;

  if (consensus === "overpriced") {
    overpricedPct = Math.round(50 + confidence * 35);
    fairPct = Math.max(5, Math.round(20 - confidence * 8));
    underpricedPct = Math.max(5, 100 - overpricedPct - fairPct);
  } else if (consensus === "underpriced") {
    underpricedPct = Math.round(50 + confidence * 35);
    fairPct = Math.max(5, Math.round(20 - confidence * 8));
    overpricedPct = Math.max(5, 100 - underpricedPct - fairPct);
  } else {
    fairPct = Math.round(40 + (1 - confidence) * 25);
    overpricedPct = Math.max(10, Math.round((100 - fairPct) / 2));
    underpricedPct = Math.max(10, 100 - fairPct - overpricedPct);
  }

  return {
    agree_count: agreeCount,
    disagree_count: disagreeCount,
    fair_count: fairCount,
    consensus,
    consensus_strength: Number((agreeCount / totalVotes).toFixed(3)),
    percentages: {
      overpriced: overpricedPct,
      fair: fairPct,
      underpriced: underpricedPct,
    },
  };
}

function buildAnalyzedMarket(market) {
  const metrics = calculateMetrics(market.bestBid, market.bestAsk);

  return {
    id: market.id,
    name: market.name,
    platform: market.market,
    bid: Number(market.bestBid.toFixed(2)),
    ask: Number(market.bestAsk.toFixed(2)),
    spread: Number(metrics.spread.toFixed(2)),
    fair_price: 50,
    edge: Number(metrics.edge.toFixed(2)),
    signedEdge: Number(metrics.signedEdge.toFixed(2)),
    profit_potential: Number(metrics.profitPotential.toFixed(2)),
    volume: Number((market.volume24h || 0).toFixed(2)),
    liquidity: Number((market.liquidity || 0).toFixed(2)),
    true_probability: Number(metrics.trueProb.toFixed(4)),
    expirationDate: market.expirationDate,
    url: market.url,
  };
}

function findCachedMarket(platform, marketId) {
  const idValue = String(marketId || "").trim().toLowerCase();
  if (!idValue) {
    return null;
  }

  const list = platform === "polymarket"
    ? cache.sourceData.polymarket
    : cache.sourceData.kalshi;

  return list.find((market) => {
    const baseId = String(market.id || "").toLowerCase();
    const slug = String(market.slug || "").toLowerCase();
    const ticker = String(market.ticker || "").toLowerCase();
    const url = String(market.url || "").toLowerCase();

    return (
      baseId === idValue
      || slug === idValue
      || ticker === idValue
      || url.endsWith(`/${idValue}`)
    );
  }) || null;
}

function buildSourceStatusSnapshot() {
  const now = Date.now();

  return {
    polymarket: {
      ...cache.sourceStatus.polymarket,
      isStale: cache.sourceStatus.polymarket.lastSuccessAt
        ? now - new Date(cache.sourceStatus.polymarket.lastSuccessAt).getTime() > STALE_AFTER_MS
        : true,
    },
    kalshi: {
      ...cache.sourceStatus.kalshi,
      isStale: cache.sourceStatus.kalshi.lastSuccessAt
        ? now - new Date(cache.sourceStatus.kalshi.lastSuccessAt).getTime() > STALE_AFTER_MS
        : true,
    },
  };
}

function normalizeFilters(filters = {}) {
  const parsedLimit = Number.parseInt(filters.limit, 10);
  const parsedMinEdge = Number.parseFloat(filters.minEdge);
  const search = String(filters.search || "").trim().toLowerCase();

  const market = String(filters.market || "all").toLowerCase();
  const safeMarket = market === "polymarket" || market === "kalshi" ? market : "all";

  const sortBy = String(filters.sortBy || "profitPotential");
  const safeSortBy = ["profitPotential", "edge", "volume", "spread"].includes(sortBy)
    ? sortBy
    : "profitPotential";

  return {
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT,
    minEdge:
      Number.isFinite(parsedMinEdge) && parsedMinEdge >= 0
        ? parsedMinEdge
        : 0,
    market: safeMarket,
    sortBy: safeSortBy,
    search,
  };
}

function sortOpportunities(opportunities, sortBy) {
  if (sortBy === "edge") {
    return opportunities.sort((a, b) => b.edge - a.edge);
  }

  if (sortBy === "volume") {
    return opportunities.sort((a, b) => b.volume24h - a.volume24h);
  }

  if (sortBy === "spread") {
    return opportunities.sort((a, b) => a.spread - b.spread);
  }

  return opportunities.sort((a, b) => b.profitPotential - a.profitPotential);
}

function applyOpportunityFilters(opportunities, filters = {}) {
  const normalized = normalizeFilters(filters);

  const filtered = opportunities.filter((opportunity) => {
    if (normalized.market !== "all" && opportunity.market !== normalized.market) {
      return false;
    }

    if (Number(opportunity.edge || 0) < normalized.minEdge) {
      return false;
    }

    if (
      normalized.search &&
      !String(opportunity.name || "").toLowerCase().includes(normalized.search)
    ) {
      return false;
    }

    return true;
  });

  const sorted = sortOpportunities(filtered, normalized.sortBy);
  return sorted.slice(0, normalized.limit);
}

function toResponsePayload(basePayload, filters = {}) {
  const opportunities = applyOpportunityFilters(basePayload.opportunities, filters);

  return {
    count: opportunities.length,
    timestamp: basePayload.timestamp,
    opportunities,
    sourceStatus: buildSourceStatusSnapshot(),
  };
}

async function refreshPayload() {
  const attemptTimestamp = new Date().toISOString();

  cache.sourceStatus.polymarket.lastAttemptAt = attemptTimestamp;
  cache.sourceStatus.kalshi.lastAttemptAt = attemptTimestamp;

  const [polyResult, kalshiResult] = await Promise.allSettled([
    fetchPolymarketMarkets(100),
    fetchKalshiMarkets(50),
  ]);

  if (polyResult.status === "fulfilled") {
    cache.sourceData.polymarket = polyResult.value;
    cache.sourceStatus.polymarket.status = "live";
    cache.sourceStatus.polymarket.lastSuccessAt = new Date().toISOString();
    cache.sourceStatus.polymarket.lastError = null;
    cache.sourceStatus.polymarket.lastMarketCount = polyResult.value.length;
  } else {
    console.error("Polymarket fetch failed:", polyResult.reason.message);
    cache.sourceStatus.polymarket.status = "error";
    cache.sourceStatus.polymarket.lastError = polyResult.reason.message;
  }

  if (kalshiResult.status === "fulfilled") {
    cache.sourceData.kalshi = kalshiResult.value;
    cache.sourceStatus.kalshi.status = "live";
    cache.sourceStatus.kalshi.lastSuccessAt = new Date().toISOString();
    cache.sourceStatus.kalshi.lastError = null;
    cache.sourceStatus.kalshi.lastMarketCount = kalshiResult.value.length;
  } else {
    console.error("Kalshi fetch failed:", kalshiResult.reason.message);
    cache.sourceStatus.kalshi.status = "error";
    cache.sourceStatus.kalshi.lastError = kalshiResult.reason.message;
  }

  const mergedMarkets = [
    ...cache.sourceData.polymarket,
    ...cache.sourceData.kalshi,
  ]
    .filter(isNotExpired);

  const uniqueMarkets = deduplicateMarkets(mergedMarkets);

  if (uniqueMarkets.length === 0) {
    if (cache.payload) {
      return cache.payload;
    }
    return emptyPayload();
  }

  const opportunities = rankTopOpportunities(uniqueMarkets, uniqueMarkets.length);

  const payload = {
    count: opportunities.length,
    timestamp: new Date().toISOString(),
    opportunities,
  };

  captureHistorySnapshot(opportunities, payload.timestamp);

  cache.payload = payload;
  cache.fetchedAt = Date.now();

  return payload;
}

async function getBasePayload(forceRefresh = false) {
  const cacheIsFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (!forceRefresh && cache.payload && cacheIsFresh) {
    return cache.payload;
  }

  try {
    return await refreshPayload();
  } catch (error) {
    console.error("Opportunity refresh failed:", error.message);
    return cache.payload || emptyPayload();
  }
}

async function getOpportunities(filters = {}, forceRefresh = false) {
  if (typeof filters === "boolean") {
    const basePayload = await getBasePayload(filters);
    return toResponsePayload(basePayload);
  }

  const basePayload = await getBasePayload(forceRefresh);
  return toResponsePayload(basePayload, filters);
}

async function getOpportunityHistory() {
  const basePayload = await getBasePayload(false);

  if (cache.historySnapshots.length === 0 && basePayload.opportunities.length > 0) {
    captureHistorySnapshot(basePayload.opportunities, basePayload.timestamp);
  }

  return {
    timestamp: new Date().toISOString(),
    series: getHistorySeries(),
  };
}

async function analyzeMarket({ platform, marketId }) {
  const normalizedPlatform = String(platform || "").toLowerCase();
  const idValue = String(marketId || "").trim();

  if (!idValue) {
    throw new Error("marketId is required");
  }

  if (!["polymarket", "kalshi"].includes(normalizedPlatform)) {
    throw new Error("platform must be polymarket or kalshi");
  }

  await getBasePayload(false);

  let market = findCachedMarket(normalizedPlatform, idValue);

  if (!market) {
    market = normalizedPlatform === "polymarket"
      ? await fetchPolymarketMarket(idValue)
      : await fetchKalshiMarket(idValue);
  }

  if (!market) {
    throw new Error("Market not found");
  }

  const analyzed = buildAnalyzedMarket(market);

  return {
    market: analyzed,
    sentiment: createSentimentFromMarket(analyzed),
  };
}

async function refreshOpportunitiesInBackground() {
  await getBasePayload(true);
}

module.exports = {
  getOpportunities,
  getOpportunityHistory,
  analyzeMarket,
  refreshOpportunitiesInBackground,
  applyOpportunityFilters,
  normalizeFilters,
  buildSourceStatusSnapshot,
};
