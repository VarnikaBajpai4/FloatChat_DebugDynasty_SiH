import { motion, useScroll, useTransform, useInView } from "framer-motion";

const Marquee = ({ children }) => (
  <div className="overflow-hidden whitespace-nowrap">
    <motion.div
      className="inline-block"
      animate={{ x: [1000, -1000] }}
      transition={{
        duration: 20,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  </div>
);

export default Marquee;
