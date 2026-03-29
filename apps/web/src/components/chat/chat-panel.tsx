"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { X, Plus, History, Send, Loader2, ChevronLeft, ChevronDown, Trash2, Zap } from "lucide-react";
import { chatApi, streamChatMessage, type ChatSession, type ChatSSEEvent } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolUsed?: string;
}

// ── Apex Hire Logo ────────────────────────────────────────────────────────────
// Bold "A" with an upward peak accent — represents summit/apex

function ApexLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 L28 28 H22 L19 21 H13 L10 28 H4 L16 4Z" fill="#eab308" />
      <rect x="11.5" y="18" width="9" height="2.5" rx="1.25" fill="#111827" />
      <path d="M16 2 L18 6 L16 5 L14 6 Z" fill="rgba(234,179,8,0.6)" />
    </svg>
  );
}

// ── Minimal markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let i = 0;

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((l, li) => nodes.push(
        <p key={`p-${nodes.length}-${li}`} style={{ margin: "2px 0", fontSize: 13, lineHeight: 1.6 }}>
          {renderInline(l)}
        </p>
      ));
      tableBuffer = [];
      return;
    }
    const headers = tableBuffer[0].split("|").filter((c) => c.trim());
    const rows = tableBuffer.slice(2).map((r) => r.split("|").filter((c) => c.trim()));
    nodes.push(
      <div key={`table-${nodes.length}`} style={{ overflowX: "auto", margin: "8px 0", borderRadius: 8, border: "1px solid rgba(234,179,8,0.15)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {headers.map((h, hi) => (
                <th key={hi} style={{
                  padding: "8px 12px",
                  background: "rgba(234,179,8,0.12)",
                  textAlign: "left", fontWeight: 600,
                  color: "#fde68a", whiteSpace: "nowrap",
                  borderBottom: "1px solid rgba(234,179,8,0.15)",
                }}>
                  {renderInline(h.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: "7px 12px",
                    color: "rgba(255,255,255,0.8)", fontSize: 12,
                    borderBottom: ri < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|")) { tableBuffer.push(line); i++; continue; }
    else if (tableBuffer.length) flushTable();

    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
      const content = line.replace(/^#+\s/, "");
      nodes.push(<p key={`h-${nodes.length}`} style={{ fontWeight: 700, fontSize: 13, margin: "10px 0 4px", color: "#e2e8f0" }}>{renderInline(content)}</p>);
    } else if (line.match(/^[-*] /)) {
      nodes.push(
        <div key={`li-${nodes.length}`} style={{ display: "flex", gap: 8, margin: "3px 0", paddingLeft: 4 }}>
          <span style={{ color: "#eab308", flexShrink: 0, marginTop: 2, fontSize: 10 }}>▸</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.6 }}>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={`ol-${nodes.length}`} style={{ display: "flex", gap: 8, margin: "3px 0", paddingLeft: 4 }}>
          <span style={{ color: "#eab308", flexShrink: 0, fontSize: 11, minWidth: 18, fontWeight: 600 }}>{num}.</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.6 }}>{renderInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    } else if (!line.trim()) {
      nodes.push(<div key={`sp-${nodes.length}`} style={{ height: 5 }} />);
    } else {
      nodes.push(<p key={`p-${nodes.length}`} style={{ margin: "2px 0", fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>{renderInline(line)}</p>);
    }
    i++;
  }
  if (tableBuffer.length) flushTable();
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (href.startsWith("/candidates/") || href.startsWith("/jobs/")) {
        return (
          <Link key={i} href={href} style={{ color: "#fbbf24", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(165,180,252,0.4)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fde68a")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#fbbf24")}
          >{label}</Link>
        );
      }
      return <a key={i} href={href} style={{ color: "#fbbf24" }}>{label}</a>;
    }
    const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
    if (boldMatch) return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 700 }}>{boldMatch[1]}</strong>;
    const codeMatch = part.match(/^`([^`]+)`$/);
    if (codeMatch) return <code key={i} style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}>{codeMatch[1]}</code>;
    return part;
  });
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: "👥", text: "Show top backend engineers" },
  { icon: "📅", text: "Who applied in the last 7 days?" },
  { icon: "⭐", text: "Candidates with score above 70" },
  { icon: "💼", text: "List all active jobs" },
];

// ── Tool indicator ────────────────────────────────────────────────────────────

function ToolBadge({ tool }: { tool: string }) {
  const labels: Record<string, string> = {
    search_candidates: "Searching candidates",
    filter_pipeline: "Filtering pipeline",
    get_pipeline_summary: "Fetching summary",
    list_jobs: "Listing jobs",
    get_job_details: "Fetching job details",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", marginBottom: 6, width: "fit-content" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308", animation: "pulse 1s infinite" }} />
      <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 500 }}>{labels[tool] ?? tool}</span>
    </div>
  );
}


// ── Main ChatPanel ────────────────────────────────────────────────────────────

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!isMinimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isMinimized]);

  const loadHistory = useCallback(async () => {
    const list = await chatApi.listSessions();
    setSessions(list);
  }, []);

  const openHistory = () => { setView("history"); loadHistory(); };

  const loadSession = async (sid: string) => {
    const s = await chatApi.getSession(sid);
    setSessionId(sid);
    setMessages(s.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    setView("chat");
  };

  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await chatApi.deleteSession(sid);
    setSessions((prev) => prev.filter((s) => s.id !== sid));
  };

  const newConversation = () => {
    setSessionId(undefined);
    setMessages([]);
    setView("chat");
    setActiveTool(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);
    setLoading(true);
    setActiveTool(null);
    abortRef.current = new AbortController();

    try {
      await streamChatMessage(msg, sessionId,
        (event: ChatSSEEvent) => {
          if (event.type === "session" && event.session_id) {
            setSessionId(event.session_id);
          } else if (event.type === "notice" && event.content) {
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: "assistant", content: `_${event.content}_` },
              { role: "assistant", content: "", streaming: true },
            ]);
          } else if (event.type === "tool_call" && event.tool) {
            setActiveTool(event.tool);
          } else if (event.type === "tool_result") {
            setActiveTool(null);
          } else if (event.type === "token" && event.content) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.streaming) return [...prev.slice(0, -1), { ...last, content: last.content + event.content }];
              return prev;
            });
          } else if (event.type === "replace" && event.content) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.streaming) return [...prev.slice(0, -1), { ...last, content: event.content! }];
              return prev;
            });
          }
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
            return prev;
          });
          setLoading(false);
          setActiveTool(null);
        },
        abortRef.current.signal
      );
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.streaming) return [...prev.slice(0, -1), { role: "assistant", content: "Something went wrong. Please try again." }];
          return prev;
        });
      }
      setLoading(false);
      setActiveTool(null);
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setLoading(false);
    setActiveTool(null);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
      return prev;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ── Floating button ───────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open Apex Hire Assistant (⌘K)"
        aria-label="Open Apex Hire Assistant"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 50,
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #111827, #1f2937)",
          border: "2px solid rgba(234,179,8,0.4)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 4px rgba(234,179,8,0.1)",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.6), 0 0 0 6px rgba(234,179,8,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.5), 0 0 0 4px rgba(234,179,8,0.1)";
        }}
      >
        <ApexLogo size={22} />
      </button>
    );
  }


  // ── Panel ─────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-label="Apex Hire Assistant"
      style={{
        position: "fixed",
        bottom: isMinimized ? 0 : 0,
        right: 0,
        top: isMinimized ? "auto" : 0,
        zIndex: 50,
        width: 400,
        height: isMinimized ? "auto" : "100vh",
        background: "#0d1117",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        boxShadow: "-12px 0 48px rgba(0,0,0,0.5)",
        transition: "height 0.2s ease",
      }}
    >
      {/* Header */}
      <div style={{
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
        background: "linear-gradient(135deg, rgba(17,24,39,0.95), rgba(31,41,55,0.8))",
        borderBottom: "1px solid rgba(234,179,8,0.15)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {view === "history" && (
            <button onClick={() => setView("chat")} style={iconBtnStyle} title="Back">
              <ChevronLeft size={16} color="rgba(255,255,255,0.6)" />
            </button>
          )}
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #111827, #1f2937)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 2px rgba(234,179,8,0.3), 0 4px 12px rgba(0,0,0,0.4)",
            border: "1px solid rgba(234,179,8,0.2)",
          }}>
            <ApexLogo size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              {view === "history" ? "Conversation History" : "Apex Hire"}
            </div>
            {view === "chat" && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.3, letterSpacing: "0.02em" }}>
                AI Recruiting Assistant
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {view === "chat" && (
            <>
              <button onClick={newConversation} style={iconBtnStyle} title="New conversation">
                <Plus size={15} color="rgba(255,255,255,0.5)" />
              </button>
              <button onClick={openHistory} style={iconBtnStyle} title="History">
                <History size={15} color="rgba(255,255,255,0.5)" />
              </button>
            </>
          )}
          <button onClick={() => setIsMinimized((m) => !m)} style={iconBtnStyle} title={isMinimized ? "Expand" : "Minimize"}>
            <ChevronDown size={15} color="rgba(255,255,255,0.5)" style={{ transform: isMinimized ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          <button onClick={() => setOpen(false)} style={iconBtnStyle} aria-label="Close">
            <X size={15} color="rgba(255,255,255,0.5)" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* History view */}
          {view === "history" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                  No past conversations
                </div>
              ) : sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "11px 14px",
                    borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)", cursor: "pointer",
                    marginBottom: 6, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 10,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(234,179,8,0.08)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(234,179,8,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title || "Conversation"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      {new Date(s.last_active).toLocaleDateString()} · {new Date(s.last_active).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", padding: 4, borderRadius: 6, flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Chat view */}
          {view === "chat" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 12px", gap: 20 }}>
                    {/* Welcome */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 16, margin: "0 auto 12px",
                        background: "linear-gradient(135deg, #111827, #1f2937)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 0 2px rgba(234,179,8,0.3)",
                        border: "1px solid rgba(234,179,8,0.2)",
                      }}>
                        <ApexLogo size={26} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                        Apex Hire Assistant
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
                        Ask me anything about your candidates, jobs, or pipeline. I have full context of your hiring data.
                      </div>
                    </div>

                    {/* Suggestion chips */}
                    <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.text}
                          onClick={() => sendMessage(s.text)}
                          style={{
                            textAlign: "left", padding: "10px 12px",
                            borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)", cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(234,179,8,0.08)";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(234,179,8,0.25)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                          }}
                        >
                          <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>{s.text}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
                        {msg.role === "assistant" && (
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                            background: "linear-gradient(135deg, #111827, #1f2937)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginTop: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                            border: "1px solid rgba(234,179,8,0.2)",
                          }}>
                            <ApexLogo size={13} />
                          </div>
                        )}
                        <div style={{
                          maxWidth: "80%",
                          padding: msg.role === "user" ? "9px 14px" : "11px 14px",
                          borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                          background: msg.role === "user"
                            ? "linear-gradient(135deg, #1f2937, #111827)"
                            : "rgba(255,255,255,0.05)",
                          border: msg.role === "user" ? "1px solid rgba(234,179,8,0.2)" : "1px solid rgba(255,255,255,0.08)",
                          boxShadow: msg.role === "user" ? "0 2px 12px rgba(0,0,0,0.3)" : "none",
                        }}>
                          {msg.role === "user" ? (
                            <p style={{ margin: 0, fontSize: 13, color: "#fff", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                          ) : (
                            <div>
                              {renderMarkdown(msg.content)}
                              {msg.streaming && (
                                <span style={{
                                  display: "inline-block", width: 7, height: 15,
                                  background: "#eab308", borderRadius: 2,
                                  marginLeft: 2, verticalAlign: "middle",
                                  animation: "blink 0.8s infinite",
                                }} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Active tool indicator */}
                    {activeTool && (
                      <div style={{ display: "flex", gap: 8, paddingLeft: 34 }}>
                        <ToolBadge tool={activeTool} />
                      </div>
                    )}
                  </>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div style={{
                padding: "10px 14px 14px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                flexShrink: 0,
                background: "rgba(0,0,0,0.2)",
              }}>
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, padding: "10px 10px 10px 14px",
                }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about candidates, jobs, pipeline..."
                    rows={1}
                    aria-label="Chat message input"
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      resize: "none", fontSize: 13, color: "rgba(255,255,255,0.9)",
                      lineHeight: 1.5, maxHeight: 120, fontFamily: "inherit",
                      overflow: "hidden",
                    }}
                  />
                  {loading ? (
                    <button
                      onClick={stopGeneration}
                      title="Stop"
                      style={{
                        width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(248,113,113,0.4)",
                        background: "rgba(248,113,113,0.1)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f87171" }} />
                    </button>
                  ) : (
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim()}
                      style={{
                        width: 34, height: 34, borderRadius: 10, border: "none",
                        background: input.trim()
                          ? "linear-gradient(135deg, #1f2937, #111827)"
                          : "rgba(255,255,255,0.07)",
                        cursor: input.trim() ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "all 0.15s",
                        boxShadow: input.trim() ? "0 2px 10px rgba(234,179,8,0.2), 0 0 0 1px rgba(234,179,8,0.3)" : "none",
                      }}
                      aria-label="Send message"
                    >
                      <Send size={14} color={input.trim() ? "#fff" : "rgba(255,255,255,0.2)"} />
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, padding: "0 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={10} color="rgba(234,179,8,0.5)" />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>Powered by Apex Hire AI</span>
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>⌘K · Enter to send</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: "none",
  background: "transparent", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "background 0.15s",
};
