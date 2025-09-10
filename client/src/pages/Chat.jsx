import React, { useEffect, useMemo, useState, useRef } from "react";
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
  MessageSquare,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Chat page - mode sync + role dropdown
 * - Top center shows ModeTabs: Chat, GeoMap, Prediction (synced with left bar).
 * - Once first message is sent in the current chat, mode becomes locked.
 * - Before sending, mode can be switched from either top tabs or left quick tools.
 * - Role selector (Default, Researcher, Policy-Maker, Student) moved into the bottom input bar as a dropdown on the left.
 * - Sidebar collapse/expand is smoothly animated; collapsed icons align perfectly on one vertical line.
 */

const API_BASE =
  (import.meta.env.MODE === "production" && import.meta.env.VITE_API_DOMAIN)
    ? import.meta.env.VITE_API_DOMAIN
    : "";

const ROLES = ["Default", "Researcher", "Policy-Maker", "Student"];
const MODES = ["Chat", "GeoMap", "Prediction"];

// Shared class for collapsed icon tiles (ensures identical size and alignment)
const TILE_BASE =
  "h-11 w-11 rounded-xl flex items-center justify-center select-none";

export default function Chat() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Role lives in input bar dropdown
  const [role, setRole] = useState(ROLES[0]);

  // Mode shown in top tabs and left quick tools
  const [selectedMode, setSelectedMode] = useState("Chat");
  const [modeLocked, setModeLocked] = useState(false); // locked after first send for current chat
  // Track chats that have been locked by a prediction run (per-conversation lock)
  const [predLockedChats, setPredLockedChats] = useState({});

  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  // GeoMap: hold a confirmed polygon before first send
  const [geoPendingCoords, setGeoPendingCoords] = useState(null);

  // Prediction mode state
  const [predVar, setPredVar] = useState("temperature");
  const [predHorizonNum, setPredHorizonNum] = useState(14);
  const [predHorizonUnit, setPredHorizonUnit] = useState("days"); // days|weeks|months|years
  const [predSinceDays, setPredSinceDays] = useState(720);
  const [predReturnHistory, setPredReturnHistory] = useState(true);
  const [predHistoryDays, setPredHistoryDays] = useState(30);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState("");
  const [predResult, setPredResult] = useState(null);
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
      // Always start a brand new chat in Default mode (Chat UI), independent of current selection
      const serverMode = "Default";
      const res = await fetch(`${API_BASE}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: role,
          mode: serverMode,
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const data = await res.json();
      const convo = data?.conversation;
      if (convo) {
        setConversations((prev) => [convo, ...prev]);
        setActiveId(convo.id);
        setMessages([]);
        // Sync UI mode/role with server
        const uiMode = "Chat";
        setSelectedMode(uiMode);
        // Clear any prediction panel state for a fresh chat
        setPredResult(null);
        setPredError("");
        setPredLoading(false);
        setRole(convo.role || role);
        // A new chat hasn't started yet; allow mode switches until first send
        setModeLocked(false);
        return convo;
      }
      return null;
    } catch {
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  // Programmatic send (used by GeoMap picker)
  // Programmatic send used by GeoMap to submit coordinates as first message
  const sendProgrammaticMessage = async (text) => {
    const message = (text || "").trim();
    if (!message) return;

    try {
      setSending(true);

      // Ensure we have a conversation
      let convId = activeId;
      if (!convId) {
        const created = await handleNewChat();
        convId = created?.id;
        if (!convId) throw new Error("Failed to create conversation");
      }

      // Optimistically add user + assistant placeholder
      const userMsg = {
        id: `local-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      const assistantPlaceholder = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);

      // Lock mode and role selectors after first send
      setModeLocked(true);

      // Auto-rename default title from first message
      try {
        const conv = conversations.find((x) => x.id === convId);
        const looksDefault =
          conv &&
          (/^Chat\s\d+$/i.test(conv.title || "") || /^New Chat$/i.test(conv.title || ""));
        const newTitle = message.slice(0, 40).trim();
        if (conv && looksDefault && newTitle) {
          const r = await fetch(`${API_BASE}/api/chat/${convId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ title: newTitle }),
          });
          const d = await r.json().catch(() => null);
          if (r.ok && d?.success && d?.conversation?.title) {
            setConversations((prev) =>
              prev.map((c) => (c.id === convId ? { ...c, title: d.conversation.title } : c))
            );
          }
        }
      } catch {}

      // Stream from backend
      const res = await fetch(`${API_BASE}/api/chat/${convId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) throw new Error("Failed to send message");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalAssistantId = null;

      const appendToAssistant = (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "assistant") {
              updated[i] = {
                ...updated[i],
                content: (updated[i].content || "") + chunk,
              };
              break;
            }
          }
          return updated;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const lines = raw.split("\n");
          let event = null;
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }

          if (event === "token") {
            try {
              const payload = JSON.parse(dataStr);
              const token = payload?.content ?? "";
              appendToAssistant(token + " ");
            } catch {}
          } else if (event === "done") {
            try {
              const payload = JSON.parse(dataStr);
              finalAssistantId = payload?.messageId || null;
            } catch {}
          }
        }
      }

      if (finalAssistantId) {
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "assistant") {
              updated[i] = { ...updated[i], id: finalAssistantId, _id: finalAssistantId };
              break;
            }
          }
          return updated;
        });
      }
    } catch {
      // surface minimal error by updating assistant placeholder
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant") {
            updated[i] = { ...updated[i], content: "[Error while streaming response]" };
            break;
          }
        }
        return updated;
      });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    // If GeoMap polygon has been confirmed (but not sent yet), compose full message
    let finalMessage = text;
    if (geoPendingCoords && selectedMode === "GeoMap" && !modeLocked) {
      const coordsStr = geoPendingCoords
        .map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`)
        .join(" | ");
      const header = `Polygon (lat,lon) 5 points: ${coordsStr}`;
      finalMessage = `${header}\n\n${text}`;
    }

    // Optionally persist current role selection to conversation before first send
    try {
      if (activeId) {
        await fetch(`${API_BASE}/api/chat/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role }),
        });
      }
    } catch {}

    await sendProgrammaticMessage(finalMessage);
    setGeoPendingCoords(null);
    setPrompt("");
  };

  // Run prediction via backend API
  const handleRunPrediction = async () => {
    setPredError("");
    setPredResult(null);
    setPredLoading(true);
    try {
      // Ensure a conversation exists before running prediction
      let convId = activeId;
      if (!convId) {
        const created = await handleNewChat();
        convId = created?.id;
        if (convId) setActiveId(convId);
        else throw new Error("Failed to create conversation");
      }
      // Lock mode selection for this conversation from now on
      setModeLocked(true);

      // Persist conversation mode to Prediction so switching back restores the Prediction UI
      try {
        await fetch(`${API_BASE}/api/chat/${convId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mode: "Prediction" }),
        });
      } catch {}

      const singular = { days: "day", weeks: "week", months: "month", years: "year" };
      const unit = Number(predHorizonNum) === 1 ? singular[predHorizonUnit] : predHorizonUnit;
      const horizon = `${Number(predHorizonNum)} ${unit}`;
  
      const payload = {
        variable: predVar,
        horizon,
        sinceDays: Number(predSinceDays) || 1095,
        returnHistory: Boolean(predReturnHistory),
        historyDays: Number(predHistoryDays) || 30,
      };
  
      const res = await fetch(`${API_BASE}/api/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      // Mark this conversation as prediction-locked
      setPredLockedChats((prev) => ({ ...prev, [convId]: true }));

      // Try to parse JSON either in success or error paths
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data?.success) {
        const baseMsg = data?.error || res.statusText || "Prediction failed";
        const details =
          typeof data?.details === "string" ? ` — ${String(data.details).slice(0, 300)}` : "";
        const message = `${baseMsg}${details}`;
        console.error("Prediction failed:", { status: res.status, data });
        throw new Error(message);
      }

      setPredResult(data);
    } catch (e) {
      setPredError(e?.message || "Prediction failed");
    } finally {
      setPredLoading(false);
    }
  };
  const suggestions = [
    "Nearest floats to 12.9N, 74.8E",
    "Plot salinity in Mar 2023",
    "Compare BGC in Arabian Sea (6m)",
  ];

  // Handlers for mode switch from top or left
  const requestModeChange = (mode) => {
    if (modeLocked || predLoading) return; // block mode change once locked or while running
    setSelectedMode(mode);
    if (mode !== "Prediction") {
      // Clear any stale prediction UI/results when leaving Prediction
      setPredResult(null);
      setPredError("");
      setPredLoading(false);
    }
  };

  // Show greeting whenever there's no active chat OR the active chat has zero messages
  const showGreeting = !activeId || (messages && messages.length === 0);

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
          // Keep single instance so width animates both directions
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

          {/* Quick tools: Chat, GeoMap, Prediction (synced with top tabs) */}
          <div className="px-2 mt-2 space-y-2">
            <SidebarModeItem
              open={sidebarOpen}
              icon={MessageSquare}
              label="Chat"
              active={selectedMode === "Chat"}
              disabled={modeLocked || predLoading || (selectedMode === "GeoMap" && geoPendingCoords)}
              onClick={() => requestModeChange("Chat")}
            />
            <SidebarModeItem
              open={sidebarOpen}
              icon={Compass}
              label="GeoMap"
              active={selectedMode === "GeoMap"}
              disabled={modeLocked || predLoading || (selectedMode === "GeoMap" && geoPendingCoords)}
              onClick={() => requestModeChange("GeoMap")}
            />
            <SidebarModeItem
              open={sidebarOpen}
              icon={LineChart}
              label="Prediction"
              active={selectedMode === "Prediction"}
              disabled={modeLocked || predLoading || (selectedMode === "GeoMap" && geoPendingCoords)}
              onClick={() => requestModeChange("Prediction")}
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
                sidebarOpen ? "h-[calc(100vh-320px)]" : "h-[calc(100vh-280px)]"
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
                            onClick={async () => {
                              setActiveId(c.id);
                              setMessages([]);
                              // Immediately clear any stale prediction UI until we resolve the chat's actual mode
                              setPredResult(null);
                              setPredError("");
                              setPredLoading(false);
                              try {
                                // Sync UI from chat meta
                                const metaRes = await fetch(`${API_BASE}/api/chat/${c.id}`, {
                                  credentials: "include",
                                });
                                const metaData = metaRes.ok ? await metaRes.json() : null;
                                if (metaData?.success && metaData.conversation) {
                                  const uiMode = metaData.conversation.mode === "Default" ? "Chat" : metaData.conversation.mode;
                                  setSelectedMode(uiMode);
                                  // When switching to a non-Prediction chat, clear any stale prediction state
                                  if (uiMode !== "Prediction") {
                                    setPredResult(null);
                                    setPredError("");
                                    setPredLoading(false);
                                  }
                                  setRole(metaData.conversation.role || ROLES[0]);
                                }
                                const res = await fetch(`${API_BASE}/api/chat/${c.id}/messages`, {
                                  credentials: "include",
                                });
                                const data = res.ok ? await res.json() : [];
                                const msgs = Array.isArray(data) ? data : [];
                                setMessages(msgs);
                                const locked = !!predLockedChats[c.id] || msgs.length > 0;
                                setModeLocked(locked);
                              } catch {
                                setMessages([]);
                                setModeLocked(!!predLockedChats[c.id]);
                              }
                            }}
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
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{c.title}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const next = window.prompt("Rename chat", c.title);
                                    if (!next) return;
                                    try {
                                      const res = await fetch(`${API_BASE}/api/chat/${c.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        credentials: "include",
                                        body: JSON.stringify({ title: next }),
                                      });
                                      const data = await res.json();
                                      if (res.ok && data?.success) {
                                        setConversations((prev) =>
                                          prev.map((x) => (x.id === c.id ? { ...x, title: data.conversation.title } : x))
                                        );
                                      }
                                    } catch {}
                                  }}
                                  className="p-1 rounded hover:bg-[#06B6D4]/10"
                                  title="Rename"
                                  aria-label="Rename chat"
                                >
                                  <Pencil className="size-3.5 text-slate-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!window.confirm("Delete this chat?")) return;
                                    try {
                                      const res = await fetch(`${API_BASE}/api/chat/${c.id}`, {
                                        method: "DELETE",
                                        credentials: "include",
                                      });
                                      const data = await res.json();
                                      if (res.ok && data?.success) {
                                        setConversations((prev) => prev.filter((x) => x.id !== c.id));
                                        // remove any prediction lock tracking for this chat
                                        setPredLockedChats((prev) => {
                                          const copy = { ...prev };
                                          delete copy[c.id];
                                          return copy;
                                        });
                                        if (activeId === c.id) {
                                          setActiveId(null);
                                          setMessages([]);
                                          setModeLocked(false);
                                        }
                                      }
                                    } catch {}
                                  }}
                                  className="p-1 rounded hover:bg-red-50"
                                  title="Delete"
                                  aria-label="Delete chat"
                                >
                                  <Trash2 className="size-3.5 text-red-500" />
                                </button>
                              </div>
                            </div>
                          </motion.button>
                        ) : (
                          <motion.button
                            onClick={async () => {
                              setActiveId(c.id);
                              setMessages([]);
                              // Immediately clear any stale prediction UI until we resolve the chat's actual mode
                              setPredResult(null);
                              setPredError("");
                              setPredLoading(false);
                              try {
                                // Sync UI from chat meta
                                const metaRes = await fetch(`${API_BASE}/api/chat/${c.id}`, {
                                  credentials: "include",
                                });
                                const metaData = metaRes.ok ? await metaRes.json() : null;
                                if (metaData?.success && metaData.conversation) {
                                  const uiMode = metaData.conversation.mode === "Default" ? "Chat" : metaData.conversation.mode;
                                  setSelectedMode(uiMode);
                                  // When switching to a non-Prediction chat, clear any stale prediction state
                                  if (uiMode !== "Prediction") {
                                    setPredResult(null);
                                    setPredError("");
                                    setPredLoading(false);
                                  }
                                  setRole(metaData.conversation.role || ROLES[0]);
                                }
                                const res = await fetch(`${API_BASE}/api/chat/${c.id}/messages`, {
                                  credentials: "include",
                                });
                                const data = res.ok ? await res.json() : [];
                                const msgs = Array.isArray(data) ? data : [];
                                setMessages(msgs);
                                const locked = !!predLockedChats[c.id] || msgs.length > 0;
                                setModeLocked(locked);
                              } catch {
                                setMessages([]);
                                setModeLocked(!!predLockedChats[c.id]);
                              }
                            }}
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
        {/* Mode tabs centered at top */}
        <div className="h-14 flex items-center justify-center px-4">
          {!modeLocked && !predLoading && !(selectedMode === "GeoMap" && geoPendingCoords) && (
            <ModeTabs
              selected={selectedMode}
              onSelect={requestModeChange}
              disabled={false}
            />
          )}
        </div>

        {/* Messages area or Center greeting */}
        <div className="relative h-[calc(100%-56px)]">
          {selectedMode === "Prediction" ? (
            <PredictionPanel
              predVar={predVar}
              setPredVar={setPredVar}
              predHorizonNum={predHorizonNum}
              setPredHorizonNum={setPredHorizonNum}
              predHorizonUnit={predHorizonUnit}
              setPredHorizonUnit={setPredHorizonUnit}
              predSinceDays={predSinceDays}
              setPredSinceDays={setPredSinceDays}
              predReturnHistory={predReturnHistory}
              setPredReturnHistory={setPredReturnHistory}
              predHistoryDays={predHistoryDays}
              setPredHistoryDays={setPredHistoryDays}
              predLoading={predLoading}
              predError={predError}
              predResult={predResult}
              onRun={handleRunPrediction}
            />
          ) : !showGreeting ? (
            <div className="absolute inset-0 overflow-auto px-4 py-6">
              <MessageList messages={messages} isStreaming={sending} />
            </div>
          ) : selectedMode === "GeoMap" && !modeLocked && !geoPendingCoords ? (
            <GeoMapPicker
              onConfirm={(coords) => {
                setGeoPendingCoords(coords);
              }}
            />
          ) : selectedMode === "GeoMap" && !modeLocked && geoPendingCoords ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col items-center overflow-auto px-4 py-6"
            >
              <div className="w-full max-w-3xl bg-white/90 border border-[#06B6D4]/30 backdrop-blur-xl rounded-2xl p-4 shadow">
                <div className="text-sm font-semibold text-slate-700 mb-2">Selected region (5 points)</div>
                <ul className="text-sm text-slate-700 space-y-1">
                  {geoPendingCoords.map(([lat, lng], i) => (
                    <li key={i}>
                      P{i + 1}: {lat.toFixed(4)}, {lng.toFixed(4)}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-sm text-slate-600">
                  Add your query below. This message will include the region plus your query.
                </div>
              </div>
            </motion.div>
          ) : (
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
          )}

          {/* Bottom input bar with Role dropdown on the left */}
          {selectedMode !== "Prediction" && !(selectedMode === "GeoMap" && showGreeting && !modeLocked && !geoPendingCoords) && (
            <form onSubmit={handleSend} className="absolute left-0 right-0 bottom-4 flex justify-center px-4">
              <motion.div
                className={cn(
                  "w-full max-w-3xl",
                  "bg-white/90 border border-[#06B6D4]/30",
                  "rounded-full shadow-xl backdrop-blur-xl",
                  "flex items-center gap-2 px-2 py-2"
                )}
                style={{ boxShadow: "0 10px 30px rgba(6,182,212,0.15)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 22 }}
              >
                {/* Role dropdown placed at left side of input bar */}
                {modeLocked ? (
                  // spacer to keep text from hugging left edge once role selector disappears
                  <div className="w-28 sm:w-32" aria-hidden="true" />
                ) : (
                  <RoleDropdown role={role} setRole={setRole} />
                )}

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
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Components ---------- */

function SidebarModeItem({ open, icon: Icon, label, active, disabled, onClick }) {
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

function ModeTabs({ selected, onSelect, disabled }) {
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

function RoleDropdown({ role, setRole }) {
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

/* Renders chat messages with smooth entrance and auto-scroll to latest */
function MessageList({ messages, isStreaming }) {
  const listRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // find last assistant index for streaming caret
  const lastAssistantIndex = (() => {
    let idx = -1;
    for (let i = 0; i < (messages?.length || 0); i++) {
      if (messages[i]?.role === "assistant") idx = i;
    }
    return idx;
  })();

  return (
    <div ref={listRef} className="w-full h-full">
      <div className="max-w-3xl mx-auto">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isLastAssistant = idx === lastAssistantIndex;
          return (
            <motion.div
              key={m.id || m._id || idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "flex w-full px-1 sm:px-2 py-1.5",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-2 rounded-2xl shadow-sm",
                  isUser
                    ? "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white"
                    : "bg-white/95 border border-[#06B6D4]/20 text-slate-800"
                )}
                style={{ maxWidth: "85%" }}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {m.content || ""}
                  {isLastAssistant && isStreaming && (
                    <span className="inline-block w-[6px] h-[1em] bg-slate-400/80 ml-1 align-[-0.15em] animate-pulse rounded-sm" />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* GeoMap polygon picker for Indian Ocean */
function GeoMapPicker({ onConfirm }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef({ markers: [], line: null, polygon: null });
  const [points, setPoints] = useState([]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      });

      // Fit to Indian Ocean approx bounds: lat -60..30, lon 20..120
      const bounds = L.latLngBounds(L.latLng(-60, 20), L.latLng(30, 120));
      map.fitBounds(bounds, { padding: [20, 20] });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 7,
      }).addTo(map);

      // Ocean overlays (light borders, distinct colors)
      const oceans = [
        {
          name: "Indian Ocean",
          color: "#06B6D4",
          fill: "#06B6D4",
          polygons: [
            [
              [-60, 20],
              [-60, 120],
              [30, 120],
              [30, 20],
            ],
          ],
          label: { lat: -15, lng: 80 },
        },
        {
          name: "Pacific Ocean",
          color: "#F59E0B",
          fill: "#F59E0B",
          // Split across antimeridian as two rectangles
          polygons: [
            [
              [-60, 120],
              [-60, 180],
              [60, 180],
              [60, 120],
            ],
            [
              [-60, -180],
              [-60, -70],
              [60, -70],
              [60, -180],
            ],
          ],
          label: { lat: -5, lng: -140 },
        },
        {
          name: "Atlantic Ocean",
          color: "#8B5CF6",
          fill: "#8B5CF6",
          polygons: [
            [
              [-60, -70],
              [-60, 20],
              [70, 20],
              [70, -70],
            ],
          ],
          label: { lat: 0, lng: -20 },
        },
      ];

      oceans.forEach((o) => {
        // Draw polygons
        o.polygons.forEach((coords) => {
          L.polygon(coords, {
            color: o.color,
            weight: 1,
            opacity: 0.8,
            fillColor: o.fill,
            fillOpacity: 0.08,
            interactive: false,
            smoothFactor: 1,
            dashArray: "4 4",
          }).addTo(map);
        });
        // Add label
        const labelHtml = `<div style="font-size:12px;font-weight:600;color:#0f172a;background:rgba(255,255,255,0.85);border:1px solid rgba(6,182,212,0.25);padding:2px 6px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">${o.name}</div>`;
        L.marker([o.label.lat, o.label.lng], {
          interactive: false,
          icon: L.divIcon({ className: "", html: labelHtml }),
        }).addTo(map);
      });

      map.on("click", (e) => {
        setPoints((prev) => {
          if (prev.length >= 5) return prev;
          const next = [...prev, [e.latlng.lat, e.latlng.lng]];
          return next;
        });
      });

      mapRef.current = map;
    }
  }, []);

  // draw points and shapes when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { markers, line, polygon } = layerRef.current;

    // clear existing markers/line/polygon
    markers.forEach((m) => m.remove());
    layerRef.current.markers = [];

    if (line) {
      line.remove();
      layerRef.current.line = null;
    }
    if (polygon) {
      polygon.remove();
      layerRef.current.polygon = null;
    }

    // redraw markers
    points.forEach(([lat, lng], idx) => {
      const m = L.circleMarker([lat, lng], {
        radius: 6,
        color: "#0284C7",
        fillColor: "#0EA5E9",
        fillOpacity: 0.9,
        weight: 2,
      }).bindTooltip(`P${idx + 1}`, { permanent: true, direction: "top", offset: [0, -6] });
      m.addTo(map);
      layerRef.current.markers.push(m);
    });

    // draw line or polygon
    if (points.length >= 2 && points.length < 5) {
      layerRef.current.line = L.polyline(points, { color: "#06B6D4", weight: 2 }).addTo(map);
    } else if (points.length === 5) {
      layerRef.current.polygon = L.polygon(points, {
        color: "#06B6D4",
        weight: 2,
        fillOpacity: 0.15,
        fillColor: "#06B6D4",
      }).addTo(map);
    }
  }, [points]);

  const reset = () => setPoints([]);

  const handleConfirm = async () => {
    if (points.length !== 5) return;
    await onConfirm(points);
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Overlay UI */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] bg-white/90 backdrop-blur-xl border border-[#06B6D4]/30 rounded-full px-4 py-2 shadow">
        <div className="text-sm text-slate-700">
          {points.length < 5 ? `Select ${5 - points.length} more point${5 - points.length === 1 ? "" : "s"} in the Indian Ocean` : "Polygon ready"}
        </div>
      </div>
      {/* Ocean legend */}
      <div className="absolute top-4 left-4 z-[9999]">
        <div className="bg-white/90 backdrop-blur-xl border border-[#06B6D4]/30 rounded-xl px-3 py-2 shadow">
          <div className="text-xs font-semibold text-slate-700 mb-1">Oceans</div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#06B6D4' }} />
              <span className="text-slate-700">Indian Ocean</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#F59E0B' }} />
              <span className="text-slate-700">Pacific Ocean</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#8B5CF6' }} />
              <span className="text-slate-700">Atlantic Ocean</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2">
        <Button
          type="button"
          onClick={reset}
          variant="outline"
          className="rounded-full bg-white/90 hover:bg-white"
        >
          Reset
        </Button>
        {points.length === 5 && (
          <Button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "rounded-full px-4",
              "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white"
            )}
          >
            Confirm
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Prediction Panel + Mini Chart ---------- */
function PredictionPanel({
  predVar,
  setPredVar,
  predHorizonNum,
  setPredHorizonNum,
  predHorizonUnit,
  setPredHorizonUnit,
  predSinceDays,
  setPredSinceDays,
  predReturnHistory,
  setPredReturnHistory,
  predHistoryDays,
  setPredHistoryDays,
  predLoading,
  predError,
  predResult,
  onRun,
}) {
  const VARS = [
    { key: "temperature", label: "Temperature (\u00B0C)", unit: "\u00B0C" },
    { key: "salinity", label: "Salinity (PSU)", unit: "PSU" },
    { key: "pressure", label: "Pressure (dbar)", unit: "dbar" },
  ];
  const UNITS = ["days", "weeks", "months", "years"];
  const selectedVar = VARS.find((v) => v.key === predVar) || VARS[0];

  const unit = selectedVar.unit;

  const hasData =
    Array.isArray(predResult?.predictions) && predResult.predictions.length > 0;

  const historyData =
    predResult?.input?.returnHistory && Array.isArray(predResult?.history)
      ? predResult.history
      : [];

  const predictionsData = Array.isArray(predResult?.predictions)
    ? predResult.predictions
    : [];

  const meta = predResult?.meta || {};

  const runDisabled = predLoading || !predVar || !predHorizonNum || !predHorizonUnit;

  const resetLocal = () => {
    setPredHistoryDays(30);
    setPredReturnHistory(true);
    setPredSinceDays(720);
  };

  const downloadCSV = (rows, headers, filename) => {
    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => r[h]).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute inset-0 overflow-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-5xl mx-auto space-y-4"
      >
        {/* Controls */}
        <div className="bg-white/90 border border-[#06B6D4]/30 backdrop-blur-xl rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Variable */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Variable</div>
                <select
                  value={predVar}
                  onChange={(e) => setPredVar(e.target.value)}
                  className={cn(
                    "text-sm rounded-full border border-[#06B6D4]/30 bg-white/70",
                    "px-3 py-1.5 text-slate-700 hover:bg-white outline-none"
                  )}
                >
                  {VARS.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Horizon */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Horizon</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={predHorizonNum}
                    onChange={(e) =>
                      setPredHorizonNum(Math.max(1, Number(e.target.value || 1)))
                    }
                    className={cn(
                      "w-20 text-sm rounded-full border border-[#06B6D4]/30",
                      "bg-white/70 px-3 py-1.5 text-slate-700 outline-none"
                    )}
                  />
                  <select
                    value={predHorizonUnit}
                    onChange={(e) => setPredHorizonUnit(e.target.value)}
                    className={cn(
                      "text-sm rounded-full border border-[#06B6D4]/30 bg-white/70",
                      "px-3 py-1.5 text-slate-700 hover:bg-white outline-none"
                    )}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* History window */}
              <div>
                <div className="text-xs text-slate-500 mb-1">History window (days)</div>
                <input
                  type="number"
                  min={30}
                  step={30}
                  value={predSinceDays}
                  onChange={(e) =>
                    setPredSinceDays(Math.max(1, Number(e.target.value || 30)))
                  }
                  className={cn(
                    "w-28 text-sm rounded-full border border-[#06B6D4]/30",
                    "bg-white/70 px-3 py-1.5 text-slate-700 outline-none"
                  )}
                  title="Days of historical data used to fit the model"
                />
              </div>

              {/* Include History */}
              <div className="flex items-center gap-2 mt-5 sm:mt-0">
                <input
                  id="returnHistory"
                  type="checkbox"
                  checked={predReturnHistory}
                  onChange={(e) => setPredReturnHistory(e.target.checked)}
                  className="size-4 accent-[#06B6D4]"
                />
                <label htmlFor="returnHistory" className="text-sm text-slate-700">
                  Include history
                </label>
              </div>

              {/* History days to return */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Return last (days)</div>
                <input
                  type="number"
                  min={1}
                  value={predHistoryDays}
                  onChange={(e) =>
                    setPredHistoryDays(Math.max(1, Number(e.target.value || 1)))
                  }
                  disabled={!predReturnHistory}
                  className={cn(
                    "w-24 text-sm rounded-full border border-[#06B6D4]/30",
                    "px-3 py-1.5",
                    predReturnHistory
                      ? "bg-white/70 text-slate-700"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    "outline-none"
                  )}
                  title="Days of historical series to include in response"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={resetLocal}
                variant="outline"
                className="rounded-full bg-white/90 hover:bg-white"
                disabled={predLoading}
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={onRun}
                disabled={runDisabled}
                className={cn(
                  "rounded-full px-4",
                  "bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white",
                  predLoading && "opacity-80"
                )}
              >
                {predLoading ? "Running..." : "Run Prediction"}
              </Button>
            </div>
          </div>

          {predError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {predError}
            </div>
          ) : null}
        </div>

        {/* Output */}
        <div className="bg-white/90 border border-[#06B6D4]/30 backdrop-blur-xl rounded-2xl p-4 shadow">
          {!hasData ? (
            <div className="text-center text-slate-600 py-10">
              Configure inputs and click “Run Prediction” to see results.
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryTile
                  label="Variable"
                  value={selectedVar.label}
                  subtitle={`Unit: ${unit}`}
                />
                <SummaryTile
                  label="Horizon"
                  value={`${predResult?.input?.horizonDays ?? "-"} days`}
                  subtitle={predResult?.input?.horizon}
                />
                <SummaryTile
                  label="History Window"
                  value={`${predResult?.input?.sinceDays ?? "-"} days`}
                  subtitle={
                    predResult?.input?.returnHistory
                      ? `Returning last ${predResult?.input?.historyDays} days`
                      : "Not included"
                  }
                />
                <SummaryTile
                  label="Rows Used"
                  value={meta?.rowsFetched ?? "-"}
                  subtitle="Interpolated daily"
                />
              </div>

              {/* Chart */}
              <div className="mt-4 rounded-xl border border-[#06B6D4]/20 bg-white/80 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-800">History & Prediction</div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <span className="inline-block w-3 h-[2px] bg-[#06B6D4]" /> History
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <span className="inline-block w-3 h-[2px] bg-[#0EA5E9] border-b border-[#0EA5E9] border-dashed" /> Prediction
                    </span>
                  </div>
                </div>
                <LineChartPrediction
                  unit={unit}
                  history={historyData}
                  predictions={predictionsData}
                  height={280}
                />
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                {historyData.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full bg-white/90 hover:bg-white"
                    onClick={() =>
                      downloadCSV(
                        historyData.map((h) => ({ date: h.date, value: h.value })),
                        ["date", "value"],
                        "history.csv"
                      )
                    }
                  >
                    Download History CSV
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full bg-white/90 hover:bg-white"
                  onClick={() =>
                    downloadCSV(
                      predictionsData.map((p) => ({
                        date: p.date,
                        predicted: p.pred,
                      })),
                      ["date", "predicted"],
                      "predictions.csv"
                    )
                  }
                >
                  Download Predictions CSV
                </Button>
              </div>

              {/* Tables */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#06B6D4]/20 bg-white/80">
                  <div className="px-3 py-2 text-sm font-medium text-slate-800">
                    Predictions ({predictionsData.length})
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white/90">
                        <tr className="text-slate-600">
                          <th className="text-left px-3 py-2 font-semibold border-b border-slate-200">Date</th>
                          <th className="text-right px-3 py-2 font-semibold border-b border-slate-200">
                            Predicted ({unit})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionsData.map((p, i) => (
                          <tr key={i} className="text-slate-800">
                            <td className="px-3 py-1.5 border-b border-slate-100">{p.date}</td>
                            <td className="px-3 py-1.5 border-b border-slate-100 text-right">
                              {typeof p.pred === "number" ? p.pred.toFixed(3) : p.pred}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-[#06B6D4]/20 bg-white/80">
                  <div className="px-3 py-2 text-sm font-medium text-slate-800">
                    History ({historyData.length})
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white/90">
                        <tr className="text-slate-600">
                          <th className="text-left px-3 py-2 font-semibold border-b border-slate-200">Date</th>
                          <th className="text-right px-3 py-2 font-semibold border-b border-slate-200">
                            Value ({unit})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((h, i) => (
                          <tr key={i} className="text-slate-800">
                            <td className="px-3 py-1.5 border-b border-slate-100">{h.date}</td>
                            <td className="px-3 py-1.5 border-b border-slate-100 text-right">
                              {typeof h.value === "number" ? h.value.toFixed(3) : h.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SummaryTile({ label, value, subtitle }) {
  return (
    <div className="rounded-xl border border-[#06B6D4]/20 bg-white/80 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
      {subtitle ? <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div> : null}
    </div>
  );
}

function LineChartPrediction({ history, predictions, height = 280, unit }) {
  // Parse to Date objects
  const parse = (d) => new Date(d);
  const h = Array.isArray(history) ? history.map((x) => ({ x: parse(x.date), y: Number(x.value) })) : [];
  const p = Array.isArray(predictions) ? predictions.map((x) => ({ x: parse(x.date), y: Number(x.pred) })) : [];

  const all = [...h, ...p];
  if (all.length === 0) {
    return <div className="text-center text-slate-500 py-10 text-sm">No data to plot</div>;
  }

  const xMin = new Date(Math.min(...all.map((d) => d.x.getTime())));
  const xMax = new Date(Math.max(...all.map((d) => d.x.getTime())));
  const yVals = all.map((d) => d.y).filter((v) => Number.isFinite(v));
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const y0 = yMin - yPad;
  const y1 = yMax + yPad;

  const W = 800;
  const H = height;
  const PAD_L = 48;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 36;

  const xScale = (d) =>
    PAD_L + ((d.getTime() - xMin.getTime()) / (xMax.getTime() - xMin.getTime() || 1)) * (W - PAD_L - PAD_R);
  const yScale = (v) => PAD_T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - PAD_T - PAD_B);

  const toPath = (arr) => {
    if (!arr.length) return "";
    return arr
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${xScale(pt.x).toFixed(2)} ${yScale(pt.y).toFixed(2)}`)
      .join(" ");
  };

  // X ticks
  const xTickCount = 5;
  const ms = xMax.getTime() - xMin.getTime();
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => new Date(xMin.getTime() + (ms * i) / xTickCount));
  const fmtDate = (d) =>
    `${String(d.getFullYear()).slice(2)}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Y ticks (nice) and formatting to up to 3 decimals
  const niceStep = (span, count) => {
    const raw = span / Math.max(1, count);
    const power = Math.floor(Math.log10(Math.max(1e-12, raw)));
    const base = Math.pow(10, power);
    const mult = raw / base;
    let step;
    if (mult <= 1) step = 1;
    else if (mult <= 2) step = 2;
    else if (mult <= 5) step = 5;
    else step = 10;
    return step * base;
  };
  const genYTicks = (min, max, count) => {
    const span = Math.max(1e-12, max - min);
    const step = niceStep(span, count);
    const start = Math.ceil(min / step) * step;
    const end = Math.floor(max / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step * 0.5; v += step) ticks.push(v);
    if (ticks.length === 0) ticks.push(min, max);
    return ticks;
  };
  const yTicks = genYTicks(y0, y1, 5);
  const fmtVal = (v) => {
    if (!Number.isFinite(v)) return String(v);
    return v.toFixed(3).replace(/\.?0+$/, "");
  };

  // Reference today line if in range
  const today = new Date();
  const showToday = today >= xMin && today <= xMax;
  const todayX = xScale(today);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Background gridlines (X) */}
        {xTicks.map((t, i) => {
          const x = xScale(t);
          return <line key={`xg-${i}`} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        {/* Background gridlines (Y) */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return <line key={`yg-${i}`} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
        })}

        {/* Axes */}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth="1" />

        {/* X ticks + labels */}
        {xTicks.map((t, i) => {
          const x = xScale(t);
          return (
            <g key={`xt-${i}`}>
              <line x1={x} y1={H - PAD_B} x2={x} y2={H - PAD_B + 4} stroke="#94a3b8" />
              <text x={x} y={H - PAD_B + 16} fontSize="10" textAnchor="middle" fill="#475569">
                {fmtDate(t)}
              </text>
            </g>
          );
        })}

        {/* Y ticks + labels (up to 3 decimals) */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={`yt-${i}`}>
              <line x1={PAD_L - 4} y1={y} x2={PAD_L} y2={y} stroke="#94a3b8" />
              <text x={PAD_L - 8} y={y + 3} fontSize="10" textAnchor="end" fill="#475569">
                {fmtVal(v)}
              </text>
            </g>
          );
        })}

        {/* Today line */}
        {showToday ? (
          <g>
            <line x1={todayX} y1={PAD_T} x2={todayX} y2={H - PAD_B} stroke="#94a3b8" strokeDasharray="3 3" />
            <text x={todayX + 4} y={PAD_T + 12} fontSize="10" fill="#475569">
              Today
            </text>
          </g>
        ) : null}

        {/* Paths */}
        {/* History */}
        <path d={toPath(h)} fill="none" stroke="#06B6D4" strokeWidth="2" />
        {/* Predictions */}
        <path d={toPath(p)} fill="none" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="6 4" />

        {/* Point markers and value labels (up to 3 decimals) */}
        {h.map((pt, i) => {
          const cx = xScale(pt.x);
          const cy = yScale(pt.y);
          return (
            <g key={`hp-${i}`}>
              <circle cx={cx} cy={cy} r="2.5" fill="#06B6D4" stroke="#0284C7" strokeWidth="1" />
              <text x={cx} y={cy - 6} fontSize="9" textAnchor="middle" fill="#0f172a">
                {fmtVal(pt.y)}
              </text>
            </g>
          );
        })}
        {p.map((pt, i) => {
          const cx = xScale(pt.x);
          const cy = yScale(pt.y);
          return (
            <g key={`pp-${i}`}>
              <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" stroke="#0EA5E9" strokeWidth="1.5" />
              <text x={cx} y={cy - 6} fontSize="9" textAnchor="middle" fill="#0f172a">
                {fmtVal(pt.y)}
              </text>
            </g>
          );
        })}

        {/* Y axis unit label */}
        <text
          x={PAD_L - 36}
          y={(H - PAD_B + PAD_T) / 2}
          fontSize="10"
          fill="#475569"
          transform={`rotate(-90 ${PAD_L - 36}, ${(H - PAD_B + PAD_T) / 2})`}
          textAnchor="middle"
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}
