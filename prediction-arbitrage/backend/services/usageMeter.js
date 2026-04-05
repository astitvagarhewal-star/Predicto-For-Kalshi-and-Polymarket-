const usageByKey = new Map();

function nowIso() {
  return new Date().toISOString();
}

function ensureUsage(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) {
    return null;
  }

  if (!usageByKey.has(key)) {
    usageByKey.set(key, {
      apiKey: key,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      endpointCounts: {},
      minuteWindowStart: Date.now(),
      minuteWindowCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastRequestAt: null,
    });
  }

  return usageByKey.get(key);
}

function checkAndIncrementRate(apiKey, maxPerMinute = 120) {
  const usage = ensureUsage(apiKey);
  if (!usage) {
    return {
      allowed: false,
      retryAfterSeconds: 60,
      remaining: 0,
      limit: maxPerMinute,
    };
  }

  const now = Date.now();
  if (now - usage.minuteWindowStart >= 60 * 1000) {
    usage.minuteWindowStart = now;
    usage.minuteWindowCount = 0;
  }

  if (usage.minuteWindowCount >= maxPerMinute) {
    const retryAfterMs = 60 * 1000 - (now - usage.minuteWindowStart);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0,
      limit: maxPerMinute,
    };
  }

  usage.minuteWindowCount += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxPerMinute - usage.minuteWindowCount),
    limit: maxPerMinute,
  };
}

function recordUsage({ apiKey, endpoint, statusCode }) {
  const usage = ensureUsage(apiKey);
  if (!usage) {
    return null;
  }

  const path = String(endpoint || "unknown");
  usage.totalRequests += 1;
  usage.endpointCounts[path] = (usage.endpointCounts[path] || 0) + 1;

  if (Number(statusCode) >= 400) {
    usage.failedRequests += 1;
  } else {
    usage.successfulRequests += 1;
  }

  usage.lastRequestAt = nowIso();
  usage.updatedAt = nowIso();

  return usage;
}

function getUsage(apiKey) {
  const usage = ensureUsage(apiKey);
  if (!usage) {
    return null;
  }

  return {
    apiKey: usage.apiKey,
    totalRequests: usage.totalRequests,
    successfulRequests: usage.successfulRequests,
    failedRequests: usage.failedRequests,
    endpointCounts: usage.endpointCounts,
    minuteWindowCount: usage.minuteWindowCount,
    minuteLimit: 120,
    createdAt: usage.createdAt,
    updatedAt: usage.updatedAt,
    lastRequestAt: usage.lastRequestAt,
  };
}

module.exports = {
  checkAndIncrementRate,
  recordUsage,
  getUsage,
};
