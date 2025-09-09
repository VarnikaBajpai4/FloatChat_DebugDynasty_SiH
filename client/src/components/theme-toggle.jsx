"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { motion } from "framer-motion"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={`w-9 h-9 p-0 border ${theme === "light"
          ? "text-[#0B1220] hover:bg-[#0EA5E9]/20 border-[#0EA5E9]/30"
          : "text-white hover:bg-white/20 border-white/20"
        }`}
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === "light" ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </motion.div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
