"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Edit2, Trash2, Plus, Check, X, Share2, Printer, Link, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { interviewKitApi, type InterviewKit, type InterviewQuestion, type ScoringRubric } from "@/lib/api";

// ── Difficulty badge ──────────────────────────────────────────────────────────
function DiffBadge({ diff }: { diff: string | null }) {
  if (!diff) return null;
  const colors: Record<string, string> = { Easy: "rgba(16,185,129,0.15)", Medium: "rgba(245,158,11,0.15)", Hard: "rgba(239,68,68,0.15)" };
  const text: Record<string, string> = { Easy: "#6ee7b7", Medium: "#fcd34d", Hard: "#fca5a5" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: colors[diff] ?? "rgba(255,255,255,0.08)", color: text[diff] ?? "rgba(255,255,255,0.5)" }}>
      {diff}
    </span>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    technical: { label: "Technical", color: "#818cf8" },
    behavioral: { label: "Behavioral", color: "#34d399" },
    gap_probe: { label: "Gap Probe", color: "#fb923c" },
  };
  const { label, color } = map[type] ?? { label: type, color: "#94a3b8" };
  return <span style={{ fontSize: 10, fontWeight: 600, color, padding: "2px 8px", borderRadius: 4, background: `${color}20` }}>{label}</span>;
}

// ── Rubric display (07.5) ─────────────────────────────────────────────────────
function RubricDisplay({ rubric }: { rubric: ScoringRubric }) {
  const scoreColors = ["#fca5a5", "#fcd34d", "#93c5fd", "#6ee7b7"];
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Scoring Rubric (1–4)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rubric.scale.map((level) => (
          <div key={level.score} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: `${scoreColors[level.score - 1]}20`,
              border: `1px solid ${scoreColors[level.score - 1]}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: scoreColors[level.score - 1],
            }}>
              {level.score}
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: scoreColors[level.score - 1] }}>{level.label}</span>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{level.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Question card ─────────────────────────────────────────────────────────────
function QuestionCard({ question, kitId, onUpdated, onDeleted }: {
  question: InterviewQuestion; kitId: string;
  onUpdated: (q: InterviewQuestion) => void; onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(question.question_text);
  const [saving, setSaving] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    if (!editText.trim() || editText === question.question_text) { setEditing(false); return; }
    setSaving(true);
    try {
      const updated = await interviewKitApi.updateQuestion(kitId, question.id, { question_text: editText });
      onUpdated(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm("Delete this question?")) return;
    await interviewKitApi.deleteQuestion(kitId, question.id);
    onDeleted(question.id);
  };

  const regenRubric = async () => {
    setGeneratingRubric(true);
    try {
      const { rubric } = await interviewKitApi.generateRubric(kitId, question.id);
      onUpdated({ ...question, rubric });
      setShowRubric(true);
    } catch { toast.error("Failed to generate rubric"); }
    finally { setGeneratingRubric(false); }
  };

  const hasDetails = question.suggested_answer || question.green_flags?.length > 0 || question.rubric;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <TypeBadge type={question.question_type} />
              {question.difficulty && <DiffBadge diff={question.difficulty} />}
              {question.competency_area && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>{question.competency_area}</span>
              )}
              {question.is_edited && <span style={{ fontSize: 10, color: "#fbbf24", padding: "2px 6px", borderRadius: 4, background: "rgba(251,191,36,0.1)" }}>edited</span>}
              {question.rubric && <span style={{ fontSize: 10, color: "#a78bfa", padding: "2px 6px", borderRadius: 4, background: "rgba(167,139,250,0.1)", cursor: "pointer" }} onClick={() => setShowRubric(v => !v)}>rubric</span>}
            </div>
            {editing ? (
              <div>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "8px 10px", resize: "vertical", minHeight: 72, fontFamily: "inherit", outline: "none" }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={save} disabled={saving} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
                  <button onClick={() => { setEditing(false); setEditText(question.question_text); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{question.question_text}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {!editing && <button onClick={() => setEditing(true)} style={iconBtn} title="Edit"><Edit2 size={13} color="rgba(255,255,255,0.4)" /></button>}
            <button onClick={del} style={iconBtn} title="Delete"><Trash2 size={13} color="rgba(239,68,68,0.5)" /></button>
            {!question.rubric && (
              <button onClick={regenRubric} disabled={generatingRubric} style={iconBtn} title="Generate rubric">
                <RefreshCw size={13} color="rgba(167,139,250,0.6)" />
              </button>
            )}
            {hasDetails && (
              <button onClick={() => setExpanded((e) => !e)} style={iconBtn}>
                {expanded ? <ChevronUp size={13} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={13} color="rgba(255,255,255,0.4)" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {(expanded || showRubric) && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {expanded && (
            <>
              {question.suggested_answer && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Suggested Answer</div>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{question.suggested_answer}</p>
                </div>
              )}
              {question.green_flags?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Green Flags</div>
                  {question.green_flags.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                      <Check size={11} color="#6ee7b7" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {question.red_flags?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Red Flags</div>
                  {question.red_flags.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                      <X size={11} color="#fca5a5" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {question.gap_skill && (
                <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)" }}>
                  <span style={{ fontSize: 11, color: "#fb923c" }}>Gap: <strong>{question.gap_skill}</strong> ({question.gap_criticality})</span>
                </div>
              )}
            </>
          )}
          {showRubric && question.rubric && <RubricDisplay rubric={question.rubric} />}
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: "none",
  background: "transparent", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

// ── Gap analysis summary ──────────────────────────────────────────────────────
function GapSummary({ gap }: { gap: InterviewKit["gap_analysis"] }) {
  if (!gap) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
        <span style={{ fontSize: 12, color: "#6ee7b7" }}>✓ {gap.matched_skills.length} matched</span>
      </div>
      {gap.partial_skills.length > 0 && (
        <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <span style={{ fontSize: 12, color: "#fcd34d" }}>~ {gap.partial_skills.length} partial</span>
        </div>
      )}
      {gap.gap_count > 0 && (
        <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span style={{ fontSize: 12, color: "#fca5a5" }}>✗ {gap.gap_count} gap{gap.gap_count !== 1 ? "s" : ""}{gap.has_critical_gaps ? " (critical)" : ""}</span>
        </div>
      )}
    </div>
  );
}

// ── Share panel (07.7) ────────────────────────────────────────────────────────
function SharePanel({ kit }: { kit: InterviewKit }) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createLink = async () => {
    if (kit.status !== "approved") {
      toast.error("Approve the kit before sharing");
      return;
    }
    setCreating(true);
    try {
      const { token } = await interviewKitApi.createShareLink(kit.kit_id);
      const url = `${window.location.origin}/interview-kits/shared/${token}`;
      setShareLink(url);
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch { toast.error("Failed to create share link"); }
    finally { setCreating(false); }
  };

  const printKit = () => {
    window.open(`/interview-kits/print/${kit.kit_id}`, "_blank");
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button
        onClick={printKit}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}
      >
        <Printer size={12} /> Print / PDF
      </button>
      <button
        onClick={createLink}
        disabled={creating}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818cf8", fontSize: 12, cursor: "pointer" }}
      >
        <Link size={12} /> {creating ? "Creating…" : "Share Link"}
      </button>
      {shareLink && (
        <div style={{ width: "100%", marginTop: 4, padding: "6px 10px", borderRadius: 6, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", fontSize: 11, color: "#a5b4fc", wordBreak: "break-all" }}>
          {shareLink}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function InterviewKitPanel({ candidateId, jobId }: { candidateId: string; jobId: string }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"technical" | "behavioral" | "gap_probe">("technical");
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQText, setNewQText] = useState("");
  const [newQType, setNewQType] = useState("technical");
  const [showShare, setShowShare] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);

  const generateMut = useMutation({
    mutationFn: () => interviewKitApi.generate(candidateId, jobId),
    onMutate: () => setIsGenerating(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interview-kit", candidateId, jobId] });
      setIsGenerating(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Failed to generate kit");
      setIsGenerating(false);
    },
  });

  const { data: kit, isLoading, error } = useQuery({
    queryKey: ["interview-kit", candidateId, jobId],
    queryFn: () => interviewKitApi.get(candidateId, jobId),
    retry: false,
    refetchInterval: isGenerating ? 5000 : false,
  });

  const approveMut = useMutation({
    mutationFn: () => interviewKitApi.approve(kit!.kit_id),
    onSuccess: (data) => qc.setQueryData(["interview-kit", candidateId, jobId], data),
  });

  const handleUpdated = (updated: InterviewQuestion) => {
    qc.setQueryData(["interview-kit", candidateId, jobId], (old: InterviewKit | undefined) => {
      if (!old) return old;
      return { ...old, questions: old.questions.map((q) => q.id === updated.id ? updated : q) };
    });
  };

  const handleDeleted = (id: string) => {
    qc.setQueryData(["interview-kit", candidateId, jobId], (old: InterviewKit | undefined) => {
      if (!old) return old;
      return { ...old, questions: old.questions.filter((q) => q.id !== id) };
    });
  };

  const addQuestion = async () => {
    if (!newQText.trim() || !kit) return;
    const q = await interviewKitApi.addQuestion(kit.kit_id, { question_text: newQText, question_type: newQType });
    qc.setQueryData(["interview-kit", candidateId, jobId], (old: InterviewKit | undefined) => {
      if (!old) return old;
      return { ...old, questions: [...old.questions, q] };
    });
    setNewQText("");
    setAddingQuestion(false);
  };

  if (!isLoading && (error || !kit)) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>No Interview Kit Yet</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Generate a tailored interview kit with technical, behavioral, and gap-probe questions.</div>
        <button onClick={() => generateMut.mutate()} disabled={isGenerating}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {isGenerating ? "Generating…" : "Generate Interview Kit"}
        </button>
      </div>
    );
  }

  if (isLoading) return <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading kit…</div>;

  const questions = kit!.questions;
  const tabQuestions = questions.filter((q) => q.question_type === activeTab);
  const statusColor = kit!.status === "approved" ? "#6ee7b7" : kit!.status === "outdated" ? "#fca5a5" : "#fbbf24";
  const statusLabel = kit!.status === "approved" ? "Approved" : kit!.status === "outdated" ? "Outdated" : "Generated";

  return (
    <div style={{ padding: "0 0 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Interview Kit</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: `${statusColor}20`, color: statusColor }}>{statusLabel}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{kit!.question_counts.technical}T · {kit!.question_counts.behavioral}B · {kit!.question_counts.gap_probe}G</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => generateMut.mutate()} disabled={isGenerating}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>
          {isGenerating ? "Regenerating…" : "Regenerate"}
          </button>
          {kit!.status !== "approved" && (
            <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}
              style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "rgba(16,185,129,0.15)", color: "#6ee7b7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <CheckCircle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Approve Kit
            </button>
          )}
          <button onClick={() => setShowShare(v => !v)}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.3)", background: showShare ? "rgba(99,102,241,0.15)" : "transparent", color: "#818cf8", fontSize: 12, cursor: "pointer" }}>
            <Share2 size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Share
          </button>
        </div>
      </div>

      {/* Share panel */}
      {showShare && (
        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <SharePanel kit={kit!} />
        </div>
      )}

      {/* Outdated warning */}
      {kit!.status === "outdated" && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={14} color="#fca5a5" />
          <span style={{ fontSize: 12, color: "#fca5a5" }}>Job criteria changed since this kit was approved. Regenerate to update.</span>
        </div>
      )}

      <GapSummary gap={kit!.gap_analysis} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
        {(["technical", "behavioral", "gap_probe"] as const).map((tab) => {
          const labels = { technical: "Technical", behavioral: "Behavioral", gap_probe: "Gap Probe" };
          const count = kit!.question_counts[tab];
          const active = activeTab === tab;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "8px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.4)", borderBottom: active ? "2px solid #6366f1" : "2px solid transparent", marginBottom: -1 }}>
              {labels[tab]} ({count})
            </button>
          );
        })}
      </div>

      {/* Questions */}
      <div>
        {tabQuestions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No {activeTab.replace("_", " ")} questions</div>
        ) : (
          tabQuestions.map((q) => (
            <QuestionCard key={q.id} question={q} kitId={kit!.kit_id} onUpdated={handleUpdated} onDeleted={handleDeleted} />
          ))
        )}

        {addingQuestion ? (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.05)", marginTop: 8 }}>
            <textarea value={newQText} onChange={(e) => setNewQText(e.target.value)} placeholder="Enter your question..." autoFocus
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "8px 10px", resize: "vertical", minHeight: 72, fontFamily: "inherit", outline: "none", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={newQType} onChange={(e) => setNewQType(e.target.value)}
                style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "#1e293b", color: "#fff", fontSize: 12 }}>
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
                <option value="gap_probe">Gap Probe</option>
              </select>
              <button onClick={addQuestion} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer" }}>Add</button>
              <button onClick={() => { setAddingQuestion(false); setNewQText(""); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingQuestion(true)}
            style={{ width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={13} /> Add Question
          </button>
        )}
      </div>
    </div>
  );
}
