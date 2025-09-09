import { motion, useMotionValue, useTransform, useReducedMotion } from "framer-motion";
import { CheckCircle, Database, Shield, Target } from "lucide-react";

const items = [
  { icon: CheckCircle, title: "QC-Aware" },
  { icon: Shield, title: "Read-Only SQL" },
  { icon: Database, title: "Transparent Queries" },
  { icon: Target, title: "Open Standards" },
];

export default function FeatureRow({ theme }) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex flex-wrap justify-center gap-3 md:gap-4 lg:gap-6 mb-8">
      {items.map((item, i) => {
        const x = useMotionValue(0);
        const y = useMotionValue(0);
        const bgSpotlight = useTransform([x, y], ([lx, ly]) =>
          `radial-gradient(120px 120px at ${lx}px ${ly}px, rgba(255,255,255,0.25), transparent 60%)`
        );
        const isLight = theme === "light";
        const lift = prefersReduced ? {} : { y: -4, scale: 1.02 };

        return (
          <motion.div
            key={i}
            initial={prefersReduced ? { opacity: 0 } : { y: 20, opacity: 0 }}
            whileInView={prefersReduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={prefersReduced ? { duration: 0.3, delay: i * 0.05 } : { type: "spring", stiffness: 260, damping: 26, delay: i * 0.06 }}
            whileHover={lift}
            onMouseMove={(e) => {
              const target = e.currentTarget;
              const rect = target.getBoundingClientRect();
              x.set(e.clientX - rect.left);
              y.set(e.clientY - rect.top);
            }}
            className={[
              "group relative isolate",
              "rounded-full px-4 py-2",
              "inline-flex items-center gap-2",
              "backdrop-blur-md",
              isLight
                ? "bg-white/50 text-[#0F172A] ring-1 ring-slate-900/10"
                : "bg-white/10 text-[#F1F5F9] ring-1 ring-white/10",
              "shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)]",
              "transition-[box-shadow,transform,background] duration-300 ease-out",
              "hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]",
              "motion-reduce:transition-none motion-reduce:hover:transform-none",
            ].join(" ")}
            style={{
              backgroundImage: bgSpotlight,
              backgroundBlendMode: "overlay",
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: isLight
                  ? "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.1))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02))",
                WebkitMaskImage: "linear-gradient(#000, transparent 70%)",
                maskImage: "linear-gradient(#000, transparent 70%)",
              }}
            />
            <item.icon className="w-5 h-5 text-[#06B6D4] drop-shadow-[0_1px_0_rgba(0,0,0,0.15)]" />
            <span className="text-sm font-medium tracking-tight">{item.title}</span>
            <span
              className={[
                "pointer-events-none absolute -bottom-px left-3 right-3 h-px",
                "opacity-0 translate-y-1 transition duration-300 ease-out",
                "group-hover:opacity-100 group-hover:translate-y-0",
                isLight ? "bg-slate-900/20" : "bg-white/25",
              ].join(" ")}
            />
          </motion.div>
        );
      })}
    </div>
  );
}