export function mergeSentimentWithLocalVotes(sentiment, localVotes) {
  const base = sentiment || {
    percentages: { overpriced: 33, fair: 34, underpriced: 33 },
    consensus: "fair_priced",
  };

  const votes = localVotes || { overpriced: 0, fair: 0, underpriced: 0 };
  const localTotal = votes.overpriced + votes.fair + votes.underpriced;

  if (localTotal <= 0) {
    return base;
  }

  const localPct = {
    overpriced: Math.round((votes.overpriced / localTotal) * 100),
    fair: Math.round((votes.fair / localTotal) * 100),
    underpriced: Math.round((votes.underpriced / localTotal) * 100),
  };

  const blended = {
    overpriced: Math.round(base.percentages.overpriced * 0.7 + localPct.overpriced * 0.3),
    fair: Math.round(base.percentages.fair * 0.7 + localPct.fair * 0.3),
    underpriced: Math.round(base.percentages.underpriced * 0.7 + localPct.underpriced * 0.3),
  };

  const entries = Object.entries(blended).sort((a, b) => b[1] - a[1]);
  const top = entries[0]?.[0] || "fair";

  return {
    ...base,
    percentages: blended,
    consensus:
      top === "overpriced"
        ? "overpriced"
        : top === "underpriced"
          ? "underpriced"
          : "fair_priced",
  };
}
