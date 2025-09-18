import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const API_BASE =
  (import.meta.env.MODE === "production" && import.meta.env.VITE_API_DOMAIN)
    ? import.meta.env.VITE_API_DOMAIN
    : "";

const ROLE_ENUM = ["Default", "Student", "Researcher", "Policy-Maker"];
const MODE_ENUM = ["Default", "GeoMap", "Prediction"];

// Helpers to map UI mode label to server enum and back
const uiModeToServer = (ui) => (ui === "Chat" ? "Default" : ui);
const serverModeToUi = (srv) => (srv === "Default" ? "Chat" : srv);

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [activeId, setActiveId] = useState(null);

  // messagesByConv: { [conversationId]: Array<{_id?, id?, role: 'user'|'assistant', content: string, metadata?: { link?: string|null, qc?: number, final?: boolean }}> }
  const [messagesByConv, setMessagesByConv] = useState({});

  // Track an active streaming controller to abort if needed
  const streamAbortRef = useRef(null);
  const [streamingConvId, setStreamingConvId] = useState(null);

  // Track per-conversation prediction lock (prevents mode switching after a prediction run)
  const [predLockedByConv, setPredLockedByConv] = useState({});

  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvos(true);
      const res = await fetch(`${API_BASE}/api/chat`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      if (data?.success) {
        setConversations(data.conversations || []);
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  const getConversationById = useCallback(
    async (conversationId) => {
      const res = await fetch(`${API_BASE}/api/chat/${conversationId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      if (!data?.success) throw new Error("Failed to load conversation");
      return data.conversation;
    },
    []
  );

  const openConversation = useCallback(
    async (conversationId) => {
      // Switch active and fetch messages
      setActiveId(conversationId);
      // If messages already cached, don't refetch immediately
      if (messagesByConv[conversationId]?.length) return;

      try {
        const res = await fetch(`${API_BASE}/api/chat/${conversationId}/messages`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load messages");
        const data = await res.json();

        // Normalize assistant messages so metadata/link/qc are consistently present
        const normMsgs = (Array.isArray(data) ? data : []).map((m) => {
          if (m?.role !== "assistant") return m;
          const qcMerged = (m?.metadata?.qc ?? m?.qc);
          const qcVal = typeof qcMerged === "number" ? qcMerged : null;

          const rawLink =
            m?.metadata?.link ??
            m?.link ??
            m?.visualization_url ??
            m?.metadata?.visualization_url ??
            null;

          return {
            ...m,
            metadata: {
              ...(m?.metadata || {}),
              link: rawLink ?? (m?.metadata?.link ?? null),
              qc: qcVal,
            },
            link: rawLink ?? m?.link ?? m?.visualization_url ?? undefined,
            visualization_url: rawLink ?? m?.visualization_url ?? undefined,
            qc: typeof qcVal === "number" ? qcVal : m?.qc,
          };
        });

        setMessagesByConv((prev) => ({
          ...prev,
          [conversationId]: normMsgs,
        }));
      } catch {
        setMessagesByConv((prev) => ({ ...prev, [conversationId]: [] }));
      }
    },
    [messagesByConv]
  );

  const createConversation = useCallback(
    async ({ title, role, mode }) => {
      // validate enums (fallback to default)
      const safeRole = ROLE_ENUM.includes(role) ? role : "Default";
      const safeMode = MODE_ENUM.includes(mode) ? mode : "Default";

      const res = await fetch(`${API_BASE}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title && title.trim() ? title.trim() : undefined,
          role: safeRole,
          mode: safeMode,
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const data = await res.json();
      const convo = data?.conversation;
      if (convo) {
        setConversations((prev) => [convo, ...prev]);
        setActiveId(convo.id);
        // Initialize message list
        setMessagesByConv((prev) => ({ ...prev, [convo.id]: [] }));
        return convo;
      }
      throw new Error("No conversation returned");
    },
    []
  );

  const renameConversation = useCallback(async (conversationId, title) => {
    const safe = (title || "").trim();
    if (!safe) return;

    const res = await fetch(`${API_BASE}/api/chat/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: safe }),
    });
    if (!res.ok) throw new Error("Failed to rename chat");
    const data = await res.json();
    if (data?.success && data.conversation) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title: data.conversation.title } : c))
      );
    }
  }, []);

  // Patch arbitrary conversation metadata (role/mode/title)
  const updateConversationMeta = useCallback(async (conversationId, patch = {}) => {
    const body = {};
    if (typeof patch.title === "string" && patch.title.trim()) body.title = patch.title.trim();
    if (typeof patch.role === "string") body.role = patch.role;
    if (typeof patch.mode === "string") body.mode = patch.mode;

    if (!Object.keys(body).length) return null;

    const res = await fetch(`${API_BASE}/api/chat/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to update conversation");
    const data = await res.json();
    if (data?.success && data.conversation) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, ...data.conversation } : c))
      );
    }
    return data;
  }, []);

  // Mark conversation as prediction-locked (no UI mode switching thereafter)
  const setPredLocked = useCallback((conversationId, locked) => {
    setPredLockedByConv((prev) => ({ ...prev, [conversationId]: !!locked }));
  }, []);

  const deleteConversation = useCallback(async (conversationId) => {
    // If a stream is in-flight for this conversation, abort it first
    if (activeId === conversationId && streamAbortRef.current) {
      try { streamAbortRef.current.abort(); } catch {}
      streamAbortRef.current = null;
    }

    const res = await fetch(`${API_BASE}/api/chat/${conversationId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete chat");
    const data = await res.json();
    if (data?.success) {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setMessagesByConv((prev) => {
        const copy = { ...prev };
        delete copy[conversationId];
        return copy;
      });
      setPredLockedByConv((prev) => {
        const copy = { ...prev };
        delete copy[conversationId];
        return copy;
      });
      if (activeId === conversationId) {
        setActiveId(null);
      }
    }
  }, [activeId]);

  const sendMessage = useCallback(
    async (conversationId, text, { onAck } = {}) => {
      if (!conversationId) throw new Error("No conversationId");
      const message = (text || "").trim();
      if (!message) return;

      // Cancel any previous in-flight stream for safety
      if (streamAbortRef.current) {
        try { streamAbortRef.current.abort(); } catch {}
      }
      const abortCtrl = new AbortController();
      streamAbortRef.current = abortCtrl;

      const userMsg = {
        id: `local-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      // Optimistically add user + placeholder assistant
      setMessagesByConv((prev) => {
        const existing = prev[conversationId] || [];
        return { ...prev, [conversationId]: [...existing, userMsg, assistantMsg] };
      });

      try {
        const res = await fetch(`${API_BASE}/api/chat/${conversationId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message }),
          signal: abortCtrl.signal,
        });
        if (!res.ok) throw new Error("Failed to send message");

        // Stream decode SSE-like chunks from POST response
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let finalAssistantId = null;

        if (onAck) onAck();

        // Helper to apply partial tokens to the last assistant message
        const appendToAssistant = (chunk) => {
          setMessagesByConv((prev) => {
            const list = prev[conversationId] || [];
            // Find last assistant message
            for (let i = list.length - 1; i >= 0; i--) {
              if (list[i].role === "assistant") {
                const updated = [...list];
                updated[i] = { ...updated[i], content: (updated[i].content || "") + chunk };
                return { ...prev, [conversationId]: updated };
              }
            }
            return prev;
          });
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split Server-Sent Events by double newline
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const raw of events) {
            const lines = raw.split("\n");
            let event = null;
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) {
                event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                // SSE allows multiple data lines; concat with newline
                dataStr += line.slice(5).trim();
              }
            }

            if (event === "ack") {
              // no-op, already optimistic
            } else if (event === "token") {
              try {
                const payload = JSON.parse(dataStr);
                const token = payload?.content ?? "";
                // Server streams by word; re-add space
                appendToAssistant(token + " ");
              } catch {
                // ignore
              }
            } else if (event === "done") {
              try {
                const payload = JSON.parse(dataStr);
                finalAssistantId = payload?.messageId || null;

                // Extract metadata (visualization link + qc) from server payload
                const rawLink = Array.isArray(payload?.link)
                  ? payload.link[0]
                  : (payload?.link || payload?.visualization_url || null);
                const qcVal = typeof payload?.qc === "number" ? payload.qc : null;

                // Update last assistant message with metadata and mark as final
                setMessagesByConv((prev) => {
                  const list = prev[conversationId] || [];
                  for (let i = list.length - 1; i >= 0; i--) {
                    if (list[i].role === "assistant") {
                      const updated = [...list];
                      updated[i] = {
                        ...updated[i],
                        metadata: {
                          ...(updated[i].metadata || {}),
                          link: rawLink || null,
                          qc: qcVal,
                          final: true,
                        },
                        link: rawLink ?? updated[i].link,
                        visualization_url: rawLink ?? updated[i].visualization_url,
                        qc: typeof qcVal === "number" ? qcVal : updated[i].qc,
                      };
                      return { ...prev, [conversationId]: updated };
                    }
                  }
                  return prev;
                });
              } catch {
                // ignore
              }
            } else if (event === "error") {
              // optionally surface error
            }
          }
        }

        // Replace local assistant placeholder id with real id if provided
        if (finalAssistantId) {
          setMessagesByConv((prev) => {
            const list = prev[conversationId] || [];
            const idx = list.findIndex((m) => m.id === assistantMsg.id);
            if (idx !== -1) {
              const updated = [...list];
              updated[idx] = { ...updated[idx], id: finalAssistantId, _id: finalAssistantId };
              return { ...prev, [conversationId]: updated };
            }
            return prev;
          });
        }

        // Refresh sidebar ordering by updatedAt
        fetchConversations().catch(() => {});
      } catch (e) {
        // On failure, mark assistant bubble as error text
        setMessagesByConv((prev) => {
          const list = prev[conversationId] || [];
          const idx = list.findIndex((m) => m.id === assistantMsg.id);
          if (idx !== -1) {
            const updated = [...list];
            updated[idx] = { ...updated[idx], content: "[Error while streaming response]" };
            return { ...prev, [conversationId]: updated };
          }
          return prev;
        });
      } finally {
        if (streamAbortRef.current === abortCtrl) {
          streamAbortRef.current = null;
        }
      }
    },
    [fetchConversations]
  );

  const value = useMemo(
    () => ({
      // state
      conversations,
      loadingConvos,
      activeId,
      messagesByConv,
      predLockedByConv,

      // actions
      setActiveId,
      fetchConversations,
      openConversation,
      createConversation,
      renameConversation,
      updateConversationMeta,
      deleteConversation,
      sendMessage,
      setPredLocked,

      // helpers
      uiModeToServer,
      serverModeToUi,
    }),
    [
      conversations,
      loadingConvos,
      activeId,
      messagesByConv,
      predLockedByConv,
      fetchConversations,
      openConversation,
      createConversation,
      renameConversation,
      updateConversationMeta,
      deleteConversation,
      sendMessage,
      setPredLocked,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}