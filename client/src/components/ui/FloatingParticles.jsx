import { useMemo } from "react";
import { useTheme } from "./theme-provider";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

const FloatingParticles = () => {
  const { theme } = useTheme();

  const particles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        size: Math.random() * 25 + 15, // Increased from 8+3 to 25+15 (15-40px)
        x: Math.random() * 100,
        delay: Math.random() * 3,
        duration: Math.random() * 6 + 8, // Slower movement for more visibility
        opacity: Math.random() * 0.8 + 0.3, // Increased opacity from 0.6+0.2 to 0.8+0.3
        variant: Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'medium' : 'small', // Add size variants
      })),
    []
  );

  const largeBubbles = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: `large-${i}`,
        size: Math.random() * 40 + 30, // Even larger bubbles (30-70px)
        x: Math.random() * 100,
        delay: Math.random() * 4,
        duration: Math.random() * 8 + 12, // Very slow movement
        opacity: Math.random() * 0.4 + 0.2, // More subtle for large ones
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Regular enhanced particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full backdrop-blur-sm border-2 ${
            particle.variant === 'large' 
              ? theme === "light"
                ? "bg-gradient-to-br from-[#06B6D4]/50 to-[#0EA5E9]/40 border-[#06B6D4]/50 shadow-lg"
                : "bg-gradient-to-br from-[#06B6D4]/40 to-[#0EA5E9]/30 border-[#06B6D4]/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              : particle.variant === 'medium'
              ? theme === "light"
                ? "bg-gradient-to-br from-[#0EA5E9]/45 to-[#3B82F6]/35 border-[#0EA5E9]/40"
                : "bg-gradient-to-br from-[#0EA5E9]/35 to-[#3B82F6]/25 border-[#0EA5E9]/50 shadow-[0_0_15px_rgba(14,165,233,0.2)]"
              : theme === "light"
                ? "bg-gradient-to-br from-[#3B82F6]/40 to-[#06B6D4]/30 border-[#3B82F6]/35"
                : "bg-gradient-to-br from-[#3B82F6]/30 to-[#06B6D4]/20 border-[#3B82F6]/45"
          }`}
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
          }}
          animate={{
            y: [1200, -100],
            x: [0, Math.sin(particle.id) * 60], // Increased horizontal movement
            scale: [0.6, 1.3, 0.8], // More dramatic scaling
            opacity: [0, particle.opacity, 0],
            rotate: [0, 360], // Add rotation for more dynamic movement
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Extra large statement bubbles */}
      {largeBubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className={`absolute rounded-full backdrop-blur-md border-2 ${
            theme === "light"
              ? "bg-gradient-to-br from-[#06B6D4]/30 to-[#0EA5E9]/20 border-[#06B6D4]/40 shadow-2xl"
              : "bg-gradient-to-br from-[#06B6D4]/25 to-[#0EA5E9]/15 border-[#06B6D4]/50 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
          }`}
          style={{
            width: bubble.size,
            height: bubble.size,
            left: `${bubble.x}%`,
          }}
          animate={{
            y: [1400, -200],
            x: [
              0, 
              Math.sin(bubble.id) * 80, 
              Math.cos(bubble.id) * 40,
              Math.sin(bubble.id + 1) * 60
            ], // More complex path
            scale: [0.4, 1.1, 1.3, 0.6], // More scale keyframes
            opacity: [0, bubble.opacity * 0.7, bubble.opacity, 0],
            rotate: [0, 180, 360], // Full rotation
          }}
          transition={{
            duration: bubble.duration,
            delay: bubble.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          {/* Inner highlight for more realistic bubble effect */}
          <div 
            className={`absolute top-2 left-2 rounded-full ${
              theme === "light" 
                ? "bg-white/40" 
                : "bg-[#06B6D4]/30"
            }`}
            style={{
              width: bubble.size * 0.3,
              height: bubble.size * 0.3,
            }}
          />
        </motion.div>
      ))}

      {/* Floating clusters for extra visual interest */}
      {Array.from({ length: 8 }, (_, i) => (
        <motion.div
          key={`cluster-${i}`}
          className="absolute"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            x: [0, Math.sin(i) * 100, Math.cos(i) * 50, 0],
            y: [0, Math.cos(i) * 100, Math.sin(i) * 50, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: Math.random() * 20 + 30,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: Math.random() * 5,
          }}
        >
          {Array.from({ length: 3 }, (_, j) => (
            <motion.div
              key={j}
              className={`absolute rounded-full ${
                theme === "light"
                  ? "bg-gradient-to-br from-[#06B6D4]/25 to-[#0EA5E9]/15 border border-[#06B6D4]/30"
                  : "bg-gradient-to-br from-[#06B6D4]/20 to-[#0EA5E9]/10 border border-[#06B6D4]/40"
              }`}
              style={{
                width: Math.random() * 15 + 10,
                height: Math.random() * 15 + 10,
                left: j * 25,
                top: Math.sin(j) * 20,
              }}
              animate={{
                scale: [0.8, 1.2, 0.8],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: j * 0.5,
              }}
            />
          ))}
        </motion.div>
      ))}
    </div>
  );
};

export default FloatingParticles;