const crypto = require("crypto");
const http = require("http");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Server } = require("socket.io");
require("dotenv").config();

const {
  getOpportunities,
  getOpportunityHistory,
  analyzeMarket,
  refreshOpportunitiesInBackground,
} = require("./services/opportunityService");
const featureStore = require("./services/featureStore");
const usageMeter = require("./services/usageMeter");

const PORT = Number(process.env.PORT) || 5000;
const app = express();
const server = http.createServer(app);

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const allowedOrigins = new Set(["http://localhost:5173"]);
if (process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => allowedOrigins.add(origin));
}

if (process.env.VERCEL_URL) {
  const vercelUrl = process.env.VERCEL_URL.startsWith("http")
    ? process.env.VERCEL_URL
    : `https://${process.env.VERCEL_URL}`;
  allowedOrigins.add(vercelUrl);
}

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.has(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
  })
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
  },
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const alertKeywords = {
  bullish: ["yes", "buy", "long", "up", "bull", "moon", "breakout"],
  bearish: ["no", "sell", "short", "down", "bear", "dump", "rug"],
};

const deliveryCooldown = new Map();
const JWT_SECRET = process.env.JWT_SECRET || "local-dev-secret";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";
const DEFAULT_AUTH_RATE_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 30);
const DEFAULT_AUTH_RATE_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const DEFAULT_API_RATE_PER_MINUTE = Number(process.env.API_RATE_PER_MINUTE || 120);

const mailer = (() => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
})();

function deterministicHash(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1000003;
  }
  return hash;
}

function parseEdgeThreshold(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  if (parsed <= 1) {
    return parsed * 100;
  }

  return parsed;
}

function toPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed <= 1 ? parsed * 100 : parsed;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return emailRegex.test(String(value || "").trim());
}

function normalizePlatforms(input) {
  const allowed = new Set(["polymarket", "kalshi"]);
  const list = Array.isArray(input)
    ? input
    : String(input || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

  const normalized = list.filter((platform) => allowed.has(platform));
  return normalized.length > 0 ? normalized : [...allowed];
}

function shouldDeliver(key, cooldownMs) {
  const lastSent = deliveryCooldown.get(key);
  const now = Date.now();

  if (lastSent && now - lastSent < cooldownMs) {
    return false;
  }

  deliveryCooldown.set(key, now);
  return true;
}

async function sendEmail({ to, subject, html }) {
  if (!mailer || !to) {
    return false;
  }

  try {
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send failed:", error.message);
    return false;
  }
}

async function fetchOpportunitiesSnapshot(limit = 200) {
  const payload = await getOpportunities({
    limit,
    sortBy: "profitPotential",
  });

  return payload.opportunities || [];
}

function parseMessagesSentiment(messages) {
  const counters = {
    bullish: 0,
    bearish: 0,
    neutral: 0,
  };

  messages.forEach((message) => {
    const text = String(message.text || "").toLowerCase();
    const hasBullish = alertKeywords.bullish.some((keyword) => text.includes(keyword));
    const hasBearish = alertKeywords.bearish.some((keyword) => text.includes(keyword));

    if (hasBullish && !hasBearish) {
      counters.bullish += 1;
      return;
    }

    if (hasBearish && !hasBullish) {
      counters.bearish += 1;
      return;
    }

    counters.neutral += 1;
  });

  return counters;
}

function parseShareId(shareId) {
  try {
    return Buffer.from(String(shareId || ""), "base64url").toString("utf8");
  } catch (_error) {
    try {
      return Buffer.from(String(shareId || ""), "base64").toString("utf8");
    } catch (_secondError) {
      return "";
    }
  }
}

function createAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      plan: user.plan || "free",
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRY,
    }
  );
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice(7).trim();
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    plan: user.plan || "free",
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    hasApiKey: Boolean(user.apiKey),
  };
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) {
    return forwarded;
  }

  return req.ip || req.connection?.remoteAddress || "unknown";
}

function createIpRateLimiter({ windowMs, max, keyPrefix = "ip" }) {
  const buckets = new Map();

  return (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const current = buckets.get(key) || {
      windowStart: now,
      count: 0,
    };

    if (now - current.windowStart >= windowMs) {
      current.windowStart = now;
      current.count = 0;
    }

    current.count += 1;
    buckets.set(key, current);

    const remaining = Math.max(0, max - current.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - current.windowStart)) / 1000));

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (current.count > max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "Too many requests",
        retryAfterSeconds,
      });
      return;
    }

    if (buckets.size > 10000) {
      const staleCutoff = now - windowMs * 2;
      for (const [bucketKey, bucketValue] of buckets.entries()) {
        if (bucketValue.windowStart < staleCutoff) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  };
}

const authRateLimiter = createIpRateLimiter({
  windowMs: DEFAULT_AUTH_RATE_WINDOW_MS,
  max: DEFAULT_AUTH_RATE_MAX,
  keyPrefix: "auth",
});

async function resolveApiUser(req, res, next) {
  const apiKey = extractBearerToken(req);
  if (!apiKey) {
    res.status(401).json({ error: "No API key provided" });
    return;
  }

  const rateResult = usageMeter.checkAndIncrementRate(apiKey, DEFAULT_API_RATE_PER_MINUTE);
  res.setHeader("X-API-Rate-Limit", String(rateResult.limit));
  res.setHeader("X-API-Rate-Remaining", String(rateResult.remaining));

  if (!rateResult.allowed) {
    res.setHeader("Retry-After", String(rateResult.retryAfterSeconds));
    res.status(429).json({
      error: "API rate limit exceeded",
      retryAfterSeconds: rateResult.retryAfterSeconds,
    });
    return;
  }

  const user = await featureStore.findUserByApiKey(apiKey);
  if (!user) {
    usageMeter.recordUsage({
      apiKey,
      endpoint: req.path,
      statusCode: 401,
    });

    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  req.apiKey = apiKey;
  req.apiUser = user;

  res.on("finish", () => {
    usageMeter.recordUsage({
      apiKey,
      endpoint: req.path,
      statusCode: res.statusCode,
    });
  });

  next();
}

function toCsvCell(value) {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

async function createBacktestDataset() {
  const fromAirtable = await featureStore.listHistoricalSince(7);

  if (fromAirtable.length > 0) {
    return fromAirtable
      .map((record) => {
        const raw = record.opportunities;
        let parsed = [];

        if (typeof raw === "string") {
          try {
            parsed = JSON.parse(raw || "[]");
          } catch (_error) {
            parsed = [];
          }
        } else if (Array.isArray(raw)) {
          parsed = raw;
        }

        return {
          date: record.date || record.createdAt || new Date().toISOString(),
          opportunities: parsed,
        };
      })
      .filter((row) => Array.isArray(row.opportunities));
  }

  const latest = await fetchOpportunitiesSnapshot(120);
  const now = Date.now();

  return [...Array.from({ length: 7 })].map((_, dayIndex) => {
    const date = new Date(now - (6 - dayIndex) * 24 * 60 * 60 * 1000).toISOString();

    const opportunities = latest.map((market) => {
      const noise = ((deterministicHash(`${market.id}:${dayIndex}`) % 900) - 450) / 100;
      const adjustedEdge = Math.max(0, Number(market.edge || 0) + noise);

      return {
        ...market,
        mispricing: {
          edge: adjustedEdge / 100,
        },
      };
    });

    return {
      date,
      opportunities,
    };
  });
}

async function runAlertSweep() {
  const opportunities = await fetchOpportunitiesSnapshot(200);
  const alerts = await featureStore.listActiveAlerts();

  await Promise.all(alerts.map(async (alert) => {
    const minEdge = parseEdgeThreshold(alert.minEdge, 10);
    const platforms = normalizePlatforms(alert.platforms);
    const matching = opportunities
      .filter((opportunity) =>
        platforms.includes(String(opportunity.market || "").toLowerCase())
        && Number(opportunity.edge || 0) >= minEdge)
      .slice(0, 5);

    if (matching.length === 0) {
      return;
    }

    if (!shouldDeliver(`alert:${alert.id}`, 20 * 60 * 1000)) {
      return;
    }

    const marketRows = matching
      .map((market) => {
        const edge = Number(market.edge || 0).toFixed(1);
        return `<li><strong>${market.name}</strong> (${market.market})<br/>Edge: ${edge}%</li>`;
      })
      .join("");

    await sendEmail({
      to: alert.email,
      subject: `Arbitrage Alert: ${matching.length} opportunities`,
      html: `
        <h2>New Arbitrage Opportunities</h2>
        <p>Found ${matching.length} markets above ${minEdge.toFixed(1)}% edge.</p>
        <ul>${marketRows}</ul>
      `,
    });
  }));
}

async function runSmartNotificationSweep() {
  const opportunities = await fetchOpportunitiesSnapshot(200);
  const highEdge = opportunities
    .filter((opportunity) => Number(opportunity.edge || 0) >= parseEdgeThreshold(process.env.SMART_ALERT_MIN_EDGE, 20))
    .slice(0, 3);

  if (highEdge.length === 0) {
    return;
  }

  const subscribers = await featureStore.listEnabledNotifications();

  await Promise.all(subscribers.map(async (subscriber) => {
    const email = normalizeEmail(subscriber.email);
    if (!email) {
      return;
    }

    const snoozeUntil = subscriber.snoozeUntil ? new Date(subscriber.snoozeUntil).getTime() : 0;
    if (snoozeUntil && Date.now() < snoozeUntil) {
      return;
    }

    if (!shouldDeliver(`smart:${email}`, 15 * 60 * 1000)) {
      return;
    }

    const top = highEdge[0];
    const message = `High-edge market: ${top.name} (${Number(top.edge || 0).toFixed(1)}%)`;

    io.to(`notif:${email}`).emit("smart-notification", {
      id: crypto.randomUUID(),
      email,
      message,
      marketId: top.id,
      marketName: top.name,
      edge: Number(top.edge || 0),
      url: top.url,
      timestamp: new Date().toISOString(),
    });

    await sendEmail({
      to: email,
      subject: `High Edge Opportunity: ${Number(top.edge || 0).toFixed(1)}%`,
      html: `<h2>${top.name}</h2><p>Edge: <strong>${Number(top.edge || 0).toFixed(1)}%</strong></p><p><a href="${top.url}">Open market</a></p>`,
    });
  }));
}

app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    socket: "enabled",
    datastore: featureStore.getRuntimeMode(),
  });
});

app.get("/api/arbitrage/opportunities", asyncHandler(async (req, res) => {
  const payload = await getOpportunities({
    minEdge: req.query.minEdge,
    market: req.query.market,
    search: req.query.search,
    sortBy: req.query.sortBy,
    limit: req.query.limit,
  });
  res.json(payload);
}));

app.get("/api/arbitrage/history", asyncHandler(async (_req, res) => {
  const payload = await getOpportunityHistory();
  res.json(payload);
}));

app.post("/api/analyze-market", async (req, res, next) => {
  try {
    const payload = await analyzeMarket({
      platform: req.body?.platform,
      marketId: req.body?.marketId,
    });

    res.json(payload);
  } catch (error) {
    if (
      error.message === "marketId is required"
      || error.message === "platform must be polymarket or kalshi"
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error.message === "Market not found") {
      res.status(404).json({ error: error.message });
      return;
    }

    next(error);
  }
});

app.post("/api/auth/register", authRateLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await featureStore.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "User already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await featureStore.createUser({
    email,
    passwordHash,
    plan: "free",
  });

  if (!user) {
    res.status(500).json({ error: "Unable to create user" });
    return;
  }

  const token = createAuthToken(user);

  res.status(201).json({
    token,
    user: toPublicUser(user),
  });
}));

app.post("/api/auth/login", authRateLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!isValidEmail(email) || !password) {
    res.status(400).json({ error: "Valid email and password are required" });
    return;
  }

  const user = await featureStore.findUserByEmail(email);
  if (!user?.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = createAuthToken(user);

  res.json({
    token,
    user: toPublicUser(user),
  });
}));

app.get("/api/auth/me", asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const user = await featureStore.findUserByEmail(payload.email);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    user: toPublicUser(user),
  });
}));

app.post("/api/alerts/subscribe", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const minEdge = parseEdgeThreshold(req.body?.minEdge, 10);
  const platforms = normalizePlatforms(req.body?.platforms);

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const record = await featureStore.createAlert({
    email,
    minEdge,
    platforms,
  });

  res.json({
    success: true,
    alertId: record.id,
    mode: featureStore.getRuntimeMode(),
  });

  sendEmail({
    to: email,
    subject: "Prediction Arbitrage Alerts Enabled",
    html: `
      <h2>Welcome to Prediction Arbitrage Alerts</h2>
      <p>You will receive opportunities above ${minEdge.toFixed(1)}% on ${platforms.join(", ")}.</p>
    `,
  }).catch(() => {});
}));

app.get("/api/alerts/list", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.headers.email || req.query.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const records = await featureStore.listAlertsByEmail(email);
  res.json({ alerts: records });
}));

app.delete("/api/alerts/:alertId", asyncHandler(async (req, res) => {
  await featureStore.deleteAlert(req.params.alertId);
  res.json({ success: true });
}));

app.post("/api/watchlist/add", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const marketId = String(req.body?.marketId || "").trim();

  if (!isValidEmail(email) || !marketId) {
    res.status(400).json({ error: "email and marketId are required" });
    return;
  }

  const record = await featureStore.addWatchlistItem({
    email,
    marketId,
    marketName: req.body?.marketName,
    currentPrice: toPercent(req.body?.currentPrice),
    platform: req.body?.platform,
  });

  res.json({
    success: true,
    item: record,
  });
}));

app.get("/api/watchlist", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.headers.email || req.query.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const watchlist = await featureStore.listWatchlist(email);
  res.json({ watchlist });
}));

app.delete("/api/watchlist/:marketId", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.headers.email || req.query.email);
  const marketId = String(req.params.marketId || "").trim();

  if (!isValidEmail(email) || !marketId) {
    res.status(400).json({ error: "Valid email and marketId are required" });
    return;
  }

  await featureStore.removeWatchlistItem(email, marketId);
  res.json({ success: true });
}));

app.post("/api/backtest", asyncHandler(async (req, res) => {
  const minEdge = parseEdgeThreshold(req.body?.minEdge, 10);
  const platforms = normalizePlatforms(req.body?.platforms);
  const historical = await createBacktestDataset();

  let capital = 10000;
  const trades = [];

  historical.forEach((dayRecord) => {
    const day = dayRecord.date || new Date().toISOString();
    const opportunities = Array.isArray(dayRecord.opportunities) ? dayRecord.opportunities : [];

    opportunities.forEach((opportunity) => {
      const platform = String(opportunity.market || opportunity.platform || "").toLowerCase();
      const edge = toPercent(opportunity?.mispricing?.edge ?? opportunity?.edge ?? 0);

      if (!platforms.includes(platform) || edge < minEdge) {
        return;
      }

      const betAmount = Number((capital * 0.05).toFixed(2));
      const edgeFactor = Math.max(0.01, Math.min(0.35, edge / 100));
      const random = (deterministicHash(`${opportunity.id}:${day}`) % 1000) / 1000;
      const winProbability = Math.max(0.35, Math.min(0.82, 0.45 + edgeFactor / 1.5));
      const isWin = random <= winProbability;
      const profitLoss = Number(
        (isWin
          ? betAmount * edgeFactor
          : -betAmount * Math.max(0.03, edgeFactor * 0.6)).toFixed(2)
      );

      capital = Number((capital + profitLoss).toFixed(2));
      trades.push({
        marketId: opportunity.id,
        marketName: opportunity.name || "Unknown Market",
        platform,
        betAmount,
        profitLoss,
        date: day,
      });
    });
  });

  const winningTrades = trades.filter((trade) => trade.profitLoss > 0);

  res.json({
    winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
    totalReturn: (capital - 10000) / 10000,
    maxWin: trades.length > 0 ? Math.max(...trades.map((trade) => trade.profitLoss)) : 0,
    maxLoss: trades.length > 0 ? Math.min(...trades.map((trade) => trade.profitLoss)) : 0,
    trades: trades.slice(-50),
    finalCapital: capital,
  });
}));

app.get("/api/chat/sentiment/:marketId", asyncHandler(async (req, res) => {
  const marketId = String(req.params.marketId || "").trim();
  if (!marketId) {
    res.status(400).json({ error: "marketId is required" });
    return;
  }

  const messages = await featureStore.listChatMessages(marketId, 250);
  const sentiment = parseMessagesSentiment(messages);
  const consensus = sentiment.bullish > sentiment.bearish
    ? "bullish"
    : sentiment.bearish > sentiment.bullish
      ? "bearish"
      : "neutral";

  res.json({
    ...sentiment,
    consensus,
    sampleSize: messages.length,
  });
}));

app.post("/api/trades/log", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  await featureStore.addTrade({
    email,
    marketId: req.body?.marketId,
    betAmount: req.body?.betAmount,
    outcome: req.body?.outcome,
    profitLoss: req.body?.profitLoss,
  });

  res.json({ success: true });
}));

app.get("/api/leaderboard", asyncHandler(async (_req, res) => {
  const trades = await featureStore.listTrades();
  const traders = {};

  trades.forEach((trade) => {
    const email = normalizeEmail(trade.email);
    if (!email) {
      return;
    }

    if (!traders[email]) {
      traders[email] = {
        email,
        trades: [],
        totalProfit: 0,
      };
    }

    const profitLoss = Number(trade.profitLoss || 0);
    traders[email].trades.push(trade);
    traders[email].totalProfit += Number.isFinite(profitLoss) ? profitLoss : 0;
  });

  const leaderboard = Object.values(traders)
    .map((trader) => {
      const invested = trader.trades.reduce((sum, trade) => sum + Number(trade.betAmount || 0), 0);
      const wins = trader.trades.filter((trade) => Number(trade.profitLoss || 0) > 0).length;
      const winRate = trader.trades.length > 0 ? (wins / trader.trades.length) * 100 : 0;

      return {
        name: trader.email.split("@")[0],
        email: trader.email,
        roi: invested > 0 ? (trader.totalProfit / invested) * 100 : 0,
        winRate,
        profit: trader.totalProfit,
        trades: trader.trades.length,
        badge:
          trader.trades.length >= 50 && winRate > 60
            ? "consistent"
            : trader.totalProfit > 50000
              ? "highroller"
              : null,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 100);

  res.json(leaderboard);
}));

app.get("/api/crowd-prediction/:marketId", asyncHandler(async (req, res) => {
  const marketId = String(req.params.marketId || "").trim();
  if (!marketId) {
    res.status(400).json({ error: "marketId is required" });
    return;
  }

  const messages = await featureStore.listChatMessages(marketId, 200);
  const sentiment = parseMessagesSentiment(messages);

  const predictions = {
    "0.1": 0.1,
    "0.3": 0.2,
    "0.5": 0.4,
    "0.7": 0.2,
    "0.9": 0.1,
  };

  const totalDirectional = sentiment.bullish + sentiment.bearish;
  if (totalDirectional > 0) {
    const bullishRatio = sentiment.bullish / totalDirectional;

    if (bullishRatio >= 0.7) {
      predictions["0.9"] = 0.5;
      predictions["0.7"] = 0.3;
      predictions["0.5"] = 0.15;
      predictions["0.3"] = 0.04;
      predictions["0.1"] = 0.01;
    } else if (bullishRatio <= 0.3) {
      predictions["0.1"] = 0.5;
      predictions["0.3"] = 0.3;
      predictions["0.5"] = 0.15;
      predictions["0.7"] = 0.04;
      predictions["0.9"] = 0.01;
    }
  }

  const consensus = Number(
    Object.entries(predictions)
      .reduce((sum, [price, probability]) => sum + Number(price) * Number(probability), 0)
      .toFixed(3)
  );

  res.json({
    ...predictions,
    consensus,
  });
}));

app.get("/api/export/csv", asyncHandler(async (req, res) => {
  const marketIds = String(req.query.markets || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const opportunities = await fetchOpportunitiesSnapshot(200);
  const matching = marketIds.length > 0
    ? opportunities.filter((item) => marketIds.includes(String(item.id)))
    : opportunities;

  const header = [
    "Market",
    "Bid %",
    "Ask %",
    "Fair Price",
    "Edge %",
    "Profit %",
    "Volume (24h)",
    "Platform",
  ];

  const rows = matching.map((market) => [
    market.name,
    Number(market.bestBid || 0).toFixed(1),
    Number(market.bestAsk || 0).toFixed(1),
    Number(market.fairPrice || 50).toFixed(1),
    Number(market.edge || 0).toFixed(1),
    Number(market.profitPotential || 0).toFixed(1),
    Number(market.volume24h || 0).toFixed(0),
    market.market,
  ]);

  const csv = [header, ...rows]
    .map((line) => line.map(toCsvCell).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=arbitrage.csv");
  res.send(csv);
}));

app.get("/api/share/:shareId", asyncHandler(async (req, res) => {
  const decoded = parseShareId(req.params.shareId);
  const marketIds = decoded
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const opportunities = await fetchOpportunitiesSnapshot(200);
  const markets = opportunities.filter((item) => marketIds.includes(String(item.id)));

  res.json({
    shareId: req.params.shareId,
    marketIds,
    markets,
    count: markets.length,
  });
}));

app.post("/api/auth/generate-key", authRateLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const apiKey = `pk_${crypto.randomBytes(18).toString("hex")}`;
  await featureStore.createOrUpdateUser({
    email,
    apiKey,
    plan: "pro",
  });

  res.json({ apiKey, plan: "pro" });
}));

app.get("/api/v1/opportunities", resolveApiUser, asyncHandler(async (req, res) => {
  const user = req.apiUser;

  const opportunities = await fetchOpportunitiesSnapshot(200);

  res.json({
    user: {
      email: user.email,
      plan: user.plan || "pro",
    },
    opportunities: opportunities.map((market) => ({
      id: market.id,
      name: market.name,
      platform: market.market,
      bid: market.bestBid,
      ask: market.bestAsk,
      edge: market.edge,
      profitPotential: market.profitPotential,
      volume24h: market.volume24h,
      url: market.url,
      timestamp: new Date().toISOString(),
    })),
    timestamp: new Date().toISOString(),
  });
}));

app.get("/api/v1/usage", resolveApiUser, asyncHandler(async (req, res) => {
  const usage = usageMeter.getUsage(req.apiKey);

  res.json({
    user: {
      email: req.apiUser.email,
      plan: req.apiUser.plan || "pro",
    },
    usage,
    timestamp: new Date().toISOString(),
  });
}));

app.get("/api/market-activity", asyncHandler(async (_req, res) => {
  const opportunities = await fetchOpportunitiesSnapshot(200);
  if (opportunities.length === 0) {
    res.json([]);
    return;
  }

  const maxVolume = Math.max(
    ...opportunities.map((market) => Number(market.volume24h || 0)),
    1
  );

  const activity = opportunities
    .slice()
    .sort((a, b) => Number(b.volume24h || 0) - Number(a.volume24h || 0))
    .slice(0, 20)
    .map((market) => ({
      id: market.id,
      name: String(market.name || "").slice(0, 42),
      volume24h: Number(market.volume24h || 0),
      intensity: Number((Number(market.volume24h || 0) / maxVolume).toFixed(3)),
      platform: market.market,
    }));

  res.json(activity);
}));

app.post("/api/notifications/subscribe", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const record = await featureStore.upsertNotificationSubscription({
    email,
    enabled: true,
    snoozeUntil: req.body?.snoozeUntil || null,
  });

  res.json({
    success: true,
    notificationId: record?.id,
    snoozeUntil: record?.snoozeUntil || null,
  });
}));

app.post("/api/notifications/snooze", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const minutes = Number(req.body?.minutes || 30);

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const record = await featureStore.snoozeNotifications(email, minutes);

  res.json({
    success: true,
    snoozeUntil: record?.snoozeUntil || null,
  });
}));

io.on("connection", (socket) => {
  socket.on("join-market", (marketId) => {
    const normalizedMarketId = String(marketId || "").trim();
    if (!normalizedMarketId) {
      return;
    }
    socket.join(`market:${normalizedMarketId}`);
  });

  socket.on("subscribe-notifications", (email) => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return;
    }

    socket.join(`notif:${normalizedEmail}`);
  });

  socket.on("send-message", async (...args) => {
    try {
      const payload = typeof args[0] === "object"
        ? args[0]
        : {
          marketId: args[0],
          message: args[1],
          userId: args[2],
        };

      const marketId = String(payload.marketId || "").trim();
      const message = String(payload.message || "").trim();
      const userId = String(payload.userId || `anon-${crypto.randomBytes(3).toString("hex")}`);

      if (!marketId || !message) {
        return;
      }

      const record = await featureStore.addChatMessage({
        marketId,
        userId,
        text: message,
      });

      const normalized = {
        id: record.id,
        marketId,
        text: message,
        userId,
        timestamp: record.timestamp || new Date().toISOString(),
      };

      io.to(`market:${marketId}`).emit("new-message", normalized);
    } catch (error) {
      console.error("socket send-message error:", error.message);
    }
  });

  socket.on("get-messages", async (marketId) => {
    try {
      const normalizedMarketId = String(marketId || "").trim();
      if (!normalizedMarketId) {
        socket.emit("message-history", []);
        return;
      }

      const messages = await featureStore.listChatMessages(normalizedMarketId, 50);
      socket.emit("message-history", messages);
    } catch (error) {
      console.error("socket get-messages error:", error.message);
      socket.emit("message-history", []);
    }
  });
});

app.use((error, _req, res, _next) => {
  if (error?.message === "CORS origin not allowed") {
    res.status(403).json({ error: "CORS origin not allowed" });
    return;
  }

  console.error("Unhandled server error:", error?.message || error);
  res.status(500).json({ error: "Internal server error" });
});

server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);

  refreshOpportunitiesInBackground().catch((error) => {
    console.error("Initial background refresh failed:", error.message);
  });

  setInterval(() => {
    refreshOpportunitiesInBackground().catch((error) => {
      console.error("Scheduled background refresh failed:", error.message);
    });
  }, 2 * 60 * 1000);

  setInterval(() => {
    runAlertSweep().catch((error) => {
      console.error("Alert sweep failed:", error.message);
    });
  }, 2 * 60 * 1000);

  setInterval(() => {
    runSmartNotificationSweep().catch((error) => {
      console.error("Smart notification sweep failed:", error.message);
    });
  }, 5 * 60 * 1000);
});
