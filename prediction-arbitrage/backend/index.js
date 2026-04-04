const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  getOpportunities,
  getOpportunityHistory,
  analyzeMarket,
  refreshOpportunitiesInBackground,
} = require("./services/opportunityService");

const PORT = Number(process.env.PORT) || 5000;
const app = express();

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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
  })
);

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/arbitrage/opportunities", async (req, res) => {
  const payload = await getOpportunities({
    minEdge: req.query.minEdge,
    market: req.query.market,
    search: req.query.search,
    sortBy: req.query.sortBy,
    limit: req.query.limit,
  });
  res.json(payload);
});

app.get("/api/arbitrage/history", async (_req, res) => {
  const payload = await getOpportunityHistory();
  res.json(payload);
});

app.post("/api/analyze-market", async (req, res, next) => {
  try {
    const payload = await analyzeMarket({
      platform: req.body?.platform,
      marketId: req.body?.marketId,
    });

    res.json(payload);
  } catch (error) {
    if (error.message === "marketId is required" || error.message === "platform must be polymarket or kalshi") {
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

app.use((error, _req, res, _next) => {
  if (error?.message === "CORS origin not allowed") {
    res.status(403).json({ error: "CORS origin not allowed" });
    return;
  }

  console.error("Unhandled server error:", error?.message || error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);

  refreshOpportunitiesInBackground().catch((error) => {
    console.error("Initial background refresh failed:", error.message);
  });

  setInterval(() => {
    refreshOpportunitiesInBackground().catch((error) => {
      console.error("Scheduled background refresh failed:", error.message);
    });
  }, 2 * 60 * 1000);
});
