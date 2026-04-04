import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";

const DEFAULT_STATE = {
  items: [],
  votes: {},
};

export function useWatchlist() {
  const [state, setState] = useLocalStorage("pa-watchlist", DEFAULT_STATE);

  const watchlistIds = useMemo(
    () => new Set(state.items.map((item) => `${item.market}:${item.id}`)),
    [state.items]
  );

  const toggleWatchlist = useCallback(
    (opportunity) => {
      if (!opportunity) {
        return;
      }

      setState((current) => {
        const key = `${opportunity.market}:${opportunity.id}`;
        const exists = current.items.some((item) => `${item.market}:${item.id}` === key);

        if (exists) {
          return {
            ...current,
            items: current.items.filter((item) => `${item.market}:${item.id}` !== key),
          };
        }

        return {
          ...current,
          items: [
            {
              id: opportunity.id,
              market: opportunity.market,
              name: opportunity.name,
              bestBid: opportunity.bestBid,
              bestAsk: opportunity.bestAsk,
              edge: opportunity.edge,
              signedEdge: opportunity.signedEdge,
              url: opportunity.url,
              alertPrice: null,
              pinned: false,
              addedAt: new Date().toISOString(),
            },
            ...current.items,
          ],
        };
      });
    },
    [setState]
  );

  const setAlertPrice = useCallback(
    (watchKey, alertPrice) => {
      setState((current) => ({
        ...current,
        items: current.items.map((item) => {
          const key = `${item.market}:${item.id}`;
          return key === watchKey
            ? { ...item, alertPrice: alertPrice ? Number(alertPrice) : null }
            : item;
        }),
      }));
    },
    [setState]
  );

  const togglePin = useCallback(
    (watchKey) => {
      setState((current) => ({
        ...current,
        items: current.items.map((item) => {
          const key = `${item.market}:${item.id}`;
          return key === watchKey ? { ...item, pinned: !item.pinned } : item;
        }),
      }));
    },
    [setState]
  );

  const castSentimentVote = useCallback(
    (marketKey, voteType) => {
      if (!marketKey) {
        return;
      }

      if (!["overpriced", "fair", "underpriced"].includes(voteType)) {
        return;
      }

      setState((current) => {
        const existing = current.votes[marketKey] || {
          overpriced: 0,
          fair: 0,
          underpriced: 0,
        };

        return {
          ...current,
          votes: {
            ...current.votes,
            [marketKey]: {
              ...existing,
              [voteType]: existing[voteType] + 1,
            },
          },
        };
      });
    },
    [setState]
  );

  const sortedItems = useMemo(
    () =>
      [...state.items].sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      }),
    [state.items]
  );

  return {
    watchlist: sortedItems,
    watchlistIds,
    localVotes: state.votes,
    toggleWatchlist,
    setAlertPrice,
    togglePin,
    castSentimentVote,
  };
}
