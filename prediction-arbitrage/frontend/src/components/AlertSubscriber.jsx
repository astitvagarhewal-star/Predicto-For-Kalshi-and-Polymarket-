import { useEffect, useMemo, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { buildApiUrl, fetchJson } from "../utils/api";

const PLATFORM_CHOICES = ["polymarket", "kalshi"];

function AlertSubscriber() {
  const [email, setEmail] = useState(() => localStorage.getItem("pa-user-email") || "");
  const [minEdge, setMinEdge] = useState(15);
  const [platforms, setPlatforms] = useState(PLATFORM_CHOICES);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasEmail = useMemo(() => /@/.test(email), [email]);

  async function loadAlerts(currentEmail) {
    if (!currentEmail) {
      setAlerts([]);
      return;
    }

    try {
      const payload = await fetchJson(buildApiUrl("/api/alerts/list"), {
        headers: {
          email: currentEmail,
        },
      });
      setAlerts(payload.alerts || []);
    } catch {
      setAlerts([]);
    }
  }

  useEffect(() => {
    if (!hasEmail) {
      return;
    }

    loadAlerts(email);
  }, [email, hasEmail]);

  async function subscribe() {
    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson(buildApiUrl("/api/alerts/subscribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          minEdge: minEdge / 100,
          platforms,
        }),
      });

      localStorage.setItem("pa-user-email", email);
      setAlerts((previous) => [
        {
          id: payload.alertId,
          email,
          minEdge,
          platforms: platforms.join(","),
          active: true,
        },
        ...previous,
      ]);
    } catch (requestError) {
      setError(requestError.message || "Unable to subscribe right now.");
    } finally {
      setLoading(false);
    }
  }

  async function removeAlert(alertId) {
    try {
      await fetchJson(buildApiUrl(`/api/alerts/${alertId}`), {
        method: "DELETE",
      });

      setAlerts((previous) => previous.filter((alert) => alert.id !== alertId));
    } catch {
      setError("Could not remove alert.");
    }
  }

  function togglePlatform(platform) {
    setPlatforms((previous) => {
      if (previous.includes(platform)) {
        return previous.filter((item) => item !== platform);
      }
      return [...previous, platform];
    });
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell size={16} className="text-pa-gold" />
        <p className="text-sm font-semibold text-pa-text">Alert System</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value.trim())}
          placeholder="you@example.com"
          className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />

        <div>
          <label className="mb-1 block text-xs text-pa-muted">
            Min edge: <span className="text-pa-text">{minEdge}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={minEdge}
            onChange={(event) => setMinEdge(Number(event.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PLATFORM_CHOICES.map((platform) => (
          <button
            key={platform}
            type="button"
            onClick={() => togglePlatform(platform)}
            className={`rounded-md border px-2 py-1 text-xs uppercase tracking-wide transition ${
              platforms.includes(platform)
                ? "border-pa-blue bg-pa-blue/20 text-pa-text"
                : "border-slate-700 bg-slate-900/40 text-pa-muted"
            }`}
          >
            {platform}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-pa-red/40 bg-pa-red/10 px-3 py-2 text-xs text-pa-red">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={subscribe}
        disabled={loading || !hasEmail || platforms.length === 0}
        className="mt-3 inline-flex items-center rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enabling..." : "Enable Alerts"}
      </button>

      {alerts.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-pa-muted">Active Alerts</p>
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-xs"
            >
              <div>
                <p className="text-pa-text">{Number(alert.minEdge || 0).toFixed(1)}% min edge</p>
                <p className="text-pa-muted">{String(alert.platforms || "all")}</p>
              </div>

              <button
                type="button"
                onClick={() => removeAlert(alert.id)}
                className="rounded-md border border-pa-red/40 px-2 py-1 text-pa-red"
                aria-label="Delete alert"
              >
                <Trash2 size={12} />
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default AlertSubscriber;
