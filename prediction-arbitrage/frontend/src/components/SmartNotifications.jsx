import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { io } from "socket.io-client";
import { buildApiUrl, fetchJson, getSocketUrl } from "../utils/api";

function SmartNotifications() {
  const [email, setEmail] = useState(() => localStorage.getItem("notificationEmail") || "");
  const [subscribed, setSubscribed] = useState(() => Boolean(localStorage.getItem("notificationEmail")));
  const [snoozedUntil, setSnoozedUntil] = useState(null);
  const [events, setEvents] = useState([]);
  const [clock, setClock] = useState(() => Date.now());
  const socketRef = useRef(null);

  const snoozeTime = useMemo(
    () => (snoozedUntil ? new Date(snoozedUntil).getTime() : 0),
    [snoozedUntil]
  );
  const isSnoozed = snoozeTime > clock;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(Date.now());
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!subscribed || !email) {
      return undefined;
    }

    const socket = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;
    socket.emit("subscribe-notifications", email);

    socket.on("smart-notification", (payload) => {
      setEvents((previous) => [payload, ...previous].slice(0, 20));

      if (!isSnoozed && "Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("Prediction Arbitrage", {
          body: payload.message,
          tag: payload.id,
        });

        if (payload.url) {
          notification.onclick = () => window.open(payload.url, "_blank", "noopener,noreferrer");
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [email, isSnoozed, subscribed]);

  async function subscribe() {
    if (!email) {
      return;
    }

    if ("Notification" in window && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }
    }

    const payload = await fetchJson(buildApiUrl("/api/notifications/subscribe"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    setSubscribed(true);
    setSnoozedUntil(payload.snoozeUntil || null);
    localStorage.setItem("notificationEmail", email);
  }

  async function snooze(minutes) {
    if (!email) {
      return;
    }

    const payload = await fetchJson(buildApiUrl("/api/notifications/snooze"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, minutes }),
    });

    setSnoozedUntil(payload.snoozeUntil || null);
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Bell size={16} className="text-pa-blue" />
        <p className="text-sm font-semibold text-pa-text">Smart Notifications</p>
      </div>

      <p className="text-xs text-pa-muted">Browser + email alerts with server-side snooze controls.</p>

      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value.trim())}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-sm text-pa-text outline-none focus:border-pa-blue"
        />

        <button
          type="button"
          onClick={subscribe}
          className="rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          {subscribed ? "Subscribed" : "Enable"}
        </button>
      </div>

      {subscribed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => snooze(30)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-pa-muted hover:text-pa-text"
          >
            Snooze 30m
          </button>
          <button
            type="button"
            onClick={() => snooze(60)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-pa-muted hover:text-pa-text"
          >
            Snooze 1h
          </button>
          {snoozedUntil ? (
            <span className="rounded-md border border-pa-gold/40 bg-pa-gold/10 px-2 py-1 text-xs text-pa-gold">
              Snoozed until {new Date(snoozedUntil).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      ) : null}

      {events.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-pa-muted">Recent Events</p>
          {events.slice(0, 3).map((event) => (
            <article key={event.id} className="rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-xs text-pa-text">
              <p>{event.message}</p>
              <p className="mt-1 text-pa-muted">{new Date(event.timestamp).toLocaleTimeString()}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default SmartNotifications;
