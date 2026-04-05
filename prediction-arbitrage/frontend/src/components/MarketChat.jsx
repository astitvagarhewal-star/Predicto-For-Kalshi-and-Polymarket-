import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { buildApiUrl, fetchJson, getSocketUrl } from "../utils/api";

function MarketChat({ marketId, marketName }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [sentiment, setSentiment] = useState(null);
  const socketRef = useRef(null);
  const userIdRef = useRef("anonymous");

  useEffect(() => {
    const saved = localStorage.getItem("pa-chat-user");
    if (saved) {
      userIdRef.current = saved;
      return;
    }

    const generated = `anon-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem("pa-chat-user", generated);
    userIdRef.current = generated;
  }, []);

  useEffect(() => {
    if (!marketId) {
      return undefined;
    }

    const socket = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;
    socket.emit("join-market", marketId);
    socket.emit("get-messages", marketId);

    socket.on("new-message", (incoming) => {
      if (String(incoming.marketId || "") !== String(marketId)) {
        return;
      }

      setMessages((previous) => [...previous.slice(-80), incoming]);
    });

    socket.on("message-history", (history) => {
      setMessages(Array.isArray(history) ? history : []);
    });

    fetchJson(buildApiUrl(`/api/chat/sentiment/${marketId}`))
      .then((payload) => setSentiment(payload))
      .catch(() => setSentiment(null));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [marketId]);

  async function sendMessage() {
    const text = message.trim();
    if (!text || !socketRef.current || !marketId) {
      return;
    }

    socketRef.current.emit("send-message", {
      marketId,
      message: text,
      userId: userIdRef.current,
    });

    setMessage("");

    try {
      const payload = await fetchJson(buildApiUrl(`/api/chat/sentiment/${marketId}`));
      setSentiment(payload);
    } catch {
      setSentiment(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="text-sm font-semibold text-pa-text">Live Chat</p>
      <p className="mt-1 text-xs text-pa-muted">{marketName || marketId || "Select a market"}</p>

      {sentiment ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-pa-green/40 bg-pa-green/10 px-2 py-1 text-pa-green">
            {sentiment.bullish} bullish
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-900/40 px-2 py-1 text-pa-muted">
            {sentiment.neutral} neutral
          </span>
          <span className="rounded-md border border-pa-red/40 bg-pa-red/10 px-2 py-1 text-pa-red">
            {sentiment.bearish} bearish
          </span>
        </div>
      ) : null}

      <div className="scrollbar-thin mt-3 h-52 overflow-y-auto rounded-lg border border-slate-700 bg-[#0f1b33] p-3 text-xs">
        {messages.length === 0 ? (
          <p className="text-pa-muted">No messages yet. Start the discussion.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((entry) => (
              <p key={entry.id || `${entry.userId}-${entry.timestamp}`} className="leading-relaxed text-pa-text">
                <span className="font-mono text-pa-blue">{String(entry.userId || "anon").slice(0, 8)}:</span>
                <span className="ml-2">{entry.text}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              sendMessage();
            }
          }}
          placeholder="Share your thesis..."
          className="flex-1 rounded-lg border border-slate-700 bg-[#0f1b33] px-3 py-2 text-xs text-pa-text outline-none focus:border-pa-blue"
        />
        <button
          type="button"
          onClick={sendMessage}
          className="rounded-lg border border-pa-blue bg-pa-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          Send
        </button>
      </div>
    </section>
  );
}

export default MarketChat;
