import { useMemo } from "react";
import { useTheme } from "./theme-provider";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

const FloatingJellyfish = () => {
  const { theme } = useTheme();

  const jellyfish = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        size: Math.random() * 40 + 20,
        x: Math.random() * 100,
        delay: Math.random() * 3,
        duration: Math.random() * 6 + 8,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {jellyfish.map((jelly) => (
        <motion.div
          key={jelly.id}
          className={`absolute rounded-full backdrop-blur-md border ${
            theme === "light"
              ? "bg-gradient-to-br from-[#22D3EE]/30 to-[#0EA5E9]/20 border-[#0EA5E9]/40"
              : "bg-gradient-to-br from-[#0EA5E9]/20 to-[#22D3EE]/10 border-[#22D3EE]/30"
          }`}
          style={{
            width: jelly.size,
            height: jelly.size,
            left: `${jelly.x}%`,
          }}
          animate={{
            y: [1100, -50],
            x: [0, Math.sin(jelly.id * 0.3) * 80],
            scale: [0.5, 1, 0.5],
            opacity: [0, 0.4, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: jelly.duration,
            delay: jelly.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default FloatingJellyfish;
