"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Trash2, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { parsingErrorsApi, type ParsingError, type ParsingErrorDetail } from "@/lib/api";

interface Props {
  jobId: string;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  text_extraction_failed: "Text Extraction",
  ocr_failed: "OCR",
  llm_extraction_failed: "LLM Extraction",
  schema_validation_failed: "Schema Validation",
  unsupported_format: "Unsupported Format",
  download_failed: "Download Failed",
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fef9f0", color: "#d97706" },
  in_review:  { bg: "#eff6ff", color: "#2563eb" },
  retrying:   { bg: "#f5f3ff", color: "#7c3aed" },
  resolved:   { bg: "#f0fdf4", color: "#16a34a" },
  discarded:  { bg: "#f9fafb", color: "#6b7280" },
};

export function ParsingErrorsPanel({ jobId }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ["parsing-errors", jobId, statusFilter],
    queryFn: () => parsingErrorsApi.list({ job_id: jobId, status: statusFilter || undefined }),
    staleTime: 5000,
  });

  const { data: stats } = useQuery({
    queryKey: ["parsing-error-stats", jobId],
    queryFn: () => parsingErrorsApi.stats(jobId),
    staleTime: 10_000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => parsingErrorsApi.retry(id),
    onSuccess: () => {
      toast.success("Retry queued");
      queryClient.invalidateQueries({ queryKey: ["parsing-errors", jobId] });
      queryClient.invalidateQueries({ queryKey: ["resume-bulk-status", jobId] });
      setSelectedId(null);
    },
    onError: () => toast.error("Retry failed"),
  });

  if (isLoading) return <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading...</p>;

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div style={{
          display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap",
          padding: "12px 16px", borderRadius: 10,
          background: stats.high_error_rate ? "#fef2f2" : "#f9fafb",
          border: `1px solid ${stats.high_error_rate ? "#fecaca" : "#e5e7eb"}`,
        }}>
          {stats.high_error_rate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 12, fontWeight: 600, width: "100%", marginBottom: 4 }}>
              <AlertTriangle size={13} /> High error rate: {(stats.error_rate * 100).toFixed(0)}% of uploads failed
            </div>
          )}
          {[
            { label: "Total", value: stats.total_uploads, color: "#374151" },
            { label: "Failed", value: stats.failed, color: "#dc2626" },
            { label: "Error rate", value: `${(stats.error_rate * 100).toFixed(0)}%`, color: stats.high_error_rate ? "#dc2626" : "#6b7280" },
          ].map((s) => (
            <div key={s.label} style={{ fontSize: 12, color: "#6b7280" }}>
              <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span> {s.label}
            </div>
          ))}
          {Object.entries(stats.by_type).map(([type, count]) => (
            <div key={type} style={{ fontSize: 11, color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 4, padding: "1px 7px" }}>
              {ERROR_TYPE_LABELS[type] ?? type}: {count}
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {["pending", "in_review", "retrying", "resolved", "discarded", ""].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
              border: "1px solid #e5e7eb", cursor: "pointer",
              background: statusFilter === s ? "#4f46e5" : "#fff",
              color: statusFilter === s ? "#fff" : "#6b7280",
            }}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
          </button>
        ))}
      </div>

      {errors.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <CheckCircle2 size={28} color="#d1d5db" style={{ margin: "0 auto 10px", display: "block" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>
            {statusFilter === "pending" ? "No pending errors" : "No errors found"}
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>All resumes parsed successfully.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {errors.map((err) => (
            <ErrorRow
              key={err.id}
              error={err}
              isSelected={selectedId === err.id}
              onSelect={() => setSelectedId(selectedId === err.id ? null : err.id)}
              onRetry={() => retryMutation.mutate(err.id)}
              retrying={retryMutation.isPending}
              jobId={jobId}
              onResolved={() => {
                queryClient.invalidateQueries({ queryKey: ["parsing-errors", jobId] });
                queryClient.invalidateQueries({ queryKey: ["parsing-error-stats", jobId] });
                setSelectedId(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Error row with expandable detail ─────────────────────────────────────────

interface ErrorRowProps {
  error: ParsingError;
  isSelected: boolean;
  onSelect: () => void;
  onRetry: () => void;
  retrying: boolean;
  jobId: string;
  onResolved: () => void;
}

function ErrorRow({ error, isSelected, onSelect, onRetry, retrying, jobId, onResolved }: ErrorRowProps) {
  const s = STATUS_STYLE[error.status] ?? STATUS_STYLE.pending;

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${isSelected ? "#a5b4fc" : "#e5e7eb"}`, overflow: "hidden" }}>
      {/* Row header */}
      <div
        onClick={onSelect}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          background: isSelected ? "#eef2ff" : "#fff", cursor: "pointer",
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <AlertTriangle size={14} color="#dc2626" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {error.applicant_name ?? error.file_name ?? "Unknown file"}
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
            {ERROR_TYPE_LABELS[error.error_type] ?? error.error_type}
            {error.stage && ` · ${error.stage}`}
            {" · "}{new Date(error.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0 }}>
          {error.status.replace("_", " ")}
        </span>
        {error.status === "pending" && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            disabled={retrying}
            title="Retry parsing"
            style={{ background: "#eef2ff", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#4f46e5", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          >
            <RefreshCw size={11} /> Retry
          </button>
        )}
        {isSelected ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
      </div>

      {/* Expanded detail */}
      {isSelected && (
        <ErrorDetail error={error} jobId={jobId} onResolved={onResolved} />
      )}
    </div>
  );
}

// ── Expanded error detail with correction form ────────────────────────────────

function ErrorDetail({ error, jobId, onResolved }: { error: ParsingError; jobId: string; onResolved: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "correct" | "discard">("view");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", location: "", skills: "" });
  const [discardReason, setDiscardReason] = useState("");

  const { data: detail, isLoading } = useQuery({
    queryKey: ["parsing-error-detail", error.id],
    queryFn: () => parsingErrorsApi.get(error.id),
    staleTime: 30_000,
  });

  const resolveMutation = useMutation({
    mutationFn: () => parsingErrorsApi.resolve(error.id, {
      full_name: form.full_name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      location: form.location || undefined,
      skills: form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: () => { toast.success("Candidate saved and error resolved"); onResolved(); },
    onError: () => toast.error("Failed to resolve"),
  });

  const discardMutation = useMutation({
    mutationFn: () => parsingErrorsApi.discard(error.id, discardReason),
    onSuccess: () => { toast.success("Discarded"); onResolved(); },
    onError: () => toast.error("Failed to discard"),
  });

  // Pre-fill form from candidate if available
  const prefill = (d: ParsingErrorDetail) => {
    setForm({
      full_name: d.candidate?.full_name ?? error.applicant_name ?? "",
      email: d.candidate?.email ?? "",
      phone: d.candidate?.phone ?? "",
      location: d.candidate?.location ?? "",
      skills: ((d.candidate?.parsed_data as any)?.skills ?? []).join(", "),
    });
    setMode("correct");
  };

  if (isLoading) return <div style={{ padding: "12px 16px", fontSize: 13, color: "#9ca3af" }}>Loading detail...</div>;

  return (
    <div style={{ padding: "0 14px 14px", borderTop: "1px solid #e5e7eb", background: "#fafafa" }}>
      {/* Error message */}
      {error.error_message && (
        <div style={{ margin: "12px 0 10px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626" }}>
          {error.error_message}
        </div>
      )}

      {/* Raw text preview */}
      {detail?.raw_resume_text && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 11, color: "#9ca3af", cursor: "pointer", userSelect: "none" }}>Raw extracted text ({detail.raw_resume_text.length} chars)</summary>
          <pre style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", borderRadius: 6, padding: "8px 10px", maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", marginTop: 6 }}>
            {detail.raw_resume_text.slice(0, 1500)}{detail.raw_resume_text.length > 1500 ? "…" : ""}
          </pre>
        </details>
      )}

      {/* Action buttons */}
      {mode === "view" && error.status !== "resolved" && error.status !== "discarded" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => detail ? prefill(detail) : setMode("correct")}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}
          >
            <CheckCircle2 size={12} /> Manual Correction
          </button>
          <button
            onClick={() => setMode("discard")}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer" }}
          >
            <Trash2 size={12} /> Discard
          </button>
        </div>
      )}

      {/* Manual correction form */}
      {mode === "correct" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>Manual Correction</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[
              { key: "full_name", label: "Full Name", placeholder: "Jane Smith" },
              { key: "email", label: "Email", placeholder: "jane@example.com" },
              { key: "phone", label: "Phone", placeholder: "+1 555 000 0000" },
              { key: "location", label: "Location", placeholder: "New York, NY" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box" as const }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>Skills (comma-separated)</label>
            <input
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              placeholder="Python, React, SQL..."
              style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box" as const }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}
            >
              Save & Resolve
            </button>
            <button onClick={() => setMode("view")} style={{ padding: "7px 14px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Discard form */}
      {mode === "discard" && (
        <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", margin: "0 0 10px" }}>Discard Resume</p>
          <textarea
            rows={2}
            value={discardReason}
            onChange={(e) => setDiscardReason(e.target.value)}
            placeholder="Reason (e.g. corrupted file, wrong document type...)"
            style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #fecaca", borderRadius: 6, outline: "none", resize: "none", boxSizing: "border-box" as const }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => discardMutation.mutate()}
              disabled={!discardReason.trim() || discardMutation.isPending}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: "#dc2626", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", opacity: !discardReason.trim() ? 0.5 : 1 }}
            >
              Confirm Discard
            </button>
            <button onClick={() => setMode("view")} style={{ padding: "7px 14px", fontSize: 12, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resolved / discarded state */}
      {(error.status === "resolved" || error.status === "discarded") && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
          {error.status === "resolved" ? "✓ Resolved" : "✗ Discarded"}
          {error.resolution_method && ` via ${error.resolution_method}`}
          {error.resolved_at && ` on ${new Date(error.resolved_at).toLocaleDateString()}`}
          {error.discard_reason && <span style={{ color: "#9ca3af" }}> — {error.discard_reason}</span>}
        </div>
      )}
    </div>
  );
}
