import { useQuery } from "@tanstack/react-query";

const ENV_API_URL = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const IS_LOCALHOST_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(ENV_API_URL);
const API_URL = import.meta.env.PROD
  ? ENV_API_URL && !IS_LOCALHOST_URL
    ? ENV_API_URL
    : ""
  : ENV_API_URL || "http://localhost:5000";

function toQueryString(filters) {
  const params = new URLSearchParams();

  if (Number(filters?.minEdge) > 0) {
    params.set("minEdge", String(filters.minEdge));
  }

  if (filters?.market && filters.market !== "all") {
    params.set("market", filters.market);
  }

  if (filters?.search) {
    params.set("search", filters.search);
  }

  if (filters?.sortBy) {
    params.set("sortBy", filters.sortBy);
  }

  if (Number(filters?.limit) > 0) {
    params.set("limit", String(filters.limit));
  }

  return params.toString();
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return response.json();
}

export function useFetchOpportunities(filters) {
  return useQuery({
    queryKey: ["opportunities", filters],
    queryFn: async () => {
      const query = toQueryString(filters);
      const url = query
        ? `${API_URL}/api/arbitrage/opportunities?${query}`
        : `${API_URL}/api/arbitrage/opportunities`;
      return fetchJson(url);
    },
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFetchOpportunityHistory() {
  return useQuery({
    queryKey: ["opportunity-history"],
    queryFn: async () => fetchJson(`${API_URL}/api/arbitrage/history`),
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export async function analyzeMarketRequest({ platform, marketId }) {
  return fetchJson(`${API_URL}/api/analyze-market`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ platform, marketId }),
  });
}
