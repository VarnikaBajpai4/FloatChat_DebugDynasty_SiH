import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SummaryTile from "./SummaryTile";
import LineChartPrediction from "./LineChartPrediction";

/* ---------- Prediction Panel + Mini Chart ---------- */
export default function PredictionPanel({
  predVar,
  setPredVar,
  predHorizonNum,
  setPredHorizonNum,
  predHorizonUnit,
  setPredHorizonUnit,
  predSinceDays,
  setPredSinceDays,
  predReturnHistory,
  setPredReturnHistory,
  predHistoryDays,
  setPredHistoryDays,
  predLoading,
  predError,
  predResult,
  onRun,
}) {
  const VARS = [
    { key: "temperature", label: "Temperature (\u00B0C)", unit: "\u00B0C" },
    { key: "salinity", label: "Salinity (PSU)", unit: "PSU" },
    { key: "pressure", label: "Pressure (dbar)", unit: "dbar" },
  ];
  const UNITS = ["days", "weeks", "months", "years"];
  const selectedVar = VARS.find((v) => v.key === predVar) || VARS[0];

  const unit = selectedVar.unit;

  const hasData =
    Array.isArray(predResult?.predictions) && predResult.predictions.length > 0;

  const historyData =
    predResult?.input?.returnHistory && Array.isArray(predResult?.history)
      ? predResult.history
      : [];

  const predictionsData = Array.isArray(predResult?.predictions)
    ? predResult.predictions
    : [];

  const meta = predResult?.meta || {};
  // Minimal display-only split conformal confidence (if backend provided)
  const conf =
    typeof meta?.conformal?.confidence === "number"
      ? meta.conformal.confidence
      : null;

  const runDisabled = predLoading || !predVar || !predHorizonNum || !predHorizonUnit;

  const resetLocal = () => {
    setPredHistoryDays(30);
    setPredReturnHistory(true);
    setPredSinceDays(720);
  };

  const downloadCSV = (rows, headers, filename) => {
    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => r[h]).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute inset-0 overflow-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-5xl mx-auto space-y-4"
      >
        {/* Controls */}
        <div className="bg-white/90 border border-[#06B6D4]/30 backdrop-blur-xl rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Variable */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Variable</div>
                <select
                  value={predVar}
                  onChange={(e) => setPredVar(e.target.value)}
                  className={cn(
                    "text-sm rounded-full border border-[#06B6D4]/30 bg-white/70",
                    "px-3 py-1.5 text-slate-700 hover:bg-white outline-none"
                  )}
                >
                  {VARS.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Horizon */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Horizon</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={predHorizonNum}
                    onChange={(e) =>
                      setPredHorizonNum(Math.max(1, Number(e.target.value || 1)))
                    }
                    className={cn(
                      "w-20 text-sm rounded-full border border-[#06B6D4]/30",
                      "bg-white/70 px-3 py-1.5 text-slate-700 outline-none"
                    )}
                  />
                  <select
                    value={predHorizonUnit}
                    onChange={(e) => setPredHorizonUnit(e.target.value)}
                    className={cn(
                      "text-sm rounded-full border border-[#06B6D4]/30 bg-white/70",
                      "px-3 py-1.5 text-slate-700 hover:bg-white outline-none"
                    )}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* History window */}
              <div>
                <div className="text-xs text-slate-500 mb-1">History window (days)</div>
                <input
                  type="number"
                  min={30}
                  step={30}
                  value={predSinceDays}
                  onChange={(e) =>
                    setPredSinceDays(Math.max(1, Number(e.target.value || 30)))
                  }
                  className={cn(
                    "w-28 text-sm rounded-full border border-[#06B6D4]/30",
                    "bg-white/70 px-3 py-1.5 text-slate-700 outline-none"
                  )}
                  title="Days of historical data used to fit the model"
                />
              </div>

              {/* Include History */}
              <div className="flex items-center gap-2 mt-5 sm:mt-0">
                <input
                  id="returnHistory"
                  type="checkbox"
                  checked={predReturnHistory}
                  onChange={(e) => setPredReturnHistory(e.target.checked)}
                  className="size-4 accent-[#06B6D4]"
                />
                <label htmlFor="returnHistory" className="text-sm text-slate-700">
                  Include history
                </label>
              </div>

              {/* History days to return */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Return last (days)</div>
                <input
                  type="number"
                  min={1}
                  value={predHistoryDays}
                  onChange={(e) =>
                    setPredHistoryDays(Math.max(1, Number(e.target.value || 1)))
                  }
                  disabled={!predReturnHistory}
                  className={cn(
                    "w-24 text-sm rounded-full border border-[#06B6D4]/30",
                    "px-3 py-1.5",
                    predReturnHistory
                      ? "bg-white/70 text-slate-700"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    "outline-none"
                  )}
                  title="Days of historical series to include in response"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={resetLocal}
                variant="outline"
                className="rounded-full bg-white/90 hover:bg-white"
                disabled={predLoading}
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={onRun}
                disabled={runDisabled}
                className={cn(
                  "rounded-full px-4",
                  "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white",
                  predLoading && "opacity-80"
                )}
              >
                {predLoading ? "Running..." : "Run Prediction"}
              </Button>
            </div>
          </div>

          {predError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {predError}
            </div>
          ) : null}
        </div>

        {/* Output */}
        <div className="bg-white/90 border border-[#06B6D4]/30 backdrop-blur-xl rounded-2xl p-4 shadow">
          {!hasData ? (
            <div className="text-center text-slate-600 py-10">
              Configure inputs and click “Run Prediction” to see results.
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryTile
                  label="Variable"
                  value={selectedVar.label}
                  subtitle={`Unit: ${unit}`}
                />
                <SummaryTile
                  label="Horizon"
                  value={`${predResult?.input?.horizonDays ?? "-"} days`}
                  subtitle={predResult?.input?.horizon}
                />
                <SummaryTile
                  label="History Window"
                  value={`${predResult?.input?.sinceDays ?? "-"} days`}
                  subtitle={
                    predResult?.input?.returnHistory
                      ? `Returning last ${predResult?.input?.historyDays} days`
                      : "Not included"
                  }
                />
                <SummaryTile
                  label="Rows Used"
                  value={meta?.rowsFetched ?? "-"}
                  subtitle="Interpolated daily"
                />
                {typeof conf === "number" && (
                  <SummaryTile
                    label="Confidence"
                    value={`${(conf * 100).toFixed(1)}%`}
                    subtitle="Split conformal"
                  />
                )}
              </div>

              {/* Chart */}
              <div className="mt-4 rounded-xl border border-[#06B6D4]/20 bg-white/80 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-800">History & Prediction</div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <span className="inline-block w-3 h-[2px] bg-[#06B6D4]" /> History
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <span className="inline-block w-3 h-[2px] bg-[#0EA5E9] border-b border-[#0EA5E9] border-dashed" /> Prediction
                    </span>
                  </div>
                </div>
                <LineChartPrediction
                  unit={unit}
                  history={historyData}
                  predictions={predictionsData}
                  height={280}
                />
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                {historyData.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full bg-white/90 hover:bg-white"
                    onClick={() =>
                      downloadCSV(
                        historyData.map((h) => ({ date: h.date, value: h.value })),
                        ["date", "value"],
                        "history.csv"
                      )
                    }
                  >
                    Download History CSV
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full bg-white/90 hover:bg-white"
                  onClick={() =>
                    downloadCSV(
                      predictionsData.map((p) => ({
                        date: p.date,
                        predicted: p.pred,
                      })),
                      ["date", "predicted"],
                      "predictions.csv"
                    )
                  }
                >
                  Download Predictions CSV
                </Button>
              </div>

              {/* Tables */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#06B6D4]/20 bg-white/80">
                  <div className="px-3 py-2 text-sm font-medium text-slate-800">
                    Predictions ({predictionsData.length})
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white/90">
                        <tr className="text-slate-600">
                          <th className="text-left px-3 py-2 font-semibold border-b border-slate-200">Date</th>
                          <th className="text-right px-3 py-2 font-semibold border-b border-slate-200">
                            Predicted ({unit})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionsData.map((p, i) => (
                          <tr key={i} className="text-slate-800">
                            <td className="px-3 py-1.5 border-b border-slate-100">{p.date}</td>
                            <td className="px-3 py-1.5 border-b border-slate-100 text-right">
                              {typeof p.pred === "number" ? p.pred.toFixed(3) : p.pred}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-[#06B6D4]/20 bg-white/80">
                  <div className="px-3 py-2 text-sm font-medium text-slate-800">
                    History ({historyData.length})
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white/90">
                        <tr className="text-slate-600">
                          <th className="text-left px-3 py-2 font-semibold border-b border-slate-200">Date</th>
                          <th className="text-right px-3 py-2 font-semibold border-b border-slate-200">
                            Value ({unit})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((h, i) => (
                          <tr key={i} className="text-slate-800">
                            <td className="px-3 py-1.5 border-b border-slate-100">{h.date}</td>
                            <td className="px-3 py-1.5 border-b border-slate-100 text-right">
                              {typeof h.value === "number" ? h.value.toFixed(3) : h.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}