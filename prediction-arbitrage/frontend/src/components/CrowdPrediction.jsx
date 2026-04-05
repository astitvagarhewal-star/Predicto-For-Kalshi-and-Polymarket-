import { useEffect, useState } from "react";
import { buildApiUrl, fetchJson } from "../utils/api";

const PRICE_POINTS = [0.1, 0.3, 0.5, 0.7, 0.9];

function CrowdPrediction({ marketId }) {
  const [prediction, setPrediction] = useState(null);

  useEffect(() => {
    if (!marketId) {
      return undefined;
    }

    let active = true;

    fetchJson(buildApiUrl(`/api/crowd-prediction/${marketId}`))
      .then((payload) => {
        if (active) {
          setPrediction(payload);
        }
      })
      .catch(() => {
        if (active) {
          setPrediction(null);
        }
      });

    return () => {
      active = false;
    };
  }, [marketId]);

  if (!prediction) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-pa-card p-4 text-xs text-pa-muted">
        Crowd prediction appears once chat has enough messages.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-4">
      <p className="text-sm font-semibold text-pa-text">Crowd Prediction</p>
      <p className="mt-1 text-xs text-pa-muted">Collective probability distribution from discussion sentiment.</p>

      <div className="mt-3 space-y-2">
        {PRICE_POINTS.map((pricePoint) => {
          const percent = Number(prediction[String(pricePoint)] || 0) * 100;

          return (
            <div key={pricePoint}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-pa-text">{Math.round(pricePoint * 100)}%</span>
                <span className="text-pa-muted">{percent.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className={`h-2 rounded-full transition-all ${
                    percent > 35 ? "bg-pa-green" : percent > 20 ? "bg-pa-blue" : "bg-slate-600"
                  }`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-pa-blue/30 bg-pa-blue/10 p-3 text-xs">
        <p className="text-pa-muted">Consensus</p>
        <p className="mt-1 text-sm font-semibold text-pa-text">{(Number(prediction.consensus || 0.5) * 100).toFixed(0)}%</p>
      </div>
    </section>
  );
}

export default CrowdPrediction;
