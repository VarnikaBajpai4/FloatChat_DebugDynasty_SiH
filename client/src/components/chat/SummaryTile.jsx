export default function SummaryTile({ label, value, subtitle }) {
  return (
    <div className="rounded-xl border border-[#06B6D4]/20 bg-white/80 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
      {subtitle ? <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div> : null}
    </div>
  );
}