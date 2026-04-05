import { useMemo, useState } from "react";
import { CheckCircle2, Rocket } from "lucide-react";
import { buildApiUrl, fetchJson } from "../utils/api";

function OnboardingWizard() {
  const [email, setEmail] = useState(() => localStorage.getItem("pa-user-email") || "");
  const [minEdge, setMinEdge] = useState(15);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(() => ({
    email: Boolean(localStorage.getItem("pa-user-email")),
    alerts: false,
    notifications: Boolean(localStorage.getItem("notificationEmail")),
    api: Boolean(localStorage.getItem("pa-api-key")),
  }));

  const progress = useMemo(() => Object.values(completed).filter(Boolean).length, [completed]);

  function markStep(step, value = true) {
    setCompleted((previous) => ({
      ...previous,
      [step]: value,
    }));
  }

  async function saveEmail() {
    if (!email) {
      setStatus("Enter a valid email first.");
      return;
    }

    localStorage.setItem("pa-user-email", email);
    markStep("email", true);
    setStatus("Email saved.");
  }

  async function enableAlerts() {
    if (!email) {
      setStatus("Save your email first.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJson(buildApiUrl("/api/alerts/subscribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          minEdge: minEdge / 100,
          platforms: ["polymarket", "kalshi"],
        }),
      });

      markStep("alerts", true);
      setStatus("Alerts enabled.");
    } catch (error) {
      setStatus(error.message || "Could not enable alerts.");
    } finally {
      setLoading(false);
    }
  }

  async function enableNotifications() {
    if (!email) {
      setStatus("Save your email first.");
      return;
    }

    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Browser notifications were not granted.");
        return;
      }
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJson(buildApiUrl("/api/notifications/subscribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      localStorage.setItem("notificationEmail", email);
      markStep("notifications", true);
      setStatus("Smart notifications enabled.");
    } catch (error) {
      setStatus(error.message || "Could not enable notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function generateApiKey() {
    if (!email) {
      setStatus("Save your email first.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const payload = await fetchJson(buildApiUrl("/api/auth/generate-key"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (payload.apiKey) {
        localStorage.setItem("pa-api-key", payload.apiKey);
      }

      markStep("api", true);
      setStatus("API key generated.");
    } catch (error) {
      setStatus(error.message || "Could not generate API key.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Rocket size={16} className="text-pa-gold" />
        <p className="text-sm font-semibold text-pa-text">Onboarding Wizard</p>
      </div>

      <p className="text-xs text-pa-muted">
        Complete setup in 4 steps. Progress: {progress}/4
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value.trim())}
          placeholder="you@example.com"
          className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />

        <div className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-xs">
          <label className="text-pa-muted">
            Alert threshold: <span className="text-pa-text">{minEdge}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={minEdge}
            onChange={(event) => setMinEdge(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={saveEmail}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-pa-muted transition hover:text-pa-text"
        >
          Save Email {completed.email ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={enableAlerts}
          disabled={loading}
          className="rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Enable Alerts {completed.alerts ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={enableNotifications}
          disabled={loading}
          className="rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Enable Notifications {completed.notifications ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={generateApiKey}
          disabled={loading}
          className="rounded-lg border border-pa-gold/40 bg-pa-gold/10 px-3 py-2 text-xs font-semibold text-pa-gold transition hover:bg-pa-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Generate API Key {completed.api ? "✓" : ""}
        </button>
      </div>

      {progress === 4 ? (
        <p className="mt-3 inline-flex items-center gap-1 rounded-md border border-pa-green/40 bg-pa-green/10 px-2 py-1 text-xs text-pa-green">
          <CheckCircle2 size={12} /> Setup complete. You are production ready.
        </p>
      ) : null}

      {status ? <p className="mt-3 text-xs text-pa-muted">{status}</p> : null}
    </section>
  );
}

export default OnboardingWizard;
