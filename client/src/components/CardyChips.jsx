import { motion, useReducedMotion } from "framer-motion";

const items = [
  { title: "Researchers", example: "Profiles within 200 km of Mumbai" },
  { title: "Policymakers", example: "Climate trends in territorial waters" },
  { title: "Fisheries & Industry", example: "Temperature zones for fishing" },
  { title: "Educators & Students", example: "Ocean data for coursework" },
];

export default function CardyChips({ theme }) {
  const prefersReduced = useReducedMotion();
  const isLight = theme === "light";

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: prefersReduced ? 1 : 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="relative"
        >
          <div className="group relative z-10 overflow-visible">
            {/* gradient border ring */}
            <div
              aria-hidden="true"
              className={[
                "pointer-events-none absolute -inset-px rounded-2xl",
                "[background:linear-gradient(45deg,rgba(6,182,212,.7),rgba(59,130,246,.7),rgba(168,85,247,.7))]",
                "opacity-60 group-hover:opacity-100 transition-opacity duration-300",
                "blur-[2px]",
              ].join(" ")}
            />

            {/* card body */}
            <button
              type="button"
              aria-describedby={`chip-tip-${i}`}
              className={[
                "relative rounded-2xl px-6 py-3 border",
                "transition-all duration-300 ease-out",
                "outline-none focus-visible:ring-2 ring-offset-0 ring-[#06B6D4]/40",
                isLight
                  // Light mode: slightly darker neutral surface (no black)
                  ? [
                      "bg-sky-300",          // gentle light-gray surface
                      "text-slate-900",        // strong readability
                      "border-slate-300/80",   // clearer edge on light-gray
                      "backdrop-blur-[2px]",   // mild blend
                    ].join(" ")
                  : [
                      // Dark mode: lighter neutral for contrast on dark canvas
                      "bg-slate-800",          // lifted but not pure black
                      "text-slate-100",        // readable on slate-800
                      "border-white/10",       // subtle border
                      "backdrop-blur-[2px]",
                    ].join(" "),
                // Theme-specific shadow tuning
                isLight
                  ? "shadow-[0_6px_16px_-8px_rgba(2,6,23,0.18)] group-hover:shadow-[0_14px_30px_-12px_rgba(2,6,23,0.24)]"
                  : "shadow-[0_8px_22px_-10px_rgba(0,0,0,0.55)] group-hover:shadow-[0_20px_46px_-16px_rgba(0,0,0,0.6)]",
                prefersReduced ? "" : "group-hover:-translate-y-1",
              ].join(" ")}
            >
              {/* stacked layers hint (tone per theme) */}
              <span
                aria-hidden="true"
                className={[
                  "absolute inset-0 rounded-2xl",
                  "before:absolute before:inset-[2px] before:rounded-[14px] before:content-['']",
                  isLight
                    ? "before:bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(248,250,252,0.65))]"
                    : "before:bg-gradient-to-b before:from-white/10 before:to-white/5",
                ].join(" ")}
              />

              {/* label */}
              <span className="relative z-10 text-sm font-semibold tracking-tight">
                {item.title}
              </span>
            </button>

            {/* tooltip container: positioned and elevated */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                id={`chip-tip-${i}`}
                role="tooltip"
                className={[
                  "absolute top-full left-1/2 -translate-x-1/2 mt-2",
                  "px-3 py-2 text-xs rounded-md border whitespace-nowrap",
                  "opacity-0 translate-y-1",
                  "transition-all duration-200",
                  "z-50",
                  "group-hover:opacity-100 group-hover:translate-y-0",
                  "group-focus-within:opacity-100 group-focus-within:translate-y-0",
                  isLight
                    // Light tooltip on slate surface
                    ? "bg-white text-slate-900 border-slate-200 shadow-[0_12px_28px_-10px_rgba(2,6,23,0.18)]"
                    // Dark tooltip on lifted slate
                    : "bg-slate-800 text-slate-100 border-white/10 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
                  "backdrop-blur-sm",
                ].join(" ")}
              >
                {item.example}
              </div>
            </div>
          </div>

          {/* background glow (balanced per theme) */}
          <div
            aria-hidden="true"
            className={[
              "absolute inset-0 -z-10 rounded-3xl",
              "transition-transform duration-500",
              "scale-95 group-hover:scale-100",
              isLight
                // slightly darker but diffused glow for light theme
                ? "bg-[radial-gradient(70%_70%_at_50%_0%,rgba(6,182,212,.12),rgba(248,250,252,0)_70%)]"
                // lighter cyan glow for dark theme to lift surface
                : "bg-[radial-gradient(60%_60%_at_50%_0%,rgba(94,234,212,.18),transparent_70%)]",
            ].join(" ")}
          />
        </motion.div>
      ))}
    </div>
  );
}
