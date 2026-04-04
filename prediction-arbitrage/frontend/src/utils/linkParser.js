export function parseMarketLink(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("polymarket.com")) {
      const marketIndex = parts.findIndex((part) => part === "market");
      if (marketIndex !== -1 && parts[marketIndex + 1]) {
        return {
          platform: "polymarket",
          marketId: parts[marketIndex + 1],
          type: "id",
        };
      }

      const eventIndex = parts.findIndex((part) => part === "event");
      if (eventIndex !== -1 && parts[eventIndex + 1]) {
        return {
          platform: "polymarket",
          marketId: parts[eventIndex + 1],
          type: "slug",
        };
      }
    }

    if (host.includes("kalshi.com")) {
      const marketsIndex = parts.findIndex((part) => part === "markets");
      if (marketsIndex !== -1 && parts[marketsIndex + 1]) {
        return {
          platform: "kalshi",
          marketId: parts[marketsIndex + 1],
          type: "ticker",
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}
