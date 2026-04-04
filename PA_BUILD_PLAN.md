# PREDICTION ARBITRAGE (PA) — 7-DAY BUILD PLAN

## DAY 1: SETUP + API INTEGRATION

### 1.1 Project Structure
```
prediction-arbitrage/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── EventCard.jsx
│   │   │   ├── Filter.jsx
│   │   │   └── Stats.jsx
│   │   ├── styles.css
│   │   └── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── index.js
│   ├── routes/
│   │   ├── polymarket.js
│   │   ├── kalshi.js
│   │   └── arbitrage.js
│   ├── services/
│   │   ├── probabilityCalculator.js
│   │   └── mispricingDetector.js
│   ├── package.json
│   └── .env
└── README.md
```

### 1.2 Backend Setup (Node.js + Express)

```bash
# Terminal
cd backend
npm init -y
npm install express cors dotenv axios nodemon
```

**backend/index.js:**
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const polymarketRoutes = require('./routes/polymarket');
const kalshiRoutes = require('./routes/kalshi');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/polymarket', polymarketRoutes);
app.use('/api/kalshi', kalshiRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
```

### 1.3 Fetch Polymarket Data

**backend/routes/polymarket.js:**
```javascript
const express = require('express');
const axios = require('axios');
const router = express.Router();

let cachedEvents = null;
let lastFetch = 0;

router.get('/events', async (req, res) => {
  const now = Date.now();
  
  // Cache for 30 seconds
  if (cachedEvents && (now - lastFetch) < 30000) {
    return res.json(cachedEvents);
  }

  try {
    // Polymarket public API (no auth needed)
    const response = await axios.get(
      'https://clob.polymarket.com/markets',
      { params: { limit: 100, order: 'volume24hDesc' } }
    );

    const events = response.data.map(market => ({
      id: market.id,
      name: market.question,
      bestBid: market.bestBid,
      bestAsk: market.bestAsk,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
      expirationDate: market.expirationDate,
      url: `https://polymarket.com/market/${market.id}`
    }));

    cachedEvents = events;
    lastFetch = now;
    res.json(events);
  } catch (error) {
    console.error('Polymarket API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Polymarket data' });
  }
});

module.exports = router;
```

### 1.4 Probability Calculator

**backend/services/probabilityCalculator.js:**
```javascript
/**
 * Convert market odds to true probability
 * Input: bid price (0-100, represents cents on dollar)
 * Output: probability as decimal (0-1)
 */
function calculateTrueProbability(bidPrice, askPrice) {
  // Midpoint
  const mid = (bidPrice + askPrice) / 2;
  
  // Convert to probability (simplified)
  // In practice, use order book data for more accuracy
  return mid / 100;
}

/**
 * Calculate mispricing (edge)
 * Positive = YES overpriced, should bet NO
 * Negative = NO overpriced, should bet YES
 */
function calculateMispricing(bidPrice, askPrice, fairPrice) {
  const mid = (bidPrice + askPrice) / 2;
  const spread = askPrice - bidPrice;
  
  return {
    fair: fairPrice,
    market: mid,
    edge: fairPrice - mid,
    spreadWidth: spread,
    profitPotential: Math.abs(fairPrice - mid) - (spread / 2)
  };
}

module.exports = { calculateTrueProbability, calculateMispricing };
```

### 1.5 Arbitrage Detection

**backend/services/mispricingDetector.js:**
```javascript
const { calculateMispricing } = require('./probabilityCalculator');

function detectMispriced(events, threshold = 0.05) {
  // threshold = minimum edge needed to show (5% = 0.05)
  
  return events
    .map(event => {
      const bid = event.bestBid || 45;
      const ask = event.bestAsk || 55;
      
      // Simplified fair price (better: use external oracle or ML)
      const fair = 50; // Default to midpoint for now
      
      const mispricing = calculateMispricing(bid, ask, fair);
      
      return {
        ...event,
        mispricing,
        rank: mispricing.profitPotential
      };
    })
    .filter(e => e.mispricing.profitPotential > threshold)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 50); // Top 50
}

module.exports = { detectMispriced };
```

### 1.6 Arbitrage Endpoint

**backend/routes/arbitrage.js:**
```javascript
const express = require('express');
const axios = require('axios');
const { detectMispriced } = require('../services/mispricingDetector');
const router = express.Router();

router.get('/opportunities', async (req, res) => {
  try {
    // Fetch Polymarket events
    const pmResponse = await axios.get('https://clob.polymarket.com/markets?limit=200');
    const events = pmResponse.data;

    // Find mispriced
    const opportunities = detectMispriced(events);

    res.json({
      count: opportunities.length,
      timestamp: new Date().toISOString(),
      opportunities
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**Add to backend/index.js:**
```javascript
const arbitrageRoutes = require('./routes/arbitrage');
app.use('/api/arbitrage', arbitrageRoutes);
```

### 1.7 Deploy Backend (free)

```bash
# Option 1: Railway (easiest)
npm install -g railway
railway login
railway init
railway up

# Option 2: Render
# Push to GitHub, connect Render.com, auto-deploys
```

**Day 1 Checklist:**
- [ ] Backend running locally (`npm run dev`)
- [ ] `/api/arbitrage/opportunities` returns live data
- [ ] Deployed to Railway/Render (get live URL)

---

## DAY 2: FRONTEND DASHBOARD

### 2.1 Frontend Setup

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install axios recharts tailwindcss
```

### 2.2 Main App Component

**frontend/src/App.jsx:**
```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/arbitrage/opportunities`);
      setOpportunities(res.data.opportunities || []);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on load
  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchOpportunities, 120000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#1B2128] text-white p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Prediction Arbitrage</h1>
        <p className="text-gray-400">Find mispricings in Polymarket + Kalshi</p>
      </header>

      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-400">
          Last update: {lastUpdate || 'Never'}
        </div>
        <button
          onClick={fetchOpportunities}
          disabled={loading}
          className="px-4 py-2 bg-[#387ED1] hover:bg-blue-600 rounded font-semibold disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh Now'}
        </button>
      </div>

      <Dashboard opportunities={opportunities} />
    </div>
  );
}
```

### 2.3 Dashboard Component

**frontend/src/components/Dashboard.jsx:**
```jsx
import EventCard from './EventCard';
import Stats from './Stats';

export default function Dashboard({ opportunities }) {
  return (
    <div>
      <Stats opportunities={opportunities} />
      
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Top Opportunities</h2>
        
        {opportunities.length === 0 ? (
          <p className="text-gray-400">No mispriced markets found. Check back later.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map(opp => (
              <EventCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 2.4 Event Card

**frontend/src/components/EventCard.jsx:**
```jsx
export default function EventCard({ opportunity }) {
  const { name, mispricing, url } = opportunity;
  const { fair, market, edge, spreadWidth } = mispricing;
  const edgePercent = (edge * 100).toFixed(1);

  return (
    <div className="bg-[#2A2F37] rounded-lg p-4 border border-gray-700 hover:border-[#387ED1] transition">
      <h3 className="font-bold text-lg mb-2 line-clamp-2">{name}</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Market Price:</span>
          <span className="font-mono">{market.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Fair Price:</span>
          <span className="font-mono">{fair.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Edge:</span>
          <span className={`font-mono font-bold ${edge > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {edgePercent}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Spread:</span>
          <span className="font-mono">{spreadWidth.toFixed(2)}</span>
        </div>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block w-full text-center bg-[#387ED1] hover:bg-blue-600 py-2 rounded font-semibold text-sm"
      >
        Bet on Polymarket →
      </a>
    </div>
  );
}
```

### 2.5 Stats Component

**frontend/src/components/Stats.jsx:**
```jsx
export default function Stats({ opportunities }) {
  const totalEdge = opportunities.reduce((sum, o) => sum + o.mispricing.edge, 0);
  const avgEdge = opportunities.length > 0 ? (totalEdge / opportunities.length * 100).toFixed(2) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-[#2A2F37] rounded-lg p-6 border border-gray-700">
        <div className="text-gray-400 text-sm">Opportunities Found</div>
        <div className="text-4xl font-bold">{opportunities.length}</div>
      </div>

      <div className="bg-[#2A2F37] rounded-lg p-6 border border-gray-700">
        <div className="text-gray-400 text-sm">Average Edge</div>
        <div className="text-4xl font-bold">{avgEdge}%</div>
      </div>

      <div className="bg-[#2A2F37] rounded-lg p-6 border border-gray-700">
        <div className="text-gray-400 text-sm">Max Edge</div>
        <div className="text-4xl font-bold">
          {opportunities.length > 0
            ? (Math.max(...opportunities.map(o => o.mispricing.edge)) * 100).toFixed(1)
            : '0'}
          %
        </div>
      </div>
    </div>
  );
}
```

### 2.6 Styles

**frontend/src/styles.css:**
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1B2128;
  color: #fff;
}

a {
  color: inherit;
  text-decoration: none;
}

button:active {
  transform: scale(0.98);
}
```

### 2.7 Deploy Frontend

```bash
# Create .env.local
echo "VITE_API_URL=https://your-railway-url.railway.app" > .env.local

# Deploy to Vercel
npm install -g vercel
vercel
```

**Day 2 Checklist:**
- [ ] Frontend loads at http://localhost:5173
- [ ] Fetches data from backend (/api/arbitrage/opportunities)
- [ ] Displays opportunities in cards
- [ ] Deployed to Vercel (get live URL)

---

## DAY 3: POLISH + TESTING

### 3.1 Add Filters

**frontend/src/components/Filter.jsx:**
```jsx
export default function Filter({ onFilterChange }) {
  return (
    <div className="flex gap-4 mb-6">
      <select
        onChange={(e) => onFilterChange('minEdge', parseFloat(e.target.value))}
        className="px-3 py-2 bg-[#2A2F37] border border-gray-700 rounded text-white"
      >
        <option value={0}>Min Edge: Any</option>
        <option value={0.02}>Min Edge: 2%</option>
        <option value={0.05}>Min Edge: 5%</option>
        <option value={0.1}>Min Edge: 10%</option>
      </select>

      <select
        onChange={(e) => onFilterChange('sortBy', e.target.value)}
        className="px-3 py-2 bg-[#2A2F37] border border-gray-700 rounded text-white"
      >
        <option value="edge">Sort: By Edge</option>
        <option value="volume">Sort: By Volume</option>
        <option value="spread">Sort: By Spread</option>
      </select>
    </div>
  );
}
```

### 3.2 Error Handling

Add to **App.jsx:**
```jsx
const [error, setError] = useState(null);

// In fetchOpportunities catch:
setError(error.message);
setTimeout(() => setError(null), 5000);

// In JSX:
{error && (
  <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded text-red-200">
    {error}
  </div>
)}
```

### 3.3 Mobile Responsiveness

Dashboard is already responsive (Tailwind grid).

### 3.4 Test with Friends

- Share Vercel link
- Get feedback on UX
- Fix bugs
- Collect feature requests

**Day 3 Checklist:**
- [ ] Dashboard responsive on mobile
- [ ] Error handling works
- [ ] 5 friends tested it
- [ ] No console errors

---

## DAY 4-5: SHIP + MARKETING

### 4.1 ProductHunt Launch

1. Create ProductHunt account
2. Post link to dashboard
3. Tagline: "Find mispricings in Polymarket and Kalshi before anyone else"
4. Description: Free tool that fetches all prediction markets, calculates true probabilities, shows arbitrage opportunities
5. Screenshot: Dashboard with top 3 opportunities highlighted

### 4.2 Hacker News

Post to "Show HN" with title:
"Show HN: Prediction Arbitrage — Find mispricings in Polymarket/Kalshi"

### 4.3 Twitter/LinkedIn Posts

```
Day 1: "Just shipped a free tool that finds mispricings in prediction 
markets. Fetches Polymarket + Kalshi live, calculates true probability, 
shows you where to bet. 100% free. Link in replies. 

[live.predictionarbitrage.com]"

Day 2: "1,000 visits in 24h. Here's what I learned:
- Traders obsess over live data
- Spread width matters more than I thought  
- Alert system = the real product

Building that next. Early access: [link to email signup]"

Day 3: "Got asked 'why not charge from day 1?'

Because right now I'm learning what traders actually need.
First 1,000 free users > 10 paid users who got the wrong product.

Month 3: Switching to freemium.
By then I'll know exactly what to charge for."
```

### 4.4 Email Signup (for Pro launch)

Add to dashboard:
```jsx
<div className="fixed bottom-6 right-6 bg-[#387ED1] rounded-lg p-4 max-w-sm">
  <p className="font-bold mb-2">Early Access to Pro</p>
  <p className="text-sm mb-3">Real-time alerts + API access in 2 weeks</p>
  <input
    type="email"
    placeholder="your@email.com"
    className="w-full px-3 py-2 rounded bg-white text-black mb-2"
  />
  <button className="w-full bg-[#10B981] hover:bg-green-600 py-2 rounded font-semibold text-sm">
    Notify Me
  </button>
</div>
```

Store emails in Airtable (free).

**Day 4-5 Checklist:**
- [ ] ProductHunt posted (top 3 upvotes = success)
- [ ] Hacker News posted
- [ ] Twitter thread posted
- [ ] LinkedIn posts posted
- [ ] Email signup capture
- [ ] 500+ unique visitors

---

## DAY 6: FEATURE SPRINT

Based on user feedback, ship 2-3 features:

### Option A: Email Alerts
```javascript
// Add to backend
app.post('/api/alerts/subscribe', async (req, res) => {
  const { email } = req.body;
  // Save to Airtable
  // Send welcome email
  res.json({ success: true });
});

// Cron job (every 5 mins)
setInterval(async () => {
  const opportunities = await fetchOpportunities();
  const newOpps = filterNewOnes(opportunities);
  
  // Email users about new high-edge opportunities
  emailSubscribers(newOpps);
}, 300000);
```

### Option B: Export Data (CSV)
```jsx
const downloadCSV = () => {
  const csv = [
    ['Market', 'Fair Price', 'Market Price', 'Edge %'],
    ...opportunities.map(o => [
      o.name,
      o.mispricing.fair,
      o.mispricing.market,
      (o.mispricing.edge * 100).toFixed(2)
    ])
  ];
  
  const blob = new Blob([csv.map(r => r.join(',')).join('\n')]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `opportunities-${Date.now()}.csv`;
  a.click();
};
```

### Option C: Notification Badge
Show "NEW" badge next to markets that appeared in last refresh.

**Day 6 Checklist:**
- [ ] 1 new feature shipped based on user feedback
- [ ] No new bugs introduced
- [ ] Posted about it on Twitter/LinkedIn

---

## DAY 7: METRICS + PLANNING

### 7.1 Measure

- Unique visitors (Week 1)
- Daily active users
- Features most used
- Which markets generate most interest
- Email signups (conversion to Pro)

### 7.2 Next Sprint (Week 2-3)

**Priority 1: Email Alerts** (biggest ask)
**Priority 2: API Access** (for serious traders)
**Priority 3: Historical Data** (backtesting)

### 7.3 LinkedIn Thread

```
"Week 1 complete. Shipped a free prediction market analyzer.

Stats:
- 1,500 unique visitors
- 150 daily active users  
- 200 email signups (for Pro)
- 5% said 'this is exactly what I needed'

Why this matters:
The 5% is my product-market fit signal. Those 5% become my Pro users.
The 95% teach me what's actually valuable.

Next: Email alerts. Users asked for this 47 times. That's the signal.

Building in public. Follow for updates."
```

**Day 7 Checklist:**
- [ ] Measure all metrics
- [ ] Plan Week 2 features
- [ ] Post Week 1 recap
- [ ] React to feedback in email

---

## TIMELINE TO MONETIZATION

**Week 1-2:** Free dashboard + email signups (learn what users want)
**Week 3:** Launch Pro (₹999/month: real-time data + alerts + API)
**Month 2:** 5% conversion from 1000 users = 50 paying = ₹49.9k MRR
**Month 3:** Hit ₹100k+ MRR if growth continues
**Month 4:** Hire first person (customer success / sales)

---

## SOLO-SHIPPABLE CHECKLIST

- [x] No database (cache in memory)
- [x] No auth system (free for everyone)
- [x] Minimal backend (fetch APIs, do math, return JSON)
- [x] No infrastructure costs (free tiers: Vercel + Railway)
- [x] No dependencies outside your control (use public APIs)
- [x] Can ship alone in 7 days

---

## LINKEDIN NARRATIVE (FOR POSTS)

**Week 1: "Shipping in Public"**
"Built a prediction market analyzer in 6 days. Free. Live. Here's the tech stack and why I started."

**Week 2: "Product-Market Fit Signals"**
"1,000 users in 7 days. But here's what really matters: 50 said 'I need the alert version.' That's the signal."

**Week 3: "Going Freemium"**
"Launching Pro tier this week. ₹999/month for real-time data. 100 email signups already. Here's why the pricing."

**Month 2: "Building the Moat"**
"₹50k MRR from 1 person. No investors. No marketing budget. Just users who needed this."

**Month 3: "Hiring Time"**
"Looking for first co-founder. Preferably someone who trades or understands quant. We're building something defensible."

---

## WHAT NOT TO DO

- Don't add a database until week 3 (cache is fine)
- Don't worry about auth until month 2
- Don't optimize for mobile until you have 1000 users
- Don't build admin dashboard until you have 10 paying users
- Don't reach out to investors until month 3

---

## RESOURCES

**Polymarket API:** https://clob.polymarket.com/docs
**Kalshi API:** https://www.kalshi.com/api
**Railway:** https://railway.app (backend hosting)
**Vercel:** https://vercel.com (frontend hosting)
**ProductHunt:** https://producthunt.com

Good luck. Ship fast. Learn faster.
