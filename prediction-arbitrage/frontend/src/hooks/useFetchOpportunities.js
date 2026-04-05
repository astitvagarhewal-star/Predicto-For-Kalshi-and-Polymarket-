import { useQuery } from "@tanstack/react-query";
import { buildApiUrl, fetchJson } from "../utils/api";

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

export function useFetchOpportunities(filters) {
  return useQuery({
    queryKey: ["opportunities", filters],
    queryFn: async () => {
      const query = toQueryString(filters);
      const url = query
        ? buildApiUrl(`/api/arbitrage/opportunities?${query}`)
        : buildApiUrl("/api/arbitrage/opportunities");
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
    queryFn: async () => fetchJson(buildApiUrl("/api/arbitrage/history")),
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export async function analyzeMarketRequest({ platform, marketId }) {
  return fetchJson(buildApiUrl("/api/analyze-market"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ platform, marketId }),
  });
}
