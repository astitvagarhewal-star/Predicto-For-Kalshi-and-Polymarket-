const { getOpportunities } = require("../../backend/services/opportunityService");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = await getOpportunities(req.query || {});
    res.status(200).json(payload);
  } catch (error) {
    console.error("Opportunities API error:", error?.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
};
