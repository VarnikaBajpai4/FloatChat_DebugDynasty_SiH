import { useMemo } from "react";
import { useTheme } from "./theme-provider";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

const FloatingParticles = () => {
  const { theme } = useTheme();

  const particles = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        size: Math.random() * 8 + 3,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        duration: Math.random() * 4 + 6,
        opacity: Math.random() * 0.6 + 0.2,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full backdrop-blur-sm border ${
            theme === "light"
              ? "bg-gradient-to-br from-[#0EA5E9]/40 to-[#22D3EE]/30 border-[#0EA5E9]/30"
              : "bg-gradient-to-br from-[#22D3EE]/30 to-[#0EA5E9]/20 border-[#22D3EE]/20"
          }`}
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
          }}
          animate={{
            y: [1200, -100],
            x: [0, Math.sin(particle.id) * 50],
            scale: [0.8, 1.2, 0.8],
            opacity: [0, particle.opacity, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default FloatingParticles;
