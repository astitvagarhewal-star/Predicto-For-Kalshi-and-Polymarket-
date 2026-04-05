import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { buildApiUrl, fetchJson } from "../utils/api";

function ApiUsagePanel() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("pa-api-key") || "");
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const endpointEntries = useMemo(
    () => Object.entries(usage?.endpointCounts || {}).sort((a, b) => b[1] - a[1]),
    [usage?.endpointCounts]
  );

  async function refreshUsage() {
    if (!apiKey) {
      setError("API key is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson(buildApiUrl("/api/v1/usage"), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      setUsage(payload.usage || null);
      localStorage.setItem("pa-api-key", apiKey);
    } catch (requestError) {
      setError(requestError.message || "Failed to load usage.");
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Activity size={16} className="text-pa-gold" />
        <p className="text-sm font-semibold text-pa-text">API Usage Meter</p>
      </div>

      <p className="text-xs text-pa-muted">Monitor API calls, success ratio, and endpoint usage distribution.</p>

      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <input
          type="text"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value.trim())}
          placeholder="pk_..."
          className="flex-1 rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />
        <button
          type="button"
          onClick={refreshUsage}
          disabled={loading || !apiKey}
          className="rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-pa-red/40 bg-pa-red/10 px-3 py-2 text-xs text-pa-red">
          {error}
        </p>
      ) : null}

      {usage ? (
        <div className="mt-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <article className="rounded-lg border border-slate-700 bg-[#0f1b33] p-2">
              <p className="text-pa-muted">Total</p>
              <p className="mt-1 text-pa-text">{usage.totalRequests}</p>
            </article>
            <article className="rounded-lg border border-pa-green/30 bg-pa-green/10 p-2">
              <p className="text-pa-muted">Success</p>
              <p className="mt-1 text-pa-green">{usage.successfulRequests}</p>
            </article>
            <article className="rounded-lg border border-pa-red/30 bg-pa-red/10 p-2">
              <p className="text-pa-muted">Failed</p>
              <p className="mt-1 text-pa-red">{usage.failedRequests}</p>
            </article>
            <article className="rounded-lg border border-pa-gold/30 bg-pa-gold/10 p-2">
              <p className="text-pa-muted">Current Minute</p>
              <p className="mt-1 text-pa-gold">{usage.minuteWindowCount}/{usage.minuteLimit}</p>
            </article>
          </div>

          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-pa-muted">Endpoints</p>
            <div className="mt-2 space-y-1">
              {endpointEntries.length === 0 ? (
                <p className="text-pa-muted">No endpoint usage yet.</p>
              ) : (
                endpointEntries.slice(0, 6).map(([endpoint, count]) => (
                  <p key={endpoint} className="flex items-center justify-between">
                    <span className="text-pa-text">{endpoint}</span>
                    <span className="font-mono text-pa-muted">{count}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ApiUsagePanel;
