import React from "react";
import { motion, useReducedMotion } from "framer-motion";

function Loader({ label = "Loading…", fullScreen = true }) {
  const prefersReducedMotion = useReducedMotion();

  const Wrapper = fullScreen ? "div" : "span";
  const wrapperClass = fullScreen
    ? "fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-md"
    : "inline-flex items-center gap-3";

  return (
    <Wrapper role="status" aria-live="polite" aria-label={label} className={wrapperClass} data-testid="app-loader">
      <div className="flex flex-col items-center justify-center">
        <div className="relative size-28">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />

          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, var(--color-primary) 0deg, transparent 120deg)",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 8px))",
              WebkitMask:
                "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 8px))",
            }}
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={{ repeat: Infinity, ease: "linear", duration: 1.2 }}
          />

          <motion.svg
            viewBox="0 0 100 100"
            className="absolute inset-0"
            fill="none"
          >
            <defs>
              <linearGradient id="loader-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-2)" />
                <stop offset="50%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="var(--color-chart-3)" />
              </linearGradient>
            </defs>
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              stroke="url(#loader-grad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="60 200"
              animate={
                prefersReducedMotion
                  ? {}
                  : { strokeDashoffset: [0, -260] }
              }
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 0 8px color-mix(in oklch, var(--color-primary), white 40%))" }}
            />
          </motion.svg>

          <div className="absolute inset-0 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-2.5 rounded-full bg-primary"
                animate={
                  prefersReducedMotion
                    ? {}
                    : { y: [0, -6, 0], opacity: [0.6, 1, 0.6] }
                }
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  delay: i * 0.12,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          <motion.div
            className="absolute inset-0 blur-2xl"
            style={{
              background:
                "radial-gradient(40% 40% at 50% 50%, color-mix(in oklch, var(--color-primary), white 20%) 0%, transparent 70%)",
            }}
            animate={prefersReducedMotion ? {} : { scale: [0.95, 1.05, 0.95] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          />
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="sr-only">Loading</span>
          <motion.p
            className="text-sm font-medium text-muted-foreground"
            animate={prefersReducedMotion ? {} : { opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          >
            {label}
          </motion.p>
        </div>
      </div>
    </Wrapper>
  );
}

export default Loader;