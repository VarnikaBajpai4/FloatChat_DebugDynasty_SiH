import { motion, useScroll, useTransform, useInView } from "framer-motion";
import SignupButton from "@/components/auth/SignupButton";
import LoginButton from "@/components/auth/LoginButton";
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
import { useRef, useEffect } from "react";
import Marquee from "@/components/Marquee";
import FloatingJellyfish from "@/components/FloatingJellyfish";
import OceanWaves from "@/components/OceanWaves";
import FloatingParticles from "@/components/FloatingParticles";
import Footer from "@/components/Footer";
import FeatureRow from "@/components/FeatureRow";
import CardyChips from "@/components/CardyChips";

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
          ? "bg-gradient-to-br from-[#F0F9FF] via-[#E0F2FE] to-[#BAE6FD]"
          : "bg-gradient-to-br from-[#020617] via-[#0F172A] to-[#1E293B]"
      }`}
    >
      <FloatingParticles />
      <OceanWaves />
      <FloatingJellyfish />

      {/* Enhanced animated background */}
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{ y: backgroundY }}
      >
        <div
          className={`absolute inset-0 ${
            theme === "light"
              ? "bg-gradient-to-r from-[#06B6D4]/30 via-[#0EA5E9]/25 to-[#3B82F6]/30"
              : "bg-gradient-to-r from-[#06B6D4]/25 via-[#0EA5E9]/15 to-[#3B82F6]/25"
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
                stroke="#06B6D4"
                strokeWidth="0.8"
                fill="none"
                opacity={theme === "light" ? "0.6" : "0.4"}
              />
              <path
                d="M0,75 Q25,50 50,75 T100,75"
                stroke="#0EA5E9"
                strokeWidth="0.5"
                fill="none"
                opacity={theme === "light" ? "0.5" : "0.3"}
              />
              <path
                d="M0,25 Q25,0 50,25 T100,25"
                stroke="#3B82F6"
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
            ? "bg-gradient-to-br from-[#F0F9FF] via-[#E0F2FE] to-[#BAE6FD]"
            : "bg-gradient-to-br from-[#020617] via-[#0F172A] to-[#1E293B]"
        }`}
      />

      <motion.header
        className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b ${
          theme === "light"
            ? "bg-[#F0F9FF]/85 border-[#06B6D4]/40"
            : "bg-[#020617]/85 border-[#06B6D4]/30"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div
            className={`text-2xl font-bold tracking-tight bg-gradient-to-r ${
              theme === "light"
                ? "from-[#0F172A] to-[#1E293B] text-transparent bg-clip-text"
                : "from-[#06B6D4] to-[#3B82F6] text-transparent bg-clip-text"
            }`}
            whileHover={{ scale: 1.05 }}
          >
            FloatChat
          </motion.div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <SignupButton
              variant="ghost"
              className={`${
                theme === "light"
                  ? "text-[#0F172A] hover:bg-[#06B6D4]/15 hover:text-[#0F172A] border-[#06B6D4]/40"
                  : "text-[#E2E8F0] hover:bg-[#06B6D4]/20 hover:text-white border-[#06B6D4]/40"
              }`}
            >
              Sign Up
            </SignupButton>
            <LoginButton
              variant="ghost"
              className={`${
                theme === "light"
                  ? "text-[#0F172A] hover:bg-[#06B6D4]/15 hover:text-[#0F172A] border-[#06B6D4]/40"
                  : "text-[#E2E8F0] hover:bg-[#06B6D4]/20 hover:text-white border-[#06B6D4]/40"
              }`}
            >
              Log In
            </LoginButton>
          </div>
        </div>
      </motion.header>

      <div className="relative z-10">
        {/* Enhanced Hero Section */}
        <section
          ref={heroRef}
          className="pt-32 pb-20 px-6 text-center relative"
        >
          <div className="container mx-auto max-w-4xl">
            <motion.h1
              className={`text-6xl md:text-7xl font-bold mb-6 tracking-tight ${
                theme === "light" ? "text-[#0F172A]" : "text-[#F1F5F9]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 4px 20px rgba(15,23,42,0.15)"
                    : "0 4px 20px rgba(6,182,212,0.3)",
              }}
              initial={{ y: 50, opacity: 0 }}
              animate={heroInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Explore the oceans.{" "}
              <span
                className="bg-gradient-to-r from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6] text-transparent bg-clip-text"
                style={{
                  filter:
                    theme === "dark"
                      ? "drop-shadow(0 0 10px rgba(6,182,212,0.5))"
                      : "none",
                }}
              >
                Just ask.
              </span>
            </motion.h1>

            <motion.p
              className={`text-xl mb-8 max-w-2xl mx-auto ${
                theme === "light" ? "text-[#475569]" : "text-[#CBD5E1]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 10px rgba(71,85,105,0.1)"
                    : "0 2px 10px rgba(0,0,0,0.5)",
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
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <SignupButton
                  size="lg"
                  className="bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] hover:from-[#0891B2] hover:to-[#0284C7] text-white px-8 py-3 shadow-xl hover:shadow-2xl transition-all duration-300"
                  style={{
                    boxShadow:
                      theme === "dark"
                        ? "0 10px 40px rgba(6,182,212,0.3)"
                        : "0 10px 40px rgba(6,182,212,0.2)",
                  }}
                >
                  Sign Up
                </SignupButton>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <LoginButton
                  size="lg"
                  variant="outline"
                  className={`px-8 py-3 shadow-xl hover:shadow-2xl transition-all duration-300 ${
                    theme === "light"
                      ? "border-[#06B6D4]/60 text-[#0F172A] hover:bg-[#06B6D4]/10 bg-white/60 backdrop-blur-xl"
                      : "border-[#06B6D4]/60 text-[#E2E8F0] hover:bg-[#06B6D4]/10 bg-[#0F172A]/60 backdrop-blur-xl"
                  }`}
                >
                  Log In
                </LoginButton>
              </motion.div>
            </motion.div>

            <motion.div
              className={`text-sm rounded-full px-6 py-3 inline-block border backdrop-blur-xl ${
                theme === "light"
                  ? "text-[#475569] bg-white/50 border-[#06B6D4]/40"
                  : "text-[#CBD5E1] bg-[#0F172A]/50 border-[#06B6D4]/40"
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

        {/* Enhanced What It Does */}
        <section className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <motion.h2
              className={`text-4xl font-bold text-center mb-16 ${
                theme === "light" ? "text-[#0F172A]" : "text-[#F1F5F9]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 4px 15px rgba(15,23,42,0.1)"
                    : "0 4px 15px rgba(6,182,212,0.2)",
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
                  whileHover={{ scale: 1.05, y: -8 }}
                >
                  <Card
                    className={`p-8 text-center transition-all duration-500 hover:shadow-2xl group ${
                      theme === "light"
                        ? "bg-white/70 backdrop-blur-xl border-[#06B6D4]/30 hover:bg-white/80 hover:border-[#06B6D4]/50"
                        : "bg-[#0F172A]/70 backdrop-blur-xl border-[#06B6D4]/30 hover:bg-[#0F172A]/80 hover:border-[#06B6D4]/50"
                    }`}
                    style={{
                      boxShadow:
                        theme === "dark"
                          ? "0 0 30px rgba(6,182,212,0.1)"
                          : "0 10px 40px rgba(6,182,212,0.1)",
                    }}
                  >
                    <motion.div
                      whileHover={{ rotate: 12, scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      className="mb-4"
                    >
                      <item.icon className="w-12 h-12 text-[#06B6D4] mx-auto group-hover:text-[#0EA5E9] transition-colors duration-300" />
                    </motion.div>
                    <h3
                      className={`text-xl font-semibold mb-2 ${
                        theme === "light" ? "text-[#0F172A]" : "text-[#F1F5F9]"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={
                        theme === "light" ? "text-[#475569]" : "text-[#CBD5E1]"
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

        {/* Enhanced Key Features */}
        <section ref={featuresRef} className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <motion.h2
              className={`text-4xl font-bold text-center mb-16 ${
                theme === "light" ? "text-[#0F172A]" : "text-[#F1F5F9]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 10px rgba(15,23,42,0.1)"
                    : "0 2px 10px rgba(6,182,212,0.2)",
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
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card
                    className={`p-6 transition-all duration-300 group ${
                      theme === "light"
                        ? "bg-transparent border-[#06B6D4]/30 hover:bg-white/30 hover:border-[#06B6D4]/50"
                        : "bg-transparent border-[#06B6D4]/30 hover:bg-[#0F172A]/30 hover:border-[#06B6D4]/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <feature.icon className="w-6 h-6 text-[#06B6D4] group-hover:text-[#0EA5E9] transition-colors duration-300" />
                      <h3
                        className={`font-semibold ${
                          theme === "light"
                            ? "text-[#0F172A]"
                            : "text-[#F1F5F9]"
                        }`}
                      >
                        {feature.title}
                      </h3>
                    </div>
                    <p
                      className={`text-sm ${
                        theme === "light" ? "text-[#475569]" : "text-[#CBD5E1]"
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

        {/* Enhanced Showcase */}
        {/* <section ref={showcaseRef} className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={showcaseInView ? { x: 0, opacity: 1 } : {}}
                transition={{ duration: 0.8 }}
              >
                <Card
                  className={`p-8 relative overflow-hidden group ${
                    theme === "light"
                      ? "bg-white/70 backdrop-blur-xl border-[#06B6D4]/40"
                      : "bg-[#0F172A]/70 backdrop-blur-xl border-[#06B6D4]/40"
                  }`}
                  style={{
                    boxShadow:
                      theme === "dark"
                        ? "0 0 40px rgba(6,182,212,0.2)"
                        : "0 20px 60px rgba(6,182,212,0.15)",
                  }}
                >
                  <div
                    className={`absolute inset-0 opacity-50 ${
                      theme === "light"
                        ? "bg-gradient-to-br from-[#06B6D4]/20 to-[#3B82F6]/10"
                        : "bg-gradient-to-br from-[#06B6D4]/15 to-[#3B82F6]/5"
                    }`}
                  />
                  <div className="relative">
                    <motion.div
                      className={`w-full h-48 rounded-xl mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-500 ${
                        theme === "light"
                          ? "bg-gradient-to-br from-[#06B6D4]/30 to-[#0EA5E9]/20"
                          : "bg-gradient-to-br from-[#06B6D4]/20 to-[#0EA5E9]/10"
                      }`}
                      whileHover={{ rotateY: 5 }}
                    >
                      <Map className="w-16 h-16 text-[#06B6D4]" />
                    </motion.div>
                    <div
                      className={`backdrop-blur-xl rounded-full px-3 py-1 text-xs inline-block border ${
                        theme === "light"
                          ? "bg-white/80 text-[#0F172A] border-[#06B6D4]/40"
                          : "bg-[#0F172A]/80 text-[#E2E8F0] border-[#06B6D4]/40"
                      }`}
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
                  className={`p-8 relative overflow-hidden group ${
                    theme === "light"
                      ? "bg-white/70 backdrop-blur-xl border-[#06B6D4]/40"
                      : "bg-[#0F172A]/70 backdrop-blur-xl border-[#06B6D4]/40"
                  }`}
                  style={{
                    boxShadow:
                      theme === "dark"
                        ? "0 0 40px rgba(6,182,212,0.2)"
                        : "0 20px 60px rgba(6,182,212,0.15)",
                  }}
                >
                  <div
                    className={`absolute inset-0 opacity-50 ${
                      theme === "light"
                        ? "bg-gradient-to-br from-[#3B82F6]/20 to-[#06B6D4]/10"
                        : "bg-gradient-to-br from-[#3B82F6]/15 to-[#06B6D4]/5"
                    }`}
                  />
                  <div className="relative">
                    <motion.div
                      className={`w-full h-48 rounded-xl mb-4 flex items-center justify-center group-hover:scale-105 transition-transform duration-500 ${
                        theme === "light"
                          ? "bg-gradient-to-br from-[#3B82F6]/30 to-[#06B6D4]/20"
                          : "bg-gradient-to-br from-[#3B82F6]/20 to-[#06B6D4]/10"
                      }`}
                      whileHover={{ rotateY: -5 }}
                    >
                      <TrendingUp className="w-16 h-16 text-[#3B82F6]" />
                    </motion.div>
                    <div
                      className={`backdrop-blur-xl rounded-full px-3 py-1 text-xs inline-block border ${
                        theme === "light"
                          ? "bg-white/80 text-[#0F172A] border-[#06B6D4]/40"
                          : "bg-[#0F172A]/80 text-[#E2E8F0] border-[#06B6D4]/40"
                      }`}
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
                className={`backdrop-blur-xl rounded-full px-4 py-2 text-sm border ${
                  theme === "light"
                    ? "bg-white/60 text-[#0F172A] border-[#06B6D4]/40"
                    : "bg-[#0F172A]/60 text-[#E2E8F0] border-[#06B6D4]/40"
                }`}
              >
                Days → minutes: from NetCDF to answers
              </div>
              <div
                className={`backdrop-blur-xl rounded-full px-4 py-2 text-sm border ${
                  theme === "light"
                    ? "bg-white/60 text-[#0F172A] border-[#06B6D4]/40"
                    : "bg-[#0F172A]/60 text-[#E2E8F0] border-[#06B6D4]/40"
                }`}
              >
                Indian Ocean first, global ready
              </div>
            </motion.div>
          </div>
        </section> */}

        {/* Enhanced Who It's For */}
        <section className="py-20 px-6">
          <div className="container mx-auto max-w-6xl text-center">
            <motion.h2
              className={`text-4xl font-bold mb-16 ${
                theme === "light" ? "text-[#0F172A]" : "text-[#F1F5F9]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 2px 10px rgba(15,23,42,0.1)"
                    : "0 2px 10px rgba(6,182,212,0.2)",
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              Who It's For
            </motion.h2>

            <CardyChips theme={theme}/>
          </div>
        </section>

        {/* Enhanced Trust Strip */}
        <section className="py-16 px-6">
          <div className="container mx-auto max-w-6xl">
            <FeatureRow theme={theme}/>

            <div
              className={`backdrop-blur-xl rounded-xl p-4 overflow-hidden border ${
                theme === "light"
                  ? "bg-white/30 border-[#06B6D4]/40"
                  : "bg-[#0F172A]/30 border-[#06B6D4]/40"
              }`}
            >
              <Marquee>
                <span
                  className={`text-sm ${
                    theme === "light" ? "text-[#475569]" : "text-[#CBD5E1]"
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

        {/* Enhanced Final CTA */}
        <section className="py-20 px-6 text-center">
          <div className="container mx-auto max-w-4xl">
            <motion.h2
              className={`text-5xl font-bold mb-8 ${
                theme === "light" ? "text-[#0F172A]" : "text-[#F1F5F9]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 4px 20px rgba(15,23,42,0.1)"
                    : "0 4px 20px rgba(6,182,212,0.3)",
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
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(6, 182, 212, 0)",
                    "0 0 0 15px rgba(6, 182, 212, 0.1)",
                    "0 0 0 0 rgba(6, 182, 212, 0)",
                  ],
                }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
              >
                <SignupButton
                  size="lg"
                  className="bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] hover:from-[#0891B2] hover:to-[#0284C7] text-white px-8 py-3 shadow-2xl hover:shadow-[0_20px_60px_rgba(6,182,212,0.4)] transition-all duration-500"
                >
                  Sign Up
                </SignupButton>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                <LoginButton
                  size="lg"
                  variant="outline"
                  className={`px-8 py-3 shadow-xl hover:shadow-2xl transition-all duration-500 ${
                    theme === "light"
                      ? "border-[#06B6D4]/60 text-[#0F172A] hover:bg-[#06B6D4]/15 bg-white/60 backdrop-blur-xl"
                      : "border-[#06B6D4]/60 text-[#E2E8F0] hover:bg-[#06B6D4]/15 bg-[#0F172A]/60 backdrop-blur-xl"
                  }`}
                >
                  Log In
                </LoginButton>
              </motion.div>
            </motion.div>

            <motion.p
              className={`text-sm ${
                theme === "light" ? "text-[#475569]" : "text-[#CBD5E1]"
              }`}
              style={{
                textShadow:
                  theme === "light"
                    ? "0 1px 5px rgba(71,85,105,0.1)"
                    : "0 1px 5px rgba(0,0,0,0.3)",
              }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              No code. No NetCDF parsing.
            </motion.p>
          </div>
        </section>

        <Footer theme={theme} />
      </div>
    </div>
  );
}
