import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import {
  MessageCircle,
  Map,
  Shield,
  TrendingUp,
  Download,
  Brain,
  Database,
  Target,
  CheckCircle,
} from "lucide-react";
import { useRef, useEffect, useState, useMemo } from "react";

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

// Animated counter component
const AnimatedCounter = (value, suffix = "") => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref);

  useEffect(() => {
    if (isInView) {
      const timer = setInterval(() => {
        setCount((prev) => {
          if (prev < value) {
            return Math.min(prev + Math.ceil(value / 30), value);
          }
          return value;
        });
      }, 50);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
};

// Marquee component
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

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const showcaseRef = useRef(null);

  const { theme } = useTheme();

  const heroInView = useInView(heroRef);
  const featuresInView = useInView(featuresRef);
  const showcaseInView = useInView(showcaseRef);

  useEffect(() => {
    if (theme === "light") {
      document.body.style.background =
        "linear-gradient(to bottom right, #E0F2FE, #BAE6FD, #7DD3FC)";
    } else {
      document.body.style.background =
        "linear-gradient(to bottom right, #0B1220, #1E293B, #0284C7)";
    }
    return () => {
      document.body.style.background = "";
    };
  }, [theme]);

  return (
    <div
      className={`min-h-screen relative overflow-hidden ${
        theme === "light"
          ? "bg-gradient-to-br from-[#E0F2FE] via-[#BAE6FD] to-[#7DD3FC]"
          : "bg-gradient-to-br from-[#0B1220] via-[#1E293B] to-[#0284C7]"
      }`}
    >
      <FloatingParticles />
      <OceanWaves />
      <FloatingJellyfish />

      {/* Animated background */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{ y: backgroundY }}
      >
        <div
          className={`absolute inset-0 ${
            theme === "light"
              ? "bg-gradient-to-r from-[#0EA5E9]/30 via-[#22D3EE]/20 to-[#0284C7]/30"
              : "bg-gradient-to-r from-[#0EA5E9]/20 via-[#22D3EE]/10 to-[#0284C7]/20"
          }`}
        />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000">
          <defs>
            <pattern
              id="bathymetry"
              x="0"
              y="0"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0,50 Q25,25 50,50 T100,50"
                stroke="#22D3EE"
                strokeWidth="0.5"
                fill="none"
                opacity={theme === "light" ? "0.5" : "0.3"}
              />
              <path
                d="M0,75 Q25,50 50,75 T100,75"
                stroke="#0EA5E9"
                strokeWidth="0.3"
                fill="none"
                opacity={theme === "light" ? "0.4" : "0.2"}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bathymetry)" />
        </svg>
      </motion.div>

      <div
        className={`fixed inset-0 -z-10 ${
          theme === "light"
            ? "bg-gradient-to-br from-[#E0F2FE] via-[#BAE6FD] to-[#7DD3FC]"
            : "bg-gradient-to-br from-[#0B1220] via-[#1E293B] to-[#0284C7]"
        }`}
      />

      <motion.header
        className={`fixed top-0 w-full z-50 backdrop-blur-md border-b ${
          theme === "light"
            ? "bg-[#E0F2FE]/90 border-[#0EA5E9]/30"
            : "bg-[#0B1220]/90 border-white/20"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div
            className={`text-2xl font-bold tracking-tight ${
              theme === "light" ? "text-[#0B1220]" : "text-white"
            }`}
            whileHover={{ scale: 1.05 }}
          >
            FloatChat
          </motion.div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <Button
              variant="ghost"
              className={`${
                theme === "light"
                  ? "text-[#0B1220] hover:bg-[#0EA5E9]/20 hover:text-[#0B1220] border-[#0EA5E9]/30"
                  : "text-white hover:bg-white/20 hover:text-white border-white/20"
              }`}
            >
              Sign Up
            </Button>
            <Button
              variant="ghost"
              className={`${
                theme === "light"
                  ? "text-[#0B1220] hover:bg-[#0EA5E9]/20 hover:text-[#0B1220] border-[#0EA5E9]/30"
                  : "text-white hover:bg-white/20 hover:text-white border-white/20"
              }`}
            >
              Log In
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="relative z-10">
        {/* Hero Section */}
        <section
          ref={heroRef}
          className="pt-32 pb-20 px-6 text-center relative"
        >
          <div className="container mx-auto max-w-4xl">
            <motion.h1
              className={`text-6xl md:text-7xl font-bold mb-6 tracking-tight drop-shadow-lg ${
                theme === "light" ? "text-[#0B1220]" : "text-white"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 4px 8px rgba(11,18,32,0.3)"
                    : "0 4px 8px rgba(0,0,0,0.8)",
              }}
              initial={{ y: 50, opacity: 0 }}
              animate={heroInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Explore the oceans.{" "}
              <span
                className="text-[#22D3EE] drop-shadow-lg"
                style={{
                  textShadow:
                    theme === "light"
                      ? "0 4px 8px rgba(11,18,32,0.3)"
                      : "0 4px 8px rgba(0,0,0,0.8)",
                }}
              >
                Just ask.
              </span>
            </motion.h1>

            <motion.p
              className={`text-xl mb-8 max-w-2xl mx-auto drop-shadow-md ${
                theme === "light" ? "text-[#0B1220]/80" : "text-white/90"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 4px rgba(11,18,32,0.2)"
                    : "0 2px 4px rgba(0,0,0,0.8)",
              }}
              initial={{ y: 30, opacity: 0 }}
              animate={heroInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Conversational ARGO data with live maps & trusted insights.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
              initial={{ y: 30, opacity: 0 }}
              animate={heroInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-8 py-3 shadow-lg"
                >
                  Sign Up
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className={`px-8 py-3 shadow-lg ${
                    theme === "light"
                      ? "border-[#0EA5E9]/50 text-[#0B1220] hover:bg-[#0EA5E9]/20 bg-[#E0F2FE]/50 backdrop-blur-sm"
                      : "border-white/50 text-white hover:bg-white/20 bg-[#0B1220]/50 backdrop-blur-sm"
                  }`}
                >
                  Log In
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              className={`text-sm rounded-full px-6 py-2 inline-block border ${
                theme === "light"
                  ? "text-[#0B1220]/80 bg-[#E0F2FE]/60 backdrop-blur-sm border-[#0EA5E9]/30"
                  : "text-white/80 bg-[#0B1220]/60 backdrop-blur-sm border-white/20"
              }`}
              initial={{ opacity: 0 }}
              animate={heroInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <Marquee>
                Indian Ocean PoC • Safe SQL • QC-aware • CSV/NetCDF/JSON •
                Indian Ocean PoC • Safe SQL • QC-aware • CSV/NetCDF/JSON
              </Marquee>
            </motion.div>
          </div>
        </section>

        {/* What It Does */}
        <section className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <motion.h2
              className={`text-4xl font-bold text-center mb-16 drop-shadow-lg ${
                theme === "light" ? "text-[#0B1220]" : "text-white"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 4px 8px rgba(11,18,32,0.3)"
                    : "0 4px 8px rgba(0,0,0,0.8)",
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              What It Does
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: MessageCircle,
                  title: "Chat with Data",
                  desc: "Ask natural questions",
                },
                {
                  icon: Map,
                  title: "Visualize Instantly",
                  desc: "Maps, profiles, heatmaps",
                },
                {
                  icon: Shield,
                  title: "Trusted Outputs",
                  desc: "QC checks, safe SQL, transparent queries",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card
                    className={`p-8 text-center transition-all duration-300 hover:shadow-2xl hover:shadow-[#22D3EE]/20 ${
                      theme === "light"
                        ? "bg-[#E0F2FE]/80 backdrop-blur-md border-[#0EA5E9]/40 hover:bg-[#E0F2FE]/90"
                        : "bg-[#0B1220]/80 backdrop-blur-md border-white/30 hover:bg-[#0B1220]/90"
                    }`}
                  >
                    <motion.div
                      whileHover={{ rotate: 6 }}
                      transition={{ duration: 0.3 }}
                    >
                      <item.icon className="w-12 h-12 text-[#22D3EE] mx-auto mb-4" />
                    </motion.div>
                    <h3
                      className={`text-xl font-semibold mb-2 ${
                        theme === "light" ? "text-[#0B1220]" : "text-white"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={
                        theme === "light"
                          ? "text-[#0B1220]/70"
                          : "text-white/80"
                      }
                    >
                      {item.desc}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section ref={featuresRef} className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <motion.h2
              className={`text-4xl font-bold text-center mb-16 drop-shadow-lg ${
                theme === "light" ? "text-[#0B1220]" : "text-white"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 4px rgba(11,18,32,0.2)"
                    : "0 2px 4px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0 }}
              animate={featuresInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6 }}
            >
              Key Features
            </motion.h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Target,
                  title: "Tailored Insights",
                  desc: "fisheries, climate, policy",
                },
                {
                  icon: TrendingUp,
                  title: "Forecasts & Anomalies",
                  desc: "ML over ARGO trends",
                },
                {
                  icon: Map,
                  title: "Draw & Query Regions",
                  desc: "lasso/box and explore",
                },
                { icon: Download, title: "Exports", desc: "CSV, NetCDF, JSON" },
                {
                  icon: Brain,
                  title: "Memoryful Chat",
                  desc: "context across turns",
                },
                {
                  icon: Database,
                  title: "MCP-Orchestrated",
                  desc: "tool-based execution (safe)",
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={featuresInView ? { scale: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <Card
                    className={`p-6 transition-all duration-300 ${
                      theme === "light"
                        ? "bg-transparent border-[#0EA5E9]/40 hover:bg-[#E0F2FE]/20"
                        : "bg-transparent border-white/30 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <feature.icon className="w-6 h-6 text-[#22D3EE]" />
                      <h3
                        className={`font-semibold ${
                          theme === "light" ? "text-[#0B1220]" : "text-white"
                        }`}
                      >
                        {feature.title}
                      </h3>
                    </div>
                    <p
                      className={`text-sm ${
                        theme === "light"
                          ? "text-[#0B1220]/70"
                          : "text-white/80"
                      }`}
                    >
                      {feature.desc}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Showcase */}
        <section ref={showcaseRef} className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={showcaseInView ? { x: 0, opacity: 1 } : {}}
                transition={{ duration: 0.8 }}
              >
                <Card
                  className={`p-8 relative overflow-hidden ${
                    theme === "light"
                      ? "bg-[#E0F2FE]/80 backdrop-blur-md border-[#0EA5E9]/40"
                      : "bg-[#0B1220]/80 backdrop-blur-md border-white/30"
                  }`}
                >
                  <div
                    className={`absolute inset-0 ${
                      theme === "light"
                        ? "bg-gradient-to-br from-[#22D3EE]/30 to-[#0EA5E9]/20"
                        : "bg-gradient-to-br from-[#0EA5E9]/20 to-[#22D3EE]/10"
                    }`}
                  />
                  <div className="relative">
                    <div
                      className={`w-full h-48 rounded-lg mb-4 flex items-center justify-center ${
                        theme === "light"
                          ? "bg-[#22D3EE]/40"
                          : "bg-[#0284C7]/30"
                      }`}
                    >
                      <Map className="w-16 h-16 text-[#22D3EE]" />
                    </div>
                    <div
                      className={`backdrop-blur-sm rounded-full px-3 py-1 text-xs inline-block border ${
                        theme === "light"
                          ? "bg-[#E0F2FE]/80 text-[#0B1220] border-[#0EA5E9]/30"
                          : "bg-[#0B1220]/80 text-white border-white/20"
                      }`}
                      style={{
                        textShadow:
                          theme === "light"
                            ? "0 1px 2px rgba(11,18,32,0.3)"
                            : "0 1px 2px rgba(0,0,0,0.8)",
                      }}
                    >
                      Nearest floats to 15°N, 73°E
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={showcaseInView ? { x: 0, opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <Card
                  className={`p-8 relative overflow-hidden ${
                    theme === "light"
                      ? "bg-[#E0F2FE]/80 backdrop-blur-md border-[#0EA5E9]/40"
                      : "bg-[#0B1220]/80 backdrop-blur-md border-white/30"
                  }`}
                >
                  <div
                    className={`absolute inset-0 ${
                      theme === "light"
                        ? "bg-gradient-to-br from-[#0EA5E9]/30 to-[#22D3EE]/20"
                        : "bg-gradient-to-br from-[#22D3EE]/20 to-[#0EA5E9]/10"
                    }`}
                  />
                  <div className="relative">
                    <div
                      className={`w-full h-48 rounded-lg mb-4 flex items-center justify-center ${
                        theme === "light" ? "bg-[#0EA5E9]/40" : "bg-[#0EA5E9]/30"
                      }`}
                    >
                      <TrendingUp className="w-16 h-16 text-[#22D3EE]" />
                    </div>
                    <div
                      className={`backdrop-blur-sm rounded-full px-3 py-1 text-xs inline-block border ${
                        theme === "light"
                          ? "bg-[#E0F2FE]/80 text-[#0B1220] border-[#0EA5E9]/30"
                          : "bg-[#0B1220]/80 text-white border-white/20"
                      }`}
                      style={{
                        textShadow:
                          theme === "light"
                            ? "0 1px 2px rgba(11,18,32,0.3)"
                            : "0 1px 2px rgba(0,0,0,0.8)",
                      }}
                    >
                      DMQC preferred
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            <motion.div
              className="flex flex-wrap justify-center gap-4 mt-12"
              initial={{ y: 30, opacity: 0 }}
              animate={showcaseInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <div
                className={`backdrop-blur-sm rounded-full px-4 py-2 text-sm border ${
                  theme === "light"
                    ? "bg-[#E0F2FE]/70 text-[#0B1220] border-[#0EA5E9]/30"
                    : "bg-[#0B1220]/70 text-white border-white/20"
                }`}
              >
                Days → minutes: from NetCDF to answers
              </div>
              <div
                className={`backdrop-blur-sm rounded-full px-4 py-2 text-sm border ${
                  theme === "light"
                    ? "bg-[#E0F2FE]/70 text-[#0B1220] border-[#0EA5E9]/30"
                    : "bg-[#0B1220]/70 text-white border-white/20"
                }`}
              >
                Indian Ocean first, global ready
              </div>
            </motion.div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="py-20 px-6">
          <div className="container mx-auto max-w-6xl text-center">
            <motion.h2
              className={`text-4xl font-bold mb-16 drop-shadow-lg ${
                theme === "light" ? "text-[#0B1220]" : "text-white"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 4px rgba(11,18,32,0.2)"
                    : "0 2px 4px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              Who It's For
            </motion.h2>

            <div className="flex flex-wrap justify-center gap-4">
              {[
                {
                  title: "Researchers",
                  example: "Profiles within 200 km of Mumbai",
                },
                {
                  title: "Policymakers",
                  example: "Climate trends in territorial waters",
                },
                {
                  title: "Fisheries & Industry",
                  example: "Temperature zones for fishing",
                },
                {
                  title: "Educators & Students",
                  example: "Ocean data for coursework",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="group"
                >
                  <div
                    className={`backdrop-blur-sm rounded-full px-6 py-3 transition-all duration-300 cursor-pointer relative border ${
                      theme === "light"
                        ? "bg-transparent text-[#0B1220] hover:bg-[#0EA5E9]/20 border-[#0EA5E9]/30"
                        : "bg-transparent text-white hover:bg-white/10 border-white/20"
                    }`}
                  >
                    {item.title}
                    <div
                      className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-10 border ${
                        theme === "light"
                          ? "bg-[#0EA5E9] text-white border-[#0EA5E9]/30"
                          : "bg-[#0284C7] text-white border-white/20"
                      }`}
                    >
                      {item.example}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        <section className="py-16 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-wrap justify-center gap-8 mb-8">
              {[
                { icon: CheckCircle, title: "QC-Aware" },
                { icon: Shield, title: "Read-Only SQL" },
                { icon: Database, title: "Transparent Queries" },
                { icon: Target, title: "Open Standards" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className={`flex items-center gap-2 ${
                    theme === "light" ? "text-[#0B1220]" : "text-white"
                  }`}
                >
                  <item.icon className="w-5 h-5 text-[#22D3EE]" />
                  <span
                    className="text-sm font-medium drop-shadow-sm"
                    style={{
                      textShadow:
                        theme === "light"
                          ? "0 1px 2px rgba(11,18,32,0.2)"
                          : "0 1px 2px rgba(0,0,0,0.5)",
                    }}
                  >
                    {item.title}
                  </span>
                </motion.div>
              ))}
            </div>

            <div
              className={`backdrop-blur-sm rounded-lg p-4 overflow-hidden border ${
                theme === "light"
                  ? "bg-transparent border-[#0EA5E9]/30"
                  : "bg-transparent border-white/20"
              }`}
            >
              <Marquee>
                <span
                  className={`text-sm ${
                    theme === "light" ? "text-[#0B1220]/70" : "text-white/80"
                  }`}
                >
                  "Salinity near the equator, Mar 2023" • "Compare BGC in
                  Arabian Sea, last 6 months" • "Nearest floats to 12.9N, 74.8E"
                  •
                </span>
              </Marquee>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 text-center">
          <div className="container mx-auto max-w-4xl">
            <motion.h2
              className={`text-5xl font-bold mb-8 drop-shadow-lg ${
                theme === "light" ? "text-[#0B1220]" : "text-white"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 4px rgba(11,18,32,0.2)"
                    : "0 2px 4px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              Ready to explore?
            </motion.h2>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(34, 211, 238, 0)",
                    "0 0 0 10px rgba(34, 211, 238, 0.1)",
                    "0 0 0 0 rgba(34, 211, 238, 0)",
                  ],
                }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <Button
                  size="lg"
                  className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-8 py-3 shadow-lg"
                >
                  Sign Up
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className={`px-8 py-3 shadow-lg ${
                    theme === "light"
                      ? "border-[#0EA5E9]/50 text-[#0B1220] hover:bg-[#0EA5E9]/20 bg-[#E0F2FE]/50 backdrop-blur-sm"
                      : "border-white/50 text-white hover:bg-white/20 bg-[#0B1220]/50 backdrop-blur-sm"
                  }`}
                >
                  Log In
                </Button>
              </motion.div>
            </motion.div>

            <motion.p
              className={`text-sm drop-shadow-sm ${
                theme === "light" ? "text-[#0B1220]/80" : "text-white/90"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 1px 2px rgba(11,18,32,0.2)"
                    : "0 1px 2px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              No code. No NetCDF parsing.
            </motion.p>
          </div>
        </section>

        {/* Footer */}
        <footer
          className={`py-12 px-6 border-t ${
            theme === "light" ? "border-[#0EA5E9]/30" : "border-white/20"
          }`}
        >
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div
                className={`flex gap-6 text-sm ${
                  theme === "light" ? "text-[#0B1220]/70" : "text-white/80"
                }`}
              >
                <a
                  href="#"
                  className={`transition-colors ${
                    theme === "light"
                      ? "hover:text-[#0B1220]"
                      : "hover:text-white"
                  }`}
                >
                  About
                </a>
                <a
                  href="#"
                  className={`transition-colors ${
                    theme === "light"
                      ? "hover:text-[#0B1220]"
                      : "hover:text-white"
                  }`}
                >
                  Docs
                </a>
                <a
                  href="#"
                  className={`transition-colors ${
                    theme === "light"
                      ? "hover:text-[#0B1220]"
                      : "hover:text-white"
                  }`}
                >
                  Contact
                </a>
              </div>
              <div
                className={`text-sm ${
                  theme === "light" ? "text-[#0B1220]/70" : "text-white/80"
                }`}
              >
                © FloatChat
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
