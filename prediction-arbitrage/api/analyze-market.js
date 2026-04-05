const { analyzeMarket } = require("../backend/services/opportunityService");

function parseBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  if (typeof body === "object") {
    return body;
  }

  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const payload = await analyzeMarket({
      platform: body?.platform,
      marketId: body?.marketId,
    });

    res.status(200).json(payload);
  } catch (error) {
    const message = error?.message || "Internal server error";

    if (
      message === "marketId is required"
      || message === "platform must be polymarket or kalshi"
    ) {
      res.status(400).json({ error: message });
      return;
    }

    if (message === "Market not found") {
      res.status(404).json({ error: message });
      return;
    }

    console.error("Analyze market API error:", message);
    res.status(500).json({ error: "Internal server error" });
  }
};
