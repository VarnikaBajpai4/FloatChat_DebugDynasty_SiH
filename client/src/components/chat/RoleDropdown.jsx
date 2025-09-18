import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLES } from "@/constants";

export default function RoleDropdown({ role, setRole }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 text-sm",
          "rounded-full border border-[#06B6D4]/30 bg-white/70",
          "px-3 py-1.5 text-slate-700 hover:bg-white"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {role}
        <ChevronDown className="size-4 opacity-70" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 bottom-[110%] z-50 min-w-[160px]",
              "rounded-xl border border-[#06B6D4]/30 bg-white/95 backdrop-blur-xl",
              "shadow-xl overflow-hidden"
            )}
            role="listbox"
          >
            {ROLES.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => {
                    setRole(r);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm",
                    r === role ? "bg-[#06B6D4]/15 text-slate-900" : "hover:bg-[#06B6D4]/10 text-slate-700"
                  )}
                  role="option"
                  aria-selected={r === role}
                >
                  {r}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}