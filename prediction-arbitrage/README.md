# Prediction Arbitrage

Prediction market arbitrage dashboard that aggregates live markets from Polymarket and Kalshi, computes probability edges, and ranks the top opportunities by profit potential.

## Tech Stack

- Frontend: React 18 + Vite + Tailwind CSS + React Query + Three.js + Recharts + Framer Motion + Lucide
- Backend: Node.js + Express
- Data: Polymarket + Kalshi live APIs
- Database: None (in-memory cache)

## Project Structure

```text
prediction-arbitrage/
  backend/
  frontend/
  README.md
```

## Local Development

### 1) Backend

```bash
cd backend
npm install
# PowerShell
Copy-Item .env.example .env
npm run dev
```

Backend runs on `http://localhost:5000`.

Available endpoints:

- `GET /health` -> `{ "status": "ok" }`
- `GET /api/arbitrage/opportunities`
- `GET /api/arbitrage/history`
- `POST /api/analyze-market`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/alerts/subscribe`
- `GET /api/alerts/list`
- `DELETE /api/alerts/:alertId`
- `POST /api/watchlist/add`
- `GET /api/watchlist`
- `DELETE /api/watchlist/:marketId`
- `POST /api/backtest`
- `GET /api/chat/sentiment/:marketId`
- `POST /api/trades/log`
- `GET /api/leaderboard`
- `GET /api/crowd-prediction/:marketId`
- `GET /api/export/csv`
- `GET /api/share/:shareId`
- `POST /api/auth/generate-key`
- `GET /api/v1/opportunities`
- `GET /api/v1/usage`
- `GET /api/market-activity`
- `POST /api/notifications/subscribe`
- `POST /api/notifications/snooze`

Optional query params for `GET /api/arbitrage/opportunities`:

- `minEdge` (number, default `0`)
- `market` (`polymarket` | `kalshi` | `all`)
- `search` (string, case-insensitive market name match)
- `sortBy` (`profitPotential` | `edge` | `volume` | `spread`)
- `limit` (1-200, default `50`)

Example:

```bash
curl "http://localhost:5000/api/arbitrage/opportunities?market=polymarket&minEdge=5&sortBy=volume&limit=25"
```

Response also includes `sourceStatus` with per-provider health metadata (`lastSuccessAt`, `lastAttemptAt`, `status`, `lastError`, `lastMarketCount`, `isStale`).

`POST /api/analyze-market` request body:

```json
{
  "platform": "polymarket",
  "marketId": "540816"
}
```

Response includes market analysis metrics plus model-based consensus sentiment.

Run backend tests:

```bash
npm test
```

### 2) Frontend

```bash
cd frontend
npm install
# PowerShell
Copy-Item .env.example .env.local
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Elite Frontend Features

- Market Link Analyzer (Polymarket/Kalshi parsing + live analysis + sentiment gauge)
- 3D Edge Landscape (Three.js terrain, hover tooltips, click-to-jump)
- Opportunity Heatmap (Now/1h/6h/24h/7d edge-tier history)
- Profit Calculator (best/worst case, breakeven, Kelly recommendation)
- Smart Watchlist (pinning, alerts, local persistence)
- Live Ticker (top opportunities with trend direction)
- Advanced Analytics tab (histogram, platform comparison, scatter, expiry trend)
- Comparison Mode (2-4 market side-by-side table)
- Alert System (email + browser notification controls)
- Backtest Simulator (7-day strategy replay)
- Live Chat + Crowd Prediction (Socket.IO rooms + sentiment)
- Leaderboard + Trade Logger (gamified trader rankings)
- Export and Share (CSV + shareable API snapshot links)
- API Key Access panel (pro monetization path)
- Market Heatmap tiles (live activity intensity)

## Backend Behavior

- Fetches Polymarket (`limit=100`) and Kalshi (`limit=50`) markets
- Normalizes bid/ask prices to cents (`0-100`)
- Calculates:
  - `trueProb = ((bestBid + bestAsk) / 2) / 100`
  - `fairPrice = 50`
  - `edge = abs(truePrice - fairPrice)` where `truePrice` is midpoint in cents
  - `profitPotential = edge - spread / 2`
- Sorts by `profitPotential` descending and returns top 50
- Caches response for 30 seconds
- Refreshes in background every 2 minutes
- Uses stale cached data (or empty array) if provider APIs fail
- Applies 5 second API timeout per upstream request
- De-duplicates duplicated market IDs and removes expired markets
- Maintains in-memory history snapshots for heatmap analytics
- Supports single-market analysis endpoint for pasted links

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=production
CORS_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
VERCEL_URL=your-frontend.vercel.app
AIRTABLE_KEY=your_airtable_api_key
AIRTABLE_BASE=your_airtable_base_id
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
JWT_SECRET=replace_with_secure_secret
JWT_EXPIRY=7d
SMART_ALERT_MIN_EDGE=20
AUTH_RATE_LIMIT_MAX=30
AUTH_RATE_LIMIT_WINDOW_MS=900000
API_RATE_PER_MINUTE=120
```

Security hardening included:

- Auth endpoints are IP rate-limited (`AUTH_RATE_LIMIT_MAX` per `AUTH_RATE_LIMIT_WINDOW_MS`)
- API-key endpoints are key-rate-limited (`API_RATE_PER_MINUTE`)
- API usage is metered in-memory and exposed via `GET /api/v1/usage`

### Frontend (`frontend/.env.local`)

```env
VITE_API_URL=https://your-backend.railway.app
VITE_SOCKET_URL=https://your-backend.railway.app
```

## Airtable Field Mapping (MVP)

Create base `Prediction Arbitrage` and these tables/fields:

- `Users`: `email` (text), `passwordHash` (text), `apiKey` (text), `plan` (text), `createdAt` (text), `updatedAt` (text)
- `Alerts`: `email` (text), `minEdge` (number), `platforms` (text), `active` (checkbox), `createdAt` (text)
- `Watchlist`: `email` (text), `marketId` (text), `marketName` (text), `platform` (text), `savedPrice` (number), `savedTime` (text)
- `Trades`: `email` (text), `marketId` (text), `betAmount` (number), `outcome` (text), `profitLoss` (number), `timestamp` (text)
- `ChatMessages`: `marketId` (text), `userId` (text), `text` (long text), `timestamp` (text)
- `Notifications`: `email` (text), `enabled` (checkbox), `snoozeUntil` (text), `createdAt` (text), `updatedAt` (text)
- `Historical` (optional): `date` (text), `opportunities` (long text JSON)

## Deploy

### Backend on Railway

1. Create a new Railway project from `backend/`
2. Railway config file is already included: `backend/railway.json`
3. Set variables:
   - `NODE_ENV=production`
   - `CORS_ORIGINS=https://your-frontend.vercel.app`
4. Start command:

```bash
node index.js
```

5. Copy your Railway URL (example: `https://your-app.railway.app`)

### Frontend on Vercel

1. In `frontend/`, create `.env.local` with:

```env
VITE_API_URL=https://your-app.railway.app
```

2. Deploy with Vercel:

```bash
npm install -g vercel
vercel
```

3. Vercel build settings:
   - Build command: `npm run build`
   - Output directory: `dist`

4. Add your Vercel domain to backend `CORS_ORIGINS`.

## Production Checklist

- Backend running on port `5000`
- Frontend running on port `5173`
- `GET /api/arbitrage/opportunities` returns JSON data
- Dashboard cards render opportunities
- Filters and sorting work
- Search by market name works
- Filter state syncs to URL for sharing/bookmarking
- Manual refresh works
- Auto-refresh countdown + live/stale indicator visible
- Data source status panel shows Polymarket and Kalshi sync health
- Mobile layout verified (1 / 2 / 3 columns)
- Links open Polymarket / Kalshi markets
