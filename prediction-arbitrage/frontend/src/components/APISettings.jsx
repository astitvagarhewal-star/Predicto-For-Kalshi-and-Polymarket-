import { useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { buildApiUrl, fetchJson } from "../utils/api";

function APISettings() {
  const [email, setEmail] = useState(() => localStorage.getItem("pa-user-email") || "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateKey() {
    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson(buildApiUrl("/api/auth/generate-key"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      setApiKey(payload.apiKey || "");
      if (payload.apiKey) {
        localStorage.setItem("pa-api-key", payload.apiKey);
      }
      localStorage.setItem("pa-user-email", email);
    } catch (requestError) {
      setError(requestError.message || "Could not generate key.");
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    if (!apiKey) {
      return;
    }

    await navigator.clipboard.writeText(apiKey);
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound size={16} className="text-pa-gold" />
        <p className="text-sm font-semibold text-pa-text">API Access</p>
      </div>

      <p className="text-xs text-pa-muted">Generate a monetizable API key for automated access.</p>

      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value.trim())}
        placeholder="you@example.com"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
      />

      <button
        type="button"
        onClick={generateKey}
        disabled={loading || !email}
        className="mt-3 rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate API Key"}
      </button>

      {error ? (
        <p className="mt-3 rounded-lg border border-pa-red/40 bg-pa-red/10 px-3 py-2 text-xs text-pa-red">
          {error}
        </p>
      ) : null}

      {apiKey ? (
        <div className="mt-4 rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-pa-text">
              {showKey ? apiKey : "*".repeat(apiKey.length)}
            </code>

            <button
              type="button"
              onClick={() => setShowKey((previous) => !previous)}
              className="rounded-md border border-slate-700 p-1 text-pa-muted hover:text-pa-text"
              aria-label="Toggle API key visibility"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            <button
              type="button"
              onClick={copyKey}
              className="rounded-md border border-slate-700 p-1 text-pa-muted hover:text-pa-text"
              aria-label="Copy API key"
            >
              <Copy size={14} />
            </button>
          </div>

          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40 p-2 text-[11px] text-pa-blue">
{`curl ${buildApiUrl("/api/v1/opportunities")} \\
  -H "Authorization: Bearer ${apiKey.slice(0, 12)}..."`}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

export default APISettings;
