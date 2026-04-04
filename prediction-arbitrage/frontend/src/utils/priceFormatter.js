export function formatPercent(value, digits = 2) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return "0.00%";
  }

  return `${parsed.toFixed(digits)}%`;
}

export function formatCurrency(value, currency = "USD") {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return currency === "INR" ? "Rs 0" : "$0";
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  return formatter.format(parsed);
}

export function formatCompactNumber(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(parsed);
}
