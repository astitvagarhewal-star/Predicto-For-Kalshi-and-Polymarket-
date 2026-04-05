const crypto = require("crypto");

let Airtable = null;
try {
  Airtable = require("airtable");
} catch (_error) {
  Airtable = null;
}

const TABLES = {
  USERS: "Users",
  ALERTS: "Alerts",
  WATCHLIST: "Watchlist",
  TRADES: "Trades",
  CHAT_MESSAGES: "ChatMessages",
  NOTIFICATIONS: "Notifications",
  HISTORICAL: "Historical",
};

const memoryDb = {
  [TABLES.USERS]: [],
  [TABLES.ALERTS]: [],
  [TABLES.WATCHLIST]: [],
  [TABLES.TRADES]: [],
  [TABLES.CHAT_MESSAGES]: [],
  [TABLES.NOTIFICATIONS]: [],
  [TABLES.HISTORICAL]: [],
};

const airtableEnabled = Boolean(
  Airtable
  && process.env.AIRTABLE_KEY
  && process.env.AIRTABLE_BASE
);

const base = airtableEnabled
  ? new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(process.env.AIRTABLE_BASE)
  : null;

function createRecordId(prefix = "rec") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFormulaValue(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function toPublicRecord(record) {
  if (!record) {
    return null;
  }

  if (record.fields) {
    return {
      id: record.id,
      ...record.fields,
    };
  }

  return {
    id: record.id,
    ...record,
  };
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortByTimestamp(records, direction = "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    const aTime = new Date(a.timestamp || a.createdAt || a.savedTime || 0).getTime();
    const bTime = new Date(b.timestamp || b.createdAt || b.savedTime || 0).getTime();
    return (aTime - bTime) * multiplier;
  });
}

async function create(table, fields) {
  if (base) {
    try {
      const record = await base(table).create({ fields });
      return toPublicRecord(record);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  const record = {
    id: createRecordId(table.toLowerCase()),
    ...fields,
  };
  memoryDb[table].push(record);
  return toPublicRecord(record);
}

async function update(table, recordId, fields) {
  if (base) {
    try {
      const record = await base(table).update(recordId, { fields });
      return toPublicRecord(record);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  const index = memoryDb[table].findIndex((item) => item.id === recordId);
  if (index < 0) {
    return null;
  }

  memoryDb[table][index] = {
    ...memoryDb[table][index],
    ...fields,
  };

  return toPublicRecord(memoryDb[table][index]);
}

async function destroy(table, recordId) {
  if (base) {
    try {
      await base(table).destroy(recordId);
      return true;
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  const nextRows = memoryDb[table].filter((item) => item.id !== recordId);
  const deleted = nextRows.length !== memoryDb[table].length;
  memoryDb[table] = nextRows;
  return deleted;
}

async function listByEmail(table, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  if (base) {
    try {
      const records = await base(table)
        .select({
          filterByFormula: `{email} = '${sanitizeFormulaValue(normalizedEmail)}'`,
        })
        .all();
      return records.map(toPublicRecord);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  return memoryDb[table]
    .filter((row) => normalizeEmail(row.email) === normalizedEmail)
    .map(toPublicRecord);
}

async function listAlertsByEmail(email) {
  return listByEmail(TABLES.ALERTS, email);
}

async function listActiveAlerts() {
  if (base) {
    try {
      const records = await base(TABLES.ALERTS)
        .select({
          filterByFormula: "{active} = TRUE()",
        })
        .all();

      return records.map(toPublicRecord);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  return memoryDb[TABLES.ALERTS]
    .filter((row) => Boolean(row.active))
    .map(toPublicRecord);
}

async function createAlert({ email, minEdge, platforms }) {
  return create(TABLES.ALERTS, {
    email: normalizeEmail(email),
    minEdge: asNumber(minEdge, 0),
    platforms: Array.isArray(platforms) ? platforms.join(",") : String(platforms || ""),
    active: true,
    createdAt: nowIso(),
  });
}

async function deleteAlert(alertId) {
  return destroy(TABLES.ALERTS, alertId);
}

async function addWatchlistItem({ email, marketId, marketName, currentPrice, platform }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMarketId = String(marketId || "").trim();

  if (!normalizedEmail || !normalizedMarketId) {
    return null;
  }

  const existing = await listWatchlist(normalizedEmail);
  const duplicate = existing.find((item) => String(item.marketId) === normalizedMarketId);
  if (duplicate) {
    return duplicate;
  }

  return create(TABLES.WATCHLIST, {
    email: normalizedEmail,
    marketId: normalizedMarketId,
    marketName: String(marketName || "Unknown Market"),
    platform: String(platform || "unknown"),
    savedPrice: asNumber(currentPrice, 0),
    savedTime: nowIso(),
  });
}

async function listWatchlist(email) {
  const rows = await listByEmail(TABLES.WATCHLIST, email);
  return sortByTimestamp(rows, "desc");
}

async function removeWatchlistItem(email, marketId) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMarketId = String(marketId || "").trim();

  if (!normalizedEmail || !normalizedMarketId) {
    return false;
  }

  if (base) {
    try {
      const records = await base(TABLES.WATCHLIST)
        .select({
          filterByFormula: `AND({email} = '${sanitizeFormulaValue(normalizedEmail)}', {marketId} = '${sanitizeFormulaValue(normalizedMarketId)}')`,
        })
        .all();

      if (records.length === 0) {
        return false;
      }

      await Promise.all(records.map((record) => base(TABLES.WATCHLIST).destroy(record.id)));
      return true;
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  const prevLength = memoryDb[TABLES.WATCHLIST].length;
  memoryDb[TABLES.WATCHLIST] = memoryDb[TABLES.WATCHLIST].filter(
    (row) => !(normalizeEmail(row.email) === normalizedEmail && String(row.marketId) === normalizedMarketId)
  );
  return memoryDb[TABLES.WATCHLIST].length < prevLength;
}

async function addTrade({ email, marketId, betAmount, outcome, profitLoss }) {
  return create(TABLES.TRADES, {
    email: normalizeEmail(email),
    marketId: String(marketId || "unknown"),
    betAmount: asNumber(betAmount, 0),
    outcome: String(outcome || "unknown"),
    profitLoss: asNumber(profitLoss, 0),
    timestamp: nowIso(),
  });
}

async function listTrades() {
  if (base) {
    try {
      const records = await base(TABLES.TRADES).select().all();
      return records.map(toPublicRecord);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  return memoryDb[TABLES.TRADES].map(toPublicRecord);
}

async function addChatMessage({ marketId, userId, text }) {
  return create(TABLES.CHAT_MESSAGES, {
    marketId: String(marketId || "").trim(),
    userId: String(userId || "anonymous"),
    text: String(text || ""),
    timestamp: nowIso(),
  });
}

async function listChatMessages(marketId, maxRecords = 50) {
  const normalizedMarketId = String(marketId || "").trim();

  if (!normalizedMarketId) {
    return [];
  }

  if (base) {
    try {
      const records = await base(TABLES.CHAT_MESSAGES)
        .select({
          filterByFormula: `{marketId} = '${sanitizeFormulaValue(normalizedMarketId)}'`,
          sort: [{ field: "timestamp", direction: "asc" }],
          maxRecords,
        })
        .all();

      return records.map(toPublicRecord);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  const rows = memoryDb[TABLES.CHAT_MESSAGES]
    .filter((row) => String(row.marketId || "") === normalizedMarketId)
    .map(toPublicRecord);

  return sortByTimestamp(rows, "asc").slice(-maxRecords);
}

async function upsertNotificationSubscription({ email, enabled = true, snoozeUntil = null }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const existing = await listByEmail(TABLES.NOTIFICATIONS, normalizedEmail);
  const fields = {
    email: normalizedEmail,
    enabled: Boolean(enabled),
    snoozeUntil: snoozeUntil || null,
    updatedAt: nowIso(),
  };

  if (existing.length > 0) {
    return update(TABLES.NOTIFICATIONS, existing[0].id, fields);
  }

  return create(TABLES.NOTIFICATIONS, {
    ...fields,
    createdAt: nowIso(),
  });
}

async function snoozeNotifications(email, minutes) {
  const normalizedEmail = normalizeEmail(email);
  const snoozeMinutes = Math.max(1, Math.min(24 * 60, asNumber(minutes, 30)));
  const snoozeUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000).toISOString();

  const saved = await upsertNotificationSubscription({
    email: normalizedEmail,
    enabled: true,
    snoozeUntil,
  });

  return {
    ...saved,
    snoozeUntil,
  };
}

async function listEnabledNotifications() {
  if (base) {
    try {
      const records = await base(TABLES.NOTIFICATIONS)
        .select({
          filterByFormula: "{enabled} = TRUE()",
        })
        .all();

      return records.map(toPublicRecord);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  return memoryDb[TABLES.NOTIFICATIONS]
    .filter((row) => Boolean(row.enabled))
    .map(toPublicRecord);
}

async function createOrUpdateUser({ email, apiKey, plan = "pro" }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const existing = await listByEmail(TABLES.USERS, normalizedEmail);

  if (existing.length > 0) {
    return update(TABLES.USERS, existing[0].id, {
      email: normalizedEmail,
      apiKey,
      plan,
      updatedAt: nowIso(),
    });
  }

  return create(TABLES.USERS, {
    email: normalizedEmail,
    apiKey,
    plan,
    createdAt: nowIso(),
  });
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const matches = await listByEmail(TABLES.USERS, normalizedEmail);
  return matches[0] || null;
}

async function createUser({ email, passwordHash, plan = "free" }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !passwordHash) {
    return null;
  }

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return null;
  }

  return create(TABLES.USERS, {
    email: normalizedEmail,
    passwordHash,
    plan,
    createdAt: nowIso(),
  });
}

async function setUserPassword(userId, passwordHash) {
  if (!userId || !passwordHash) {
    return null;
  }

  return update(TABLES.USERS, userId, {
    passwordHash,
    updatedAt: nowIso(),
  });
}

async function findUserByApiKey(apiKey) {
  const normalizedKey = String(apiKey || "").trim();
  if (!normalizedKey) {
    return null;
  }

  if (base) {
    try {
      const records = await base(TABLES.USERS)
        .select({
          filterByFormula: `{apiKey} = '${sanitizeFormulaValue(normalizedKey)}'`,
        })
        .all();

      return toPublicRecord(records[0] || null);
    } catch (_error) {
      // Fall through to in-memory persistence for local continuity.
    }
  }

  const user = memoryDb[TABLES.USERS].find((row) => String(row.apiKey || "") === normalizedKey);
  return toPublicRecord(user || null);
}

async function listHistoricalSince(days = 7) {
  const lookback = Math.max(1, asNumber(days, 7));
  const threshold = Date.now() - lookback * 24 * 60 * 60 * 1000;

  if (base) {
    try {
      const records = await base(TABLES.HISTORICAL)
        .select({
          sort: [{ field: "date", direction: "desc" }],
          maxRecords: 200,
        })
        .all();

      return records
        .map(toPublicRecord)
        .filter((row) => {
          const time = new Date(row.date || row.createdAt || 0).getTime();
          return Number.isFinite(time) && time >= threshold;
        });
    } catch (_error) {
      return [];
    }
  }

  return memoryDb[TABLES.HISTORICAL]
    .map(toPublicRecord)
    .filter((row) => {
      const time = new Date(row.date || row.createdAt || 0).getTime();
      return Number.isFinite(time) && time >= threshold;
    });
}

function getRuntimeMode() {
  return base ? "airtable" : "memory";
}

module.exports = {
  createAlert,
  listAlertsByEmail,
  listActiveAlerts,
  deleteAlert,
  addWatchlistItem,
  listWatchlist,
  removeWatchlistItem,
  addTrade,
  listTrades,
  addChatMessage,
  listChatMessages,
  upsertNotificationSubscription,
  snoozeNotifications,
  listEnabledNotifications,
  createOrUpdateUser,
  createUser,
  findUserByEmail,
  setUserPassword,
  findUserByApiKey,
  listHistoricalSince,
  getRuntimeMode,
};
