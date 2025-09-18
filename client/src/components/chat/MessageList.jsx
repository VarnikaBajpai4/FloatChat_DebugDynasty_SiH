import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/constants";

/* Renders chat messages with smooth entrance and auto-scroll to latest */
export default function MessageList({ messages, isStreaming, bottomPad = 160 }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    // Auto-scroll the nearest scrollable ancestor by bringing the sentinel into view
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  // find last assistant index for streaming caret
  const lastAssistantIndex = (() => {
    let idx = -1;
    for (let i = 0; i < (messages?.length || 0); i++) {
      if (messages[i]?.role === "assistant") idx = i;
    }
    return idx;
  })();

  // whether to show the "Thinking..." indicator (before tokens arrive)
  const showThinking = (() => {
    if (!isStreaming) return false;
    if (lastAssistantIndex < 0) return true;
    const lastAssistant = messages[lastAssistantIndex];
    const content = (lastAssistant?.content || "").trim();
    return content.length === 0;
  })();

  // Inline ThinkingIndicator (click to expand "sub-steps")
  function ThinkingIndicator() {
    const [open, setOpen] = useState(false);
    const steps = [
      "Understanding your query",
      "Routing to MCP/Tools",
      "Calling LLM",
      "Building SQL query",
      "Aggregating results",
      "Generating summary & QC",
    ];
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex w-full px-1 sm:px-2 py-1.5 justify-start"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left px-4 py-2 rounded-2xl bg-white/95 border border-[#06B6D4]/30 shadow-sm text-slate-800 hover:bg-white w-[85%]"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#0EA5E9] animate-pulse" />
            <span className="font-medium">Thinking…</span>
            <span className="ml-2 inline-flex">
              <span
                className="w-1.5 h-1.5 bg-[#06B6D4] rounded-full mr-1 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-[#06B6D4] rounded-full mr-1 animate-bounce"
                style={{ animationDelay: "100ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-[#06B6D4] rounded-full animate-bounce"
                style={{ animationDelay: "200ms" }}
              />
            </span>
            <ChevronDown
              className={cn(
                "size-4 ml-auto transition-transform",
                open ? "rotate-180" : ""
              )}
            />
          </div>
          <AnimatePresence>
            {open && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 pl-1 text-sm text-slate-600 space-y-1 overflow-hidden"
              >
                {steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
                    <span>{s}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </button>
      </motion.div>
    );
  }

  const renderMeta = (m) => {
    const qc = typeof m?.metadata?.qc === "number" ? m.metadata.qc : null;

    const normalizeLink = (u) => {
      if (!u) return null;
      let s = Array.isArray(u) ? u[0] : u;
      if (typeof s !== "string") return null;
      if (/^https?:\/\//i.test(s)) return s;
      if (s.startsWith("/")) {
        const base = API_BASE || window.location.origin;
        return base + s;
      }
      try {
        return new URL(s, API_BASE || window.location.origin).toString();
      } catch {
        return null;
      }
    };
    const extractLinkFromContent = (txt) => {
      if (!txt || typeof txt !== "string") return null;
      const http = txt.match(/https?:\/\/[^\s)]+/i);
      if (http) return http[0];
      const rel = txt.match(/(^|[\s(])(\/[A-Za-z0-9\-._~%/?#@!$&'()*+,;=]+)/);
      if (rel) return (rel[2] || rel[1] || "").trim();
      return null;
    };

    const rawCandidate =
      m?.metadata?.link ??
      m?.link ??
      m?.visualization_url ??
      m?.metadata?.visualization_url ??
      extractLinkFromContent(m?.content) ??
      null;

    let linkStr = normalizeLink(rawCandidate);
    const showLink = !!linkStr;

    // QC shows whenever available; link shows whenever available
    const showQC = typeof qc === "number";

    if (!showQC && !showLink) return null;

    return (
      <div className="mt-2 flex items-center gap-3 text-sm">
        {showQC && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#06B6D4]/15 text-[#0EA5E9] border border-[#06B6D4]/30 font-medium">
            QC: {qc}
          </span>
        )}
        {showLink && (
          <a
            href={linkStr}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#06B6D4]/15 text-[#0EA5E9] border border-[#06B6D4]/30 hover:bg-[#06B6D4]/25 font-medium"
          >
            Open link
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-full">
      <div className="max-w-3xl mx-auto">
        {isStreaming && lastAssistantIndex < 0 && <ThinkingIndicator />}
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isLastAssistant = idx === lastAssistantIndex;
          const assistantEmpty = !isUser && ((m.content || "").trim().length === 0);

          return (
            <React.Fragment key={m.id || m._id || idx}>
              {/* Beautiful 'thinking' indicator before assistant bubble while waiting */}
              {!isUser && isLastAssistant && showThinking && assistantEmpty && <ThinkingIndicator />}

              <motion.div
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
                  {/* Assistant metadata footer: QC + clickable link */}
                  {!isUser && renderMeta(m)}
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} style={{ height: bottomPad }} />
      </div>
    </div>
  );
}