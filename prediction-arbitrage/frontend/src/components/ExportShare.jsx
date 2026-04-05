import { useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { buildApiUrl } from "../utils/api";

function toShareId(ids) {
  const joined = ids.join(",");
  const binary = new TextEncoder().encode(joined);
  let text = "";
  binary.forEach((byte) => {
    text += String.fromCharCode(byte);
  });
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function ExportShare({ opportunities }) {
  const [copied, setCopied] = useState(false);
  const topIds = useMemo(
    () => (Array.isArray(opportunities) ? opportunities.slice(0, 10).map((item) => item.id) : []),
    [opportunities]
  );

  async function exportCsv() {
    const query = topIds.length > 0
      ? `?markets=${encodeURIComponent(topIds.join(","))}`
      : "";

    const response = await fetch(buildApiUrl(`/api/export/csv${query}`));
    if (!response.ok) {
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arbitrage-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyShareLink() {
    if (topIds.length === 0) {
      return;
    }

    const shareId = toShareId(topIds);
    const url = buildApiUrl(`/api/share/${shareId}`);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportCsv}
        className="inline-flex items-center gap-2 rounded-lg border border-pa-green/40 bg-pa-green/10 px-3 py-2 text-xs font-semibold text-pa-green transition hover:bg-pa-green/20"
      >
        <Download size={14} />
        Export CSV
      </button>

      <button
        type="button"
        onClick={copyShareLink}
        className="inline-flex items-center gap-2 rounded-lg border border-pa-blue/40 bg-pa-blue/10 px-3 py-2 text-xs font-semibold text-pa-blue transition hover:bg-pa-blue/20"
      >
        <Share2 size={14} />
        {copied ? "Copied" : "Share"}
      </button>
    </div>
  );
}

export default ExportShare;
