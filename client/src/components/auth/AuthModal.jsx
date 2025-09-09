import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

const stop = (e) => e.stopPropagation();

export default function AuthModal({ open, onClose, mode = "login" }) {
  const { theme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const title = mode === "signup" ? "Create your account" : "Welcome back";
  const primary = "Continue";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={stop}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`relative w-[92%] max-w-md rounded-xl border p-6 shadow-2xl ${
              theme === "light"
                ? "bg-[#E0F2FE] border-[#0EA5E9]/30"
                : "bg-[#0B1220] border-white/20"
            }`}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className={`absolute right-3 top-3 rounded-md px-2 py-1 text-sm transition-colors ${
                theme === "light"
                  ? "text-[#0B1220]/70 hover:bg-[#0EA5E9]/20"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              ×
            </button>

            <h3
              className={`text-xl font-semibold mb-1 ${
                theme === "light" ? "text-[#0B1220]" : "text-white"
              }`}
            >
              {title}
            </h3>
            <p
              className={`text-sm mb-4 ${
                theme === "light" ? "text-[#0B1220]/70" : "text-white/80"
              }`}
            >
              This is a static preview modal. Integrate real auth later.
            </p>

            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                  theme === "light"
                    ? "bg-white/90 border-[#0EA5E9]/30 text-[#0B1220] placeholder:text-[#0B1220]/50 focus:border-[#0EA5E9]"
                    : "bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                }`}
              />
              <input
                type="password"
                placeholder="Password"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors ${
                  theme === "light"
                    ? "bg-white/90 border-[#0EA5E9]/30 text-[#0B1220] placeholder:text-[#0B1220]/50 focus:border-[#0EA5E9]"
                    : "bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                }`}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                className={`${
                  theme === "light"
                    ? "text-[#0B1220] hover:bg-[#0EA5E9]/20"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Cancel
              </Button>
              <Button
                className={`${
                  theme === "light"
                    ? "bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                    : "bg-[#0EA5E9] hover:bg-[#22D3EE] text-white"
                }`}
                onClick={onClose}
              >
                {primary}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}