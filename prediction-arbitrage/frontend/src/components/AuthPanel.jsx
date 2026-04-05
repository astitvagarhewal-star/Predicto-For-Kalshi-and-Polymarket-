import { useEffect, useMemo, useState } from "react";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { buildApiUrl, fetchJson } from "../utils/api";

const TOKEN_KEY = "pa-auth-token";

function AuthPanel() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(() => localStorage.getItem("pa-user-email") || "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("");

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    fetchJson(buildApiUrl("/api/auth/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((payload) => {
        if (!active) {
          return;
        }
        setUser(payload.user || null);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setUser(null);
        setToken("");
        localStorage.removeItem(TOKEN_KEY);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function submitAuth() {
    setStatus("");

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const payload = await fetchJson(buildApiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const nextToken = payload.token || "";
      setToken(nextToken);
      setUser(payload.user || null);
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem("pa-user-email", email);
      setPassword("");
      setStatus(mode === "register" ? "Account created" : "Signed in");
    } catch (error) {
      setStatus(error.message || "Authentication failed");
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    setStatus("Signed out");
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Lock size={16} className="text-pa-blue" />
        <p className="text-sm font-semibold text-pa-text">Account</p>
      </div>

      {isAuthenticated ? (
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-slate-700 bg-[#0f1b33] p-3">
            <p className="text-pa-muted">Signed in as</p>
            <p className="mt-1 text-sm font-semibold text-pa-text">{user.email}</p>
            <p className="mt-1 text-pa-muted">Plan: {user.plan || "free"}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-pa-muted transition hover:text-pa-text"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-md border px-2 py-1 text-xs ${
                mode === "login"
                  ? "border-pa-blue bg-pa-blue/20 text-pa-text"
                  : "border-slate-700 text-pa-muted"
              }`}
            >
              <span className="inline-flex items-center gap-1"><LogIn size={12} /> Login</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-md border px-2 py-1 text-xs ${
                mode === "register"
                  ? "border-pa-blue bg-pa-blue/20 text-pa-text"
                  : "border-slate-700 text-pa-muted"
              }`}
            >
              <span className="inline-flex items-center gap-1"><UserPlus size={12} /> Register</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value.trim())}
              placeholder="you@example.com"
              className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "register" ? "Min 8 characters" : "Password"}
              className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
            />
          </div>

          <button
            type="button"
            onClick={submitAuth}
            disabled={!email || !password}
            className="mt-3 rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === "register" ? "Create Account" : "Sign In"}
          </button>
        </div>
      )}

      {status ? <p className="mt-3 text-xs text-pa-muted">{status}</p> : null}
    </section>
  );
}

export default AuthPanel;
