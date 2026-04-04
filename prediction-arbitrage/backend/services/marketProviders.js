const axios = require("axios");

const POLYMARKET_URL = "https://gamma-api.polymarket.com/markets";
const KALSHI_URL = "https://api.elections.kalshi.com/trade-api/v2/markets";

const http = axios.create({ timeout: 5000 });

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCents(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const cents = parsed <= 1 ? parsed * 100 : parsed;
  const clamped = Math.min(100, Math.max(0, cents));
  return Number(clamped.toFixed(2));
}

function toLiquidity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function isTradable(bestBid, bestAsk) {
  if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
    return false;
  }

  if (bestBid === 0 && bestAsk === 0) {
    return false;
  }

  if (bestAsk < bestBid) {
    return false;
  }

  return true;
}

function normalizePolymarketMarket(market) {
  const bestBid = toCents(market.bestBid);
  const bestAsk = toCents(market.bestAsk);

  if (!isTradable(bestBid, bestAsk)) {
    return null;
  }

  const slug = market.slug || market.market_slug || null;
  const expirationDate = toIsoDate(
    market.endDate || market.endDateIso || market.end_date_iso
  );

  return {
    id: String(market.id),
    name: (market.question || "Untitled market").trim(),
    market: "polymarket",
    bestBid,
    bestAsk,
    volume24h: Number(
      toNumber(market.volume24hr, toNumber(market.volume24h, 0)).toFixed(2)
    ),
    liquidity: toLiquidity(market.liquidity),
    slug,
    ticker: null,
    url: slug
      ? `https://polymarket.com/event/${slug}`
      : `https://polymarket.com/market/${market.id}`,
    expirationDate,
  };
}

function normalizeKalshiMarket(market) {
  const bestBid = toCents(
    market.yes_bid_dollars ?? market.yes_bid ?? market.yesBid
  );
  const bestAsk = toCents(
    market.yes_ask_dollars ?? market.yes_ask ?? market.yesAsk
  );

  if (!isTradable(bestBid, bestAsk)) {
    return null;
  }

  const id = String(market.id || market.ticker || market.event_ticker);
  const expirationDate = toIsoDate(market.expiration_time || market.close_time);

  return {
    id,
    name: (market.title || market.yes_sub_title || id).trim(),
    market: "kalshi",
    bestBid,
    bestAsk,
    volume24h: Number(
      toNumber(market.volume_24h_fp, toNumber(market.volume_24h, 0)).toFixed(2)
    ),
    liquidity: toLiquidity(market.liquidity_dollars),
    slug: null,
    ticker: String(market.ticker || id),
    url: `https://kalshi.com/markets/${id}`,
    expirationDate,
  };
}

async function fetchPolymarketMarkets(limit = 100) {
  console.log(`[API] Polymarket request started (limit=${limit})`);

  const response = await http.get(POLYMARKET_URL, {
    params: {
      limit,
      active: true,
      closed: false,
      archived: false,
    },
  });

  const markets = Array.isArray(response.data) ? response.data : [];

  const normalized = markets.map(normalizePolymarketMarket).filter(Boolean);

  console.log(`[API] Polymarket request success (${normalized.length} markets)`);
  return normalized;
}

async function fetchKalshiMarkets(limit = 50) {
  console.log(`[API] Kalshi request started (limit=${limit})`);

  const response = await http.get(KALSHI_URL, {
    params: {
      limit,
      status: "open",
    },
  });

  const markets = Array.isArray(response.data?.markets) ? response.data.markets : [];

  const normalized = markets.map(normalizeKalshiMarket).filter(Boolean);

  console.log(`[API] Kalshi request success (${normalized.length} markets)`);
  return normalized;
}

async function fetchPolymarketMarket(identifier) {
  if (!identifier) {
    return null;
  }

  const idValue = String(identifier).trim();

  console.log(`[API] Polymarket single market request (${idValue})`);

  if (/^\d+$/.test(idValue)) {
    try {
      const response = await http.get(`${POLYMARKET_URL}/${idValue}`);
      return normalizePolymarketMarket(response.data);
    } catch (error) {
      console.warn(`[API] Polymarket ID lookup failed: ${error.message}`);
    }
  }

  const slugResponse = await http.get(POLYMARKET_URL, {
    params: {
      slug: idValue,
      limit: 1,
    },
  });

  const market = Array.isArray(slugResponse.data) ? slugResponse.data[0] : null;
  return market ? normalizePolymarketMarket(market) : null;
}

async function fetchKalshiMarket(identifier) {
  if (!identifier) {
    return null;
  }

  const idValue = String(identifier).trim();
  console.log(`[API] Kalshi single market request (${idValue})`);

  const response = await http.get(`${KALSHI_URL}/${idValue}`);
  const market = response.data?.market || null;
  return market ? normalizeKalshiMarket(market) : null;
}

module.exports = {
  fetchPolymarketMarkets,
  fetchKalshiMarkets,
  fetchPolymarketMarket,
  fetchKalshiMarket,
};
