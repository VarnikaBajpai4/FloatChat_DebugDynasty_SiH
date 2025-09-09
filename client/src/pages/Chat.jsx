import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  PanelLeftOpen,
  PanelLeftClose,
  Plus,
  Compass,
  LineChart,
  Send,
  LogOut,
  Sparkles,
} from "lucide-react";

/**
 * Chat page - refined per feedback:
 * - Single toggle button for sidebar (inside the sidebar header).
 * - Smooth animation for BOTH expand and collapse (no instant snap).
 * - Collapsed icons perfectly aligned on one vertical line with identical tile size.
 */

const API_BASE =
  (import.meta.env.MODE === "production" && import.meta.env.VITE_API_DOMAIN)
    ? import.meta.env.VITE_API_DOMAIN
    : "";

const ROLES = ["Fisheries", "Expert", "Student"];

// Shared class for collapsed icon tiles (ensures identical size and alignment)
const TILE_BASE =
  "h-11 w-11 rounded-xl flex items-center justify-center select-none";

export default function Chat() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [role, setRole] = useState(ROLES[0]);
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [creating, setCreating] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoadingConvos(true);
        const res = await fetch(`${API_BASE}/api/chat`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load conversations");
        const data = await res.json();
        if (data?.success) {
          setConversations(data.conversations || []);
        }
      } catch {
        setConversations([]);
      } finally {
        setLoadingConvos(false);
      }
    };
    fetchConversations();
  }, []);

  const handleNewChat = async () => {
    try {
      setCreating(true);
      const res = await fetch(`${API_BASE}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const data = await res.json();
      const convo = data?.conversation;
      if (convo) {
        setConversations((prev) => [convo, ...prev]);
        setActiveId(convo.id);
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    // If no active chat, create one implicitly
    if (!activeId) {
      await handleNewChat();
    }
    setPrompt("");
  };

  const suggestions = [
    "Nearest floats to 12.9N, 74.8E",
    "Plot salinity in Mar 2023",
    "Compare BGC in Arabian Sea (6m)",
  ];

  return (
    <div
      className={cn(
        "h-screen w-full flex overflow-hidden",
        "bg-gradient-to-br from-[#F0F9FF] via-[#E0F2FE] to-[#BAE6FD]"
      )}
    >
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        <motion.aside
          // IMPORTANT: Do NOT change key so it doesn't remount.
          // That way width animates in BOTH directions.
          initial={false}
          animate={{ width: sidebarOpen ? 280 : 72 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className={cn(
            "h-full border-r",
            "bg-white/70 backdrop-blur-xl",
            "flex flex-col"
          )}
        >
          {/* Header with the ONLY toggle button */}
          <div className="flex items-center justify-between px-2 py-3">
            <motion.button
              onClick={() => setSidebarOpen((v) => !v)}
              className={cn(
                "rounded-md p-2 hover:bg-[#06B6D4]/10 outline-none",
                "focus-visible:ring-[3px] focus-visible:ring-[#06B6D4]/30"
              )}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.03 }}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-5 text-slate-700" />
              ) : (
                <PanelLeftOpen className="size-5 text-slate-700" />
              )}
            </motion.button>

            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  key="brand"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-sm font-semibold text-slate-700"
                >
                  FloatChat
                </motion.span>
              )}
            </AnimatePresence>

            {/* spacer to keep centered brand balanced */}
            <span className="w-9" />
          </div>

          {/* Create a new chat */}
          <div className="px-2">
            {sidebarOpen ? (
              <motion.div whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleNewChat}
                  disabled={creating}
                  className={cn(
                    "w-full justify-start",
                    "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white",
                    "hover:from-[#0891B2] hover:to-[#0284C7]"
                  )}
                >
                  <Plus className="size-4" />
                  <span className="ml-2">Create a new chat</span>
                </Button>
              </motion.div>
            ) : (
              // Collapsed: perfectly centered uniform tile
              <motion.button
                onClick={handleNewChat}
                disabled={creating}
                className="w-full flex items-center justify-center py-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Create a new chat"
                title="Create a new chat"
              >
                <div
                  className={cn(
                    TILE_BASE,
                    "rounded-full",
                    "bg-gradient-to-b from-[#06B6D4] to-[#0EA5E9]",
                    "shadow-md text-white"
                  )}
                >
                  <Plus className="size-5" />
                </div>
              </motion.button>
            )}
          </div>

          {/* Quick tools */}
          <div className="px-2 mt-2 space-y-2">
            <SidebarItem
              open={sidebarOpen}
              icon={Compass}
              label="GeoMap"
              onClick={() => {}}
            />
            <SidebarItem
              open={sidebarOpen}
              icon={LineChart}
              label="Prediction"
              onClick={() => {}}
            />
          </div>

          {/* Chat list */}
          <div className="mt-3 px-2">
            {sidebarOpen && (
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 px-1">
                Chats
              </div>
            )}
            <div
              className={cn(
                "overflow-auto pr-1",
                sidebarOpen ? "h-[calc(100vh-270px)]" : "h-[calc(100vh-230px)]"
              )}
            >
              {loadingConvos ? (
                <div className="px-2 py-3 text-slate-500 text-sm">
                  Loading...
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-2 py-3 text-slate-500 text-sm">
                  {sidebarOpen ? "No chats yet" : "—"}
                </div>
              ) : (
                <ul className={cn(sidebarOpen ? "space-y-1" : "space-y-2")}>
                  {conversations.map((c) => {
                    const isActive = activeId === c.id;
                    return (
                      <li key={c.id}>
                        {sidebarOpen ? (
                          <motion.button
                            onClick={() => setActiveId(c.id)}
                            className={cn(
                              "w-full text-left px-2 py-2 rounded-md",
                              isActive
                                ? "bg-[#06B6D4]/15 text-slate-800"
                                : "hover:bg-[#06B6D4]/10 text-slate-700"
                            )}
                            title={c.title}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <span className="truncate block">{c.title}</span>
                          </motion.button>
                        ) : (
                          <motion.button
                            onClick={() => setActiveId(c.id)}
                            className="w-full flex items-center justify-center py-2"
                            title={c.title}
                            whileHover={{ scale: 1.07 }}
                            whileTap={{ scale: 0.96 }}
                          >
                            <div
                              className={cn(
                                TILE_BASE,
                                isActive
                                  ? "bg-[#06B6D4]/20 ring-1 ring-[#06B6D4]/40"
                                  : "bg-white/80 border border-[#06B6D4]/30"
                              )}
                            >
                              <Sparkles
                                className={cn(
                                  "size-4",
                                  isActive ? "text-[#0284C7]" : "text-[#0EA5E9]"
                                )}
                              />
                            </div>
                          </motion.button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Logout (bottom) */}
          <div className="mt-auto p-2">
            {sidebarOpen ? (
              <motion.div whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-[#06B6D4]/10"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4 text-slate-700" />
                  <span className="ml-2">Logout</span>
                </Button>
              </motion.div>
            ) : (
              <motion.button
                onClick={handleLogout}
                className="w-full flex items-center justify-center py-2"
                aria-label="Logout"
                title="Logout"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div
                  className={cn(
                    TILE_BASE,
                    "rounded-full bg-white/80 border border-[#06B6D4]/30"
                  )}
                >
                  <LogOut className="size-4 text-slate-700" />
                </div>
              </motion.button>
            )}
          </div>
        </motion.aside>
      </AnimatePresence>

      {/* Right panel */}
      <div className="flex-1 relative overflow-hidden">
        {/* Role selector centered top bar */}
        <div className="h-14 flex items-center justify-center px-4">
          <RoleSelector role={role} setRole={setRole} />
        </div>

        {/* Center greeting and suggestions */}
        <div className="relative h-[calc(100%-56px)]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          >
            <h1
              className={cn(
                "text-3xl sm:text-4xl font-semibold text-center",
                "text-slate-800"
              )}
            >
              {greeting}
              {user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Where should we begin?
            </h1>

            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {suggestions.map((s, i) => (
                <motion.button
                  key={i}
                  onClick={() => setPrompt(s)}
                  className={cn(
                    "pointer-events-auto",
                    "text-sm px-3 py-1.5 rounded-full border",
                    "bg-white/70 hover:bg-white",
                    "border-[#06B6D4]/30 text-slate-700"
                  )}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Bottom input bar */}
          <form onSubmit={handleSend} className="absolute left-0 right-0 bottom-4 flex justify-center px-4">
            <motion.div
              className={cn(
                "w-full max-w-3xl",
                "bg-white/90 border border-[#06B6D4]/30",
                "rounded-full shadow-xl backdrop-blur-xl",
                "flex items-center gap-2 px-4 py-2"
              )}
              style={{ boxShadow: "0 10px 30px rgba(6,182,212,0.15)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 22 }}
            >
              <input
                type="text"
                className={cn(
                  "flex-1 bg-transparent outline-none",
                  "placeholder:text-slate-400 text-slate-800",
                  "py-2"
                )}
                placeholder="Ask anything"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button
                type="submit"
                className={cn(
                  "rounded-full px-3",
                  "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white",
                  "hover:from-[#0891B2] hover:to-[#0284C7]"
                )}
                aria-label="Send"
              >
                <Send className="size-4" />
              </Button>
            </motion.div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ open, icon: Icon, label, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "w-full rounded-md text-slate-700",
        open
          ? "flex items-center gap-3 px-2 py-2 hover:bg-[#06B6D4]/10"
          : "flex items-center justify-center py-2"
      )}
      title={label}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      {open ? (
        <>
          <Icon className="size-4" />
          <span className="text-sm">{label}</span>
        </>
      ) : (
        <div className={cn(TILE_BASE, "bg-white/80 border border-[#06B6D4]/30")}>
          <Icon className="size-4 text-[#0EA5E9]" />
        </div>
      )}
    </motion.button>
  );
}

function RoleSelector({ role, setRole }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border",
        "bg-white/70 backdrop-blur-xl",
        "border-[#06B6D4]/40 p-1"
      )}
    >
      {ROLES.map((r) => {
        const active = r === role;
        return (
          <Button
            key={r}
            variant="ghost"
            onClick={() => setRole(r)}
            className={cn(
              "h-8 rounded-full px-3 text-sm transition-all",
              active
                ? "bg-[#06B6D4]/20 text-slate-800"
                : "text-slate-700 hover:bg-[#06B6D4]/10"
            )}
          >
            {r}
          </Button>
        );
      })}
    </div>
  );
}
