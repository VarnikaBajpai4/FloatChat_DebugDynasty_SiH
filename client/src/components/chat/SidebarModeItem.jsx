import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TILE_BASE } from "@/constants";

export default function SidebarModeItem({ open, icon: Icon, label, active, disabled, onClick }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      className={cn(
        "w-full rounded-md text-slate-700 transition-colors",
        disabled && "opacity-60 cursor-not-allowed",
        open
          ? cn(
              "flex items-center gap-3 px-2 py-2",
              active ? "bg-[#06B6D4]/15" : "hover:bg-[#06B6D4]/10"
            )
          : "flex items-center justify-center py-2"
      )}
      title={label}
      whileHover={disabled ? {} : { scale: 1.03, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      {open ? (
        <>
          <Icon className={cn("size-4", active ? "text-[#0284C7]" : "")} />
          <span className="text-sm">{label}</span>
        </>
      ) : (
        <div
          className={cn(
            TILE_BASE,
            active ? "bg-[#06B6D4]/20 ring-1 ring-[#06B6D4]/40" : "bg-white/80 border border-[#06B6D4]/30"
          )}
        >
          <Icon className={cn("size-4", active ? "text-[#0284C7]" : "text-[#0EA5E9]")} />
        </div>
      )}
    </motion.button>
  );
}