/**
 * Lightweight SVG line chart used by PredictionPanel
 */
export default function LineChartPrediction({ history, predictions, height = 280, unit }) {
  const parse = (d) => new Date(d);
  const h = Array.isArray(history) ? history.map((x) => ({ x: parse(x.date), y: Number(x.value) })) : [];
  const p = Array.isArray(predictions) ? predictions.map((x) => ({ x: parse(x.date), y: Number(x.pred) })) : [];

  const all = [...h, ...p];
  if (all.length === 0) {
    return <div className="text-center text-slate-500 py-10 text-sm">No data to plot</div>;
  }

  const xMin = new Date(Math.min(...all.map((d) => d.x.getTime())));
  const xMax = new Date(Math.max(...all.map((d) => d.x.getTime())));
  const yVals = all.map((d) => d.y).filter((v) => Number.isFinite(v));
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const y0 = yMin - yPad;
  const y1 = yMax + yPad;

  const W = 800;
  const H = height;
  const PAD_L = 48;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 36;

  const xScale = (d) =>
    PAD_L + ((d.getTime() - xMin.getTime()) / (xMax.getTime() - xMin.getTime() || 1)) * (W - PAD_L - PAD_R);
  const yScale = (v) => PAD_T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - PAD_T - PAD_B);

  const toPath = (arr) => {
    if (!arr.length) return "";
    return arr
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${xScale(pt.x).toFixed(2)} ${yScale(pt.y).toFixed(2)}`)
      .join(" ");
  };

  // X ticks
  const xTickCount = 5;
  const ms = xMax.getTime() - xMin.getTime();
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => new Date(xMin.getTime() + (ms * i) / xTickCount));
  const fmtDate = (d) =>
    `${String(d.getFullYear()).slice(2)}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Y ticks (nice) and formatting to up to 3 decimals
  const niceStep = (span, count) => {
    const raw = span / Math.max(1, count);
    const power = Math.floor(Math.log10(Math.max(1e-12, raw)));
    const base = Math.pow(10, power);
    const mult = raw / base;
    let step;
    if (mult <= 1) step = 1;
    else if (mult <= 2) step = 2;
    else if (mult <= 5) step = 5;
    else step = 10;
    return step * base;
  };
  const genYTicks = (min, max, count) => {
    const span = Math.max(1e-12, max - min);
    const step = niceStep(span, count);
    const start = Math.ceil(min / step) * step;
    const end = Math.floor(max / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step * 0.5; v += step) ticks.push(v);
    if (ticks.length === 0) ticks.push(min, max);
    return ticks;
  };
  const yTicks = genYTicks(y0, y1, 5);
  const fmtVal = (v) => {
    if (!Number.isFinite(v)) return String(v);
    return v.toFixed(3).replace(/\.?0+$/, "");
  };

  // Reference today line if in range
  const today = new Date();
  const showToday = today >= xMin && today <= xMax;
  const todayX = xScale(today);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Background gridlines (X) */}
        {xTicks.map((t, i) => {
          const x = xScale(t);
          return <line key={`xg-${i}`} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        {/* Background gridlines (Y) */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return <line key={`yg-${i}`} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
        })}

        {/* Axes */}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth="1" />

        {/* X ticks + labels */}
        {xTicks.map((t, i) => {
          const x = xScale(t);
          return (
            <g key={`xt-${i}`}>
              <line x1={x} y1={H - PAD_B} x2={x} y2={H - PAD_B + 4} stroke="#94a3b8" />
              <text x={x} y={H - PAD_B + 16} fontSize="10" textAnchor="middle" fill="#475569">
                {fmtDate(t)}
              </text>
            </g>
          );
        })}

        {/* Y ticks + labels (up to 3 decimals) */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={`yt-${i}`}>
              <line x1={PAD_L - 4} y1={y} x2={PAD_L} y2={y} stroke="#94a3b8" />
              <text x={PAD_L - 8} y={y + 3} fontSize="10" textAnchor="end" fill="#475569">
                {fmtVal(v)}
              </text>
            </g>
          );
        })}

        {/* Today line */}
        {showToday ? (
          <g>
            <line x1={todayX} y1={PAD_T} x2={todayX} y2={H - PAD_B} stroke="#94a3b8" strokeDasharray="3 3" />
            <text x={todayX + 4} y={PAD_T + 12} fontSize="10" fill="#475569">
              Today
            </text>
          </g>
        ) : null}

        {/* Paths */}
        {/* History */}
        <path d={toPath(h)} fill="none" stroke="#06B6D4" strokeWidth="2" />
        {/* Predictions */}
        <path d={toPath(p)} fill="none" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="6 4" />

        {/* Point markers and value labels (up to 3 decimals) */}
        {h.map((pt, i) => {
          const cx = xScale(pt.x);
          const cy = yScale(pt.y);
          return (
            <g key={`hp-${i}`}>
              <circle cx={cx} cy={cy} r="2.5" fill="#06B6D4" stroke="#0284C7" strokeWidth="1" />
              <text x={cx} y={cy - 6} fontSize="9" textAnchor="middle" fill="#0f172a">
                {fmtVal(pt.y)}
              </text>
            </g>
          );
        })}
        {p.map((pt, i) => {
          const cx = xScale(pt.x);
          const cy = yScale(pt.y);
          return (
            <g key={`pp-${i}`}>
              <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" stroke="#0EA5E9" strokeWidth="1.5" />
              <text x={cx} y={cy - 6} fontSize="9" textAnchor="middle" fill="#0f172a">
                {fmtVal(pt.y)}
              </text>
            </g>
          );
        })}

        {/* Y axis unit label */}
        <text
          x={PAD_L - 36}
          y={(H - PAD_B + PAD_T) / 2}
          fontSize="10"
          fill="#475569"
          transform={`rotate(-90 ${PAD_L - 36}, ${(H - PAD_B + PAD_T) / 2})`}
          textAnchor="middle"
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}