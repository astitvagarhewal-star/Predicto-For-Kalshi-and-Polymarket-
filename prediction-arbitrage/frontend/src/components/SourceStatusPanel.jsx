function formatTimestamp(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) {
    return "No successful sync yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No successful sync yet";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SourceCard({ source }) {
  const statusTone = source.status === "live" && !source.isStale
    ? "text-pa-green"
    : source.status === "error"
      ? "text-pa-red"
      : "text-amber-400";

  const statusLabel = source.status === "live"
    ? source.isStale
      ? "Stale"
      : "Live"
    : source.status === "error"
      ? "Error"
      : "Idle";

  return (
    <article className="rounded-xl border border-slate-700 bg-pa-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pa-text">{source.name}</h3>
        <span className={`text-xs font-semibold uppercase tracking-wide ${statusTone}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1 text-xs text-pa-muted">
        <p>Last success: {formatRelativeTime(source.lastSuccessAt)}</p>
        <p className="text-slate-500">{formatTimestamp(source.lastSuccessAt)}</p>
        <p>Last attempt: {formatTimestamp(source.lastAttemptAt)}</p>
        <p>Markets fetched: {Number(source.lastMarketCount || 0).toLocaleString()}</p>
        {source.lastError ? <p className="text-pa-red">Error: {source.lastError}</p> : null}
      </div>
    </article>
  );
}

function SourceStatusPanel({ sourceStatus }) {
  const polymarket = sourceStatus?.polymarket;
  const kalshi = sourceStatus?.kalshi;

  if (!polymarket && !kalshi) {
    return null;
  }

  return (
    <section className="grid grid-cols-1 gap-3">
      {polymarket ? <SourceCard source={polymarket} /> : null}
      {kalshi ? <SourceCard source={kalshi} /> : null}
    </section>
  );
}

export default SourceStatusPanel;
