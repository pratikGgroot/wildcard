"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, CheckCircle2, AlertTriangle,
  Zap, GraduationCap, Award, Briefcase, Clock,
  Plus, Pencil, Trash2, X, Check,
} from "lucide-react";
import { criteriaApi, type Criterion, type CriterionType, type CriterionWeight } from "@/lib/api";
import { SuggestionsPanel } from "@/components/jobs/suggestions-panel";

interface Props {
  jobId: string;
  descriptionChanged?: boolean;
}

const TYPE_CONFIG: Record<CriterionType, { label: string; icon: React.ElementType; bg: string; color: string; border: string }> = {
  skill:         { label: "Skills",         icon: Zap,           bg: "#eef2ff", color: "#4f46e5", border: "#c7d2fe" },
  experience:    { label: "Experience",     icon: Briefcase,     bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  education:     { label: "Education",      icon: GraduationCap, bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
  certification: { label: "Certifications", icon: Award,         bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
};

const WEIGHT_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: "#fef2f2", color: "#dc2626" },
  medium: { bg: "#fffbeb", color: "#d97706" },
  low:    { bg: "#f0fdf4", color: "#16a34a" },
};

const TYPE_OPTIONS: CriterionType[] = ["skill", "experience", "education", "certification"];
const WEIGHT_OPTIONS: CriterionWeight[] = ["high", "medium", "low"];

const inputSm = {
  padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db",
  borderRadius: 6, outline: "none", background: "#fff", color: "#111827",
} as React.CSSProperties;

const selectSm = { ...inputSm, cursor: "pointer" } as React.CSSProperties;

async function fetchLLMHealth() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
  const url = base.replace("/api/v1", "") + "/health/llm";
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const low = score < 0.7;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
      background: low ? "#fffbeb" : "#f0fdf4",
      color: low ? "#d97706" : "#16a34a",
      border: `1px solid ${low ? "#fde68a" : "#bbf7d0"}`,
    }}>
      {low ? <AlertTriangle size={9} /> : <CheckCircle2 size={9} />}
      {pct}%{low ? " · Review" : ""}
    </span>
  );
}

// ── Inline editor for a single criterion ─────────────────────────────────────
interface EditRowProps {
  c: Criterion;
  jobId: string;
  onDone: () => void;
}

function EditRow({ c, jobId, onDone }: EditRowProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(c.criterion_name);
  const [type, setType] = useState<CriterionType>(c.criterion_type);
  const [weight, setWeight] = useState<CriterionWeight>(c.weight);
  const [required, setRequired] = useState(c.required);

  const updateMutation = useMutation({
    mutationFn: () => criteriaApi.update(jobId, c.id, { criterion_name: name, criterion_type: type, weight, required }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Criterion[]>(["criteria", jobId], (old = []) =>
        old.map((x) => (x.id === updated.id ? updated : x))
      );
      toast.success("Criterion updated");
      onDone();
    },
    onError: () => toast.error("Update failed"),
  });

  const valid = name.trim().length >= 2;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      padding: "8px 12px", borderRadius: 10,
      background: "#f0f9ff", border: "1px solid #bae6fd",
    }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ ...inputSm, flex: 1, minWidth: 120 }}
        autoFocus
      />
      <select value={type} onChange={(e) => setType(e.target.value as CriterionType)} style={selectSm}>
        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
      </select>
      <select value={weight} onChange={(e) => setWeight(e.target.value as CriterionWeight)} style={selectSm}>
        {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required
      </label>
      <button
        onClick={() => updateMutation.mutate()}
        disabled={!valid || updateMutation.isPending}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 10px", fontSize: 12, fontWeight: 600,
          background: valid ? "#4f46e5" : "#e5e7eb",
          color: valid ? "#fff" : "#9ca3af",
          border: "none", borderRadius: 6, cursor: valid ? "pointer" : "not-allowed",
        }}
      >
        <Check size={11} /> Save
      </button>
      <button
        onClick={onDone}
        style={{
          display: "flex", alignItems: "center",
          padding: "4px 8px", fontSize: 12,
          background: "transparent", color: "#6b7280",
          border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer",
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Add criterion form ────────────────────────────────────────────────────────
interface AddRowProps {
  jobId: string;
  defaultType?: CriterionType;
  onDone: () => void;
}

function AddRow({ jobId, defaultType = "skill", onDone }: AddRowProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<CriterionType>(defaultType);
  const [weight, setWeight] = useState<CriterionWeight>("medium");
  const [required, setRequired] = useState(false);

  const addMutation = useMutation({
    mutationFn: () => criteriaApi.add(jobId, { criterion_name: name.trim(), criterion_type: type, weight, required }),
    onSuccess: (created) => {
      queryClient.setQueryData<Criterion[]>(["criteria", jobId], (old = []) => [...old, created]);
      toast.success("Criterion added");
      onDone();
    },
    onError: () => toast.error("Failed to add criterion"),
  });

  const valid = name.trim().length >= 2;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      padding: "8px 12px", borderRadius: 10,
      background: "#f0fdf4", border: "1px solid #bbf7d0",
    }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Criterion name..."
        style={{ ...inputSm, flex: 1, minWidth: 140 }}
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter" && valid) addMutation.mutate(); if (e.key === "Escape") onDone(); }}
      />
      <select value={type} onChange={(e) => setType(e.target.value as CriterionType)} style={selectSm}>
        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
      </select>
      <select value={weight} onChange={(e) => setWeight(e.target.value as CriterionWeight)} style={selectSm}>
        {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required
      </label>
      <button
        onClick={() => addMutation.mutate()}
        disabled={!valid || addMutation.isPending}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 10px", fontSize: 12, fontWeight: 600,
          background: valid ? "#16a34a" : "#e5e7eb",
          color: valid ? "#fff" : "#9ca3af",
          border: "none", borderRadius: 6, cursor: valid ? "pointer" : "not-allowed",
        }}
      >
        <Plus size={11} /> Add
      </button>
      <button
        onClick={onDone}
        style={{
          display: "flex", alignItems: "center",
          padding: "4px 8px", fontSize: 12,
          background: "transparent", color: "#6b7280",
          border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer",
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Criterion card ────────────────────────────────────────────────────────────
interface CardProps {
  c: Criterion;
  jobId: string;
}

function CriterionCard({ c, jobId }: CardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const ws = WEIGHT_STYLE[c.weight] ?? WEIGHT_STYLE.medium;

  const deleteMutation = useMutation({
    mutationFn: () => criteriaApi.remove(jobId, c.id),
    onSuccess: () => {
      // Optimistic remove
      queryClient.setQueryData<Criterion[]>(["criteria", jobId], (old = []) =>
        old.filter((x) => x.id !== c.id)
      );
      // Undo toast — 5 second window
      toast(`Removed "${c.criterion_name}"`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            // Re-add via API
            criteriaApi.add(jobId, {
              criterion_name: c.criterion_name,
              criterion_type: c.criterion_type,
              weight: c.weight,
              required: c.required,
              extra_data: c.extra_data,
            }).then((restored) => {
              queryClient.setQueryData<Criterion[]>(["criteria", jobId], (old = []) => [...old, restored]);
              toast.success("Criterion restored");
            });
          },
        },
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  if (editing) return <EditRow c={c} jobId={jobId} onDone={() => setEditing(false)} />;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 10,
        background: "#fff", border: "1px solid #f3f4f6",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#e0e7ff")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#f3f4f6")}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.criterion_name}</span>
          {!c.ai_extracted && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
              background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
            }}>Manual</span>
          )}
          {c.required && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
            }}>Required</span>
          )}
          {c.extra_data?.years_min != null && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{String(c.extra_data.years_min)}+ yrs</span>
          )}
          {c.extra_data?.field != null && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>· {String(c.extra_data.field)}</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <ConfidenceBadge score={c.confidence_score} />
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
          background: ws.bg, color: ws.color, textTransform: "capitalize",
        }}>{c.weight}</span>
        <button
          onClick={() => setEditing(true)}
          title="Edit"
          style={{
            display: "flex", alignItems: "center", padding: 5,
            background: "transparent", border: "none", cursor: "pointer",
            color: "#9ca3af", borderRadius: 5,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4f46e5"; (e.currentTarget as HTMLButtonElement).style.background = "#eef2ff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          title="Delete"
          style={{
            display: "flex", alignItems: "center", padding: 5,
            background: "transparent", border: "none", cursor: "pointer",
            color: "#9ca3af", borderRadius: 5,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function CriteriaPanel({ jobId, descriptionChanged }: Props) {
  const queryClient = useQueryClient();
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [addingForType, setAddingForType] = useState<CriterionType | null>(null);

  // Unsaved-changes guard: warn if user navigates away while an add row is open
  useEffect(() => {
    if (!addingForType) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [addingForType]);

  const { data: criteria = [], isLoading: loadingCriteria } = useQuery({
    queryKey: ["criteria", jobId],
    queryFn: () => criteriaApi.list(jobId),
  });

  const { data: llmHealth } = useQuery({
    queryKey: ["llm-health"],
    queryFn: fetchLLMHealth,
    staleTime: 30_000,
    retry: false,
  });

  const extractMutation = useMutation({
    mutationFn: () => criteriaApi.extract(jobId),
    onSuccess: (res) => {
      queryClient.setQueryData(["criteria", jobId], res.criteria);
      setDismissedPrompt(true);
      const msg = res.from_cache
        ? "Criteria loaded from cache"
        : `Extracted ${res.criteria.length} criteria${res.embedding_stored ? " · Embedding stored" : ""}`;
      toast.success(msg);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Extraction failed"),
  });

  const grouped = criteria.reduce<Record<CriterionType, Criterion[]>>(
    (acc, c) => { const k = c.criterion_type as CriterionType; if (!acc[k]) acc[k] = []; acc[k].push(c); return acc; },
    {} as Record<CriterionType, Criterion[]>
  );

  const typeOrder: CriterionType[] = ["skill", "experience", "education", "certification"];
  const hasAnyCriteria = criteria.length > 0;
  const lowConfidenceCount = criteria.filter((c) => c.confidence_score !== null && c.confidence_score < 0.7).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={14} color="#4f46e5" />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>AI Criteria</span>
            {hasAnyCriteria && (
              <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>{criteria.length} extracted</span>
            )}
            {llmHealth && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600,
                padding: "2px 7px", borderRadius: 20,
                background: llmHealth.status === "ok" ? "#f0fdf4" : llmHealth.provider === "mock" ? "#f3f4f6" : "#fef2f2",
                color: llmHealth.status === "ok" ? "#16a34a" : llmHealth.provider === "mock" ? "#6b7280" : "#dc2626",
                border: `1px solid ${llmHealth.status === "ok" ? "#bbf7d0" : llmHealth.provider === "mock" ? "#e5e7eb" : "#fecaca"}`,
              }}>
                {llmHealth.provider === "mock" ? "mock" : llmHealth.provider === "ollama" ? `ollama · ${llmHealth.model}` : llmHealth.provider}
                {llmHealth.status !== "ok" && llmHealth.provider !== "mock" && " ⚠"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600,
              background: extractMutation.isPending ? "#e5e7eb" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: extractMutation.isPending ? "#9ca3af" : "#fff",
              border: "none", borderRadius: 8, padding: "7px 14px",
              cursor: extractMutation.isPending ? "not-allowed" : "pointer",
              boxShadow: extractMutation.isPending ? "none" : "0 2px 8px rgba(79,70,229,0.25)",
            }}
          >
            {extractMutation.isPending ? (
              <>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "#6b7280",
                  animation: "spin 0.8s linear infinite",
                }} />
                Extracting...
              </>
            ) : (
              <>{hasAnyCriteria ? <RefreshCw size={12} /> : <Sparkles size={12} />} {hasAnyCriteria ? "Re-extract" : "Extract Criteria"}</>
            )}
          </button>
        </div>
      </div>

      {/* Global add row — removed; use per-section + Add buttons instead */}

      {/* Re-extract prompt */}
      {descriptionChanged && !dismissedPrompt && hasAnyCriteria && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", borderRadius: 12, marginBottom: 16,
          background: "#fffbeb", border: "1px solid #fde68a",
        }}>
          <Clock size={15} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: 0 }}>Description changed</p>
            <p style={{ fontSize: 12, color: "#b45309", margin: "2px 0 0" }}>Re-extract criteria to reflect the latest description.</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => extractMutation.mutate()} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", background: "#d97706", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>
              Yes, re-extract
            </button>
            <button onClick={() => setDismissedPrompt(true)} style={{ fontSize: 12, fontWeight: 500, padding: "5px 10px", background: "transparent", color: "#92400e", border: "1px solid #fde68a", borderRadius: 7, cursor: "pointer" }}>
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Low confidence warning */}
      {lowConfidenceCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 10, marginBottom: 14,
          background: "#fffbeb", border: "1px solid #fde68a",
          fontSize: 12, color: "#92400e",
        }}>
          <AlertTriangle size={13} color="#d97706" />
          {lowConfidenceCount} criterion{lowConfidenceCount > 1 ? "a" : ""} flagged for review (confidence &lt; 70%)
        </div>
      )}

      {/* Empty state */}
      {!hasAnyCriteria && !loadingCriteria && !extractMutation.isPending && (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "#f9fafb", borderRadius: 14, border: "2px dashed #e5e7eb" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Sparkles size={22} color="#818cf8" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>No criteria extracted yet</p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px" }}>Extract with AI or add manually</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => extractMutation.mutate()} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.3)" }}>
              <Sparkles size={14} /> Extract with AI
            </button>
            <button onClick={() => setAddingForType("skill")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 9, padding: "9px 20px", cursor: "pointer" }}>
              <Plus size={14} /> Add manually
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {(loadingCriteria || extractMutation.isPending) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 44, borderRadius: 10, background: "#f3f4f6", animation: "pulse 1.5s ease infinite" }} />
          ))}
        </div>
      )}

      {/* Criteria grouped by type */}
      {hasAnyCriteria && !extractMutation.isPending && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {typeOrder.map((type) => {
            const items = grouped[type];
            const cfg = TYPE_CONFIG[type];
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={13} color={cfg.color} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</span>
                  {items?.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {items.length}
                    </span>
                  )}
                  <button
                    onClick={() => { setAddingForType(type); setAddingGlobal(false); }}
                    style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, padding: "3px 8px", background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 6, cursor: "pointer" }}
                  >
                    <Plus size={10} /> Add
                  </button>
                </div>
                {addingForType === type && (
                  <div style={{ marginBottom: 6 }}>
                    <AddRow jobId={jobId} defaultType={type} onDone={() => setAddingForType(null)} />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(items ?? []).map((c) => <CriterionCard key={c.id} c={c} jobId={jobId} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI suggestions from similar historical jobs */}
      <SuggestionsPanel jobId={jobId} />
    </div>
  );
}
