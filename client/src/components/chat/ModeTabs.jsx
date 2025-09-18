import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MODES } from "@/constants";

export default function ModeTabs({ selected, onSelect, disabled }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border",
        "bg-white/70 backdrop-blur-xl",
        "border-[#06B6D4]/40 p-1",
        disabled && "opacity-70"
      )}
    >
      {MODES.map((m) => {
        const active = m === selected;
        return (
          <Button
            key={m}
            variant="ghost"
            disabled={disabled}
            onClick={() => onSelect(m)}
            className={cn(
              "h-8 rounded-full px-3 text-sm transition-all",
              active
                ? "bg-[#06B6D4]/20 text-slate-800"
                : "text-slate-700 hover:bg-[#06B6D4]/10"
            )}
          >
            {m}
          </Button>
        );
      })}
    </div>
  );
}