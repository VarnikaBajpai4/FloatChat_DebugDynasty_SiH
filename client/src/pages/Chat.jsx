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

  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  // GeoMap: hold a confirmed polygon before first send
  const [geoPendingCoords, setGeoPendingCoords] = useState(null);

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
      const serverMode = selectedMode === "Chat" ? "Default" : selectedMode;
      const res = await fetch(`${API_BASE}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: selectedMode === "GeoMap" ? "Default" : role,
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
        const uiMode = convo.mode === "Default" ? "Chat" : convo.mode;
        setSelectedMode(uiMode);
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

  const suggestions = [
    "Nearest floats to 12.9N, 74.8E",
    "Plot salinity in Mar 2023",
    "Compare BGC in Arabian Sea (6m)",
  ];

  // Handlers for mode switch from top or left
  const requestModeChange = (mode) => {
    if (modeLocked) return; // ignore if locked
    setSelectedMode(mode);
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
              disabled={modeLocked || (selectedMode === "GeoMap" && geoPendingCoords)}
              onClick={() => requestModeChange("Chat")}
            />
            <SidebarModeItem
              open={sidebarOpen}
              icon={Compass}
              label="GeoMap"
              active={selectedMode === "GeoMap"}
              disabled={modeLocked || (selectedMode === "GeoMap" && geoPendingCoords)}
              onClick={() => requestModeChange("GeoMap")}
            />
            <SidebarModeItem
              open={sidebarOpen}
              icon={LineChart}
              label="Prediction"
              active={selectedMode === "Prediction"}
              disabled={modeLocked || (selectedMode === "GeoMap" && geoPendingCoords)}
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
                              setModeLocked(false);
                              try {
                                // Sync UI from chat meta
                                const metaRes = await fetch(`${API_BASE}/api/chat/${c.id}`, {
                                  credentials: "include",
                                });
                                const metaData = metaRes.ok ? await metaRes.json() : null;
                                if (metaData?.success && metaData.conversation) {
                                  const uiMode = metaData.conversation.mode === "Default" ? "Chat" : metaData.conversation.mode;
                                  setSelectedMode(uiMode);
                                  setRole(metaData.conversation.role || ROLES[0]);
                                }
                                const res = await fetch(`${API_BASE}/api/chat/${c.id}/messages`, {
                                  credentials: "include",
                                });
                                const data = res.ok ? await res.json() : [];
                                setMessages(Array.isArray(data) ? data : []);
                                setModeLocked((Array.isArray(data) ? data : []).length > 0);
                              } catch {
                                setMessages([]);
                                setModeLocked(false);
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
                              setModeLocked(false);
                              try {
                                // Sync UI from chat meta
                                const metaRes = await fetch(`${API_BASE}/api/chat/${c.id}`, {
                                  credentials: "include",
                                });
                                const metaData = metaRes.ok ? await metaRes.json() : null;
                                if (metaData?.success && metaData.conversation) {
                                  const uiMode = metaData.conversation.mode === "Default" ? "Chat" : metaData.conversation.mode;
                                  setSelectedMode(uiMode);
                                  setRole(metaData.conversation.role || ROLES[0]);
                                }
                                const res = await fetch(`${API_BASE}/api/chat/${c.id}/messages`, {
                                  credentials: "include",
                                });
                                const data = res.ok ? await res.json() : [];
                                setMessages(Array.isArray(data) ? data : []);
                                setModeLocked((Array.isArray(data) ? data : []).length > 0);
                              } catch {
                                setMessages([]);
                                setModeLocked(false);
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
          {!modeLocked && !(selectedMode === "GeoMap" && geoPendingCoords) && (
            <ModeTabs
              selected={selectedMode}
              onSelect={requestModeChange}
              disabled={false}
            />
          )}
        </div>

        {/* Messages area or Center greeting */}
        <div className="relative h-[calc(100%-56px)]">
          {!showGreeting ? (
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
          {!(selectedMode === "GeoMap" && showGreeting && !modeLocked && !geoPendingCoords) && (
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
