import { useTheme } from "./theme-provider";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

const OceanWaves = () => {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            theme === "light"
              ? `
              radial-gradient(circle at 20% 80%, rgba(14, 165, 233, 0.25) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(34, 211, 238, 0.25) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)
            `
              : `
              radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)
            `,
        }}
        animate={{
          background:
            theme === "light"
              ? [
                  `radial-gradient(circle at 20% 80%, rgba(14, 165, 233, 0.25) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(34, 211, 238, 0.25) 0%, transparent 50%),
               radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)`,
                  `radial-gradient(circle at 80% 20%, rgba(14, 165, 233, 0.25) 0%, transparent 50%),
               radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.25) 0%, transparent 50%),
               radial-gradient(circle at 60% 60%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)`,
                  `radial-gradient(circle at 40% 60%, rgba(14, 165, 233, 0.25) 0%, transparent 50%),
               radial-gradient(circle at 60% 40%, rgba(34, 211, 238, 0.25) 0%, transparent 50%),
               radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)`,
                ]
              : [
                  `radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)`,
                  `radial-gradient(circle at 80% 20%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 20% 80%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 60% 60%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)`,
                  `radial-gradient(circle at 40% 60%, rgba(34, 211, 238, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 60% 40%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)`,
                ],
        }}
        transition={{
          duration: 20,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </div>
  );
};

export default OceanWaves;
