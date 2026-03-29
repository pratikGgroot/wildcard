"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, MapPin, Linkedin, FileText,
  Briefcase, GraduationCap, Award, FolderOpen,
  AlertCircle, StickyNote, Tag, X, Plus, Pencil, Trash2, Clock, Paperclip, Upload, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

import { candidatesApi, candidateNotesApi, candidateTagsApi, candidateDocumentsApi, fitScoreApi, type DocType } from "@/lib/api";
import { InterviewKitPanel } from "@/components/jobs/interview-kit-panel";

// ── helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (score === null) return { bg: "#f3f4f6", color: "#6b7280" };
  if (score >= 0.7) return { bg: "#ecfdf5", color: "#059669" };
  if (score >= 0.4) return { bg: "#fffbeb", color: "#d97706" };
  return { bg: "#fef2f2", color: "#dc2626" };
}

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={14} color="#4f46e5" />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", padding: "1px 7px", borderRadius: 10 }}>{count}</span>
      )}
    </div>
  );
}

function Skeleton({ w, h, radius = 6 }: { w: string | number; h: number; radius?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: radius, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

function NotesPanel({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["candidate-notes", candidateId],
    queryFn: () => candidateNotesApi.list(candidateId),
  });

  const addMutation = useMutation({
    mutationFn: () => candidateNotesApi.add(candidateId, draft.trim()),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] });
    },
    onError: () => toast.error("Failed to save note"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      candidateNotesApi.update(candidateId, id, content),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] });
    },
    onError: () => toast.error("Failed to update note"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidateNotesApi.remove(candidateId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] }),
    onError: () => toast.error("Failed to delete note"),
  });

  return (
    <div>
      {/* Add note */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          rows={3}
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!draft.trim() || addMutation.isPending}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", opacity: !draft.trim() ? 0.5 : 1 }}
          >
            <Plus size={12} /> Save Note
          </button>
        </div>
      </div>

      {/* Note list */}
      {notes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>No notes yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
              {editingId === n.id ? (
                <div>
                  <textarea
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", fontSize: 13, border: "1px solid #a5b4fc", borderRadius: 6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setEditingId(null)} style={{ padding: "4px 10px", fontSize: 12, background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                    <button
                      onClick={() => updateMutation.mutate({ id: n.id, content: editContent })}
                      disabled={!editContent.trim()}
                      style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                    >Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#374151", margin: "0 0 8px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.content}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(n.created_at)}{n.updated_at !== n.created_at ? " · edited" : ""}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => { setEditingId(n.id); setEditContent(n.content); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 3 }} title="Edit">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 3 }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents panel (Story 03.6) ─────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  cover_letter: "Cover Letter",
  portfolio: "Portfolio",
  certificate: "Certificate",
  other: "Other",
};

const DOC_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  cover_letter: { bg: "#eff6ff", color: "#2563eb" },
  portfolio:    { bg: "#f0fdf4", color: "#16a34a" },
  certificate:  { bg: "#fdf4ff", color: "#9333ea" },
  other:        { bg: "#f3f4f6", color: "#6b7280" },
};

const ALLOWED_MIME: Record<string, boolean> = {
  "application/pdf": true,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "image/png": true,
  "image/jpeg": true,
};

function formatBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPanel({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocType>("other");

  const { data: docs = [] } = useQuery({
    queryKey: ["candidate-docs", candidateId],
    queryFn: () => candidateDocumentsApi.list(candidateId),
  });

  const removeMutation = useMutation({
    mutationFn: (docId: string) => candidateDocumentsApi.remove(candidateId, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-docs", candidateId] }),
    onError: () => toast.error("Failed to delete document"),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File size exceeds 10MB limit"); return; }
    if (!ALLOWED_MIME[file.type]) { toast.error("Unsupported file type. Use PDF, DOCX, PNG, or JPG."); return; }
    setUploading(true);
    try {
      const { presigned_url } = await candidateDocumentsApi.getUploadUrl(candidateId, {
        file_name: file.name, file_size_bytes: file.size, mime_type: file.type, doc_type: docType,
      });
      await fetch(presigned_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["candidate-docs", candidateId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleOpen = async (docId: string) => {
    try {
      const { url } = await candidateDocumentsApi.getDownloadUrl(candidateId, docId);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not open document");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 7, outline: "none", background: "#fff" }}
        >
          <option value="cover_letter">Cover Letter</option>
          <option value="portfolio">Portfolio</option>
          <option value="certificate">Certificate</option>
          <option value="other">Other</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: uploading ? "#e0e7ff" : "#4f46e5", color: "#fff", borderRadius: 7, cursor: uploading ? "not-allowed" : "pointer" }}>
          <Upload size={12} /> {uploading ? "Uploading…" : "Attach File"}
          <input type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" onChange={handleFileChange} disabled={uploading} style={{ display: "none" }} />
        </label>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>PDF, DOCX, PNG, JPG · max 10MB</span>
      </div>
      {docs.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>No documents attached</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {docs.map((d) => {
            const tc = DOC_TYPE_COLORS[d.doc_type] ?? DOC_TYPE_COLORS.other;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#fafafa", border: "1px solid #e5e7eb" }}>
                <Paperclip size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button onClick={() => handleOpen(d.id)} style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {d.file_name}
                  </button>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: "1px 0 0" }}>{formatBytes(d.file_size_bytes)} · {timeAgo(d.uploaded_at)}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: tc.bg, color: tc.color, flexShrink: 0 }}>{DOC_TYPE_LABELS[d.doc_type]}</span>
                <button onClick={() => { if (confirm("Delete this document?")) removeMutation.mutate(d.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 3, flexShrink: 0 }} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tags panel ────────────────────────────────────────────────────────────────

function TagsPanel({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");

  const { data: tags = [] } = useQuery({
    queryKey: ["candidate-tags", candidateId],
    queryFn: () => candidateTagsApi.list(candidateId),
  });

  const addMutation = useMutation({
    mutationFn: (tag: string) => candidateTagsApi.add(candidateId, tag),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["candidate-tags", candidateId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Failed to add tag"),
  });

  const removeMutation = useMutation({
    mutationFn: (tagId: string) => candidateTagsApi.remove(candidateId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-tags", candidateId] }),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addMutation.mutate(input.trim());
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {tags.map((t) => (
          <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, background: "#eef2ff", color: "#4f46e5", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>
            {t.tag}
            <button onClick={() => removeMutation.mutate(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a5b4fc", padding: 0, display: "flex", alignItems: "center" }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          placeholder="Add tag (press Enter)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={50}
          style={{ flex: 1, padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 7, outline: "none" }}
        />
        <button
          onClick={() => input.trim() && addMutation.mutate(input.trim())}
          disabled={!input.trim()}
          style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", opacity: !input.trim() ? 0.5 : 1 }}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Radar chart (Story 04.6) ──────────────────────────────────────────────────

interface RadarDimension {
  label: string;
  value: number; // 0–100
  color: string;
}

function RadarChart({ dimensions, size = 140 }: { dimensions: RadarDimension[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const n = dimensions.length;

  // Compute polygon points for a given radius fraction
  const points = (fraction: number) =>
    dimensions.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + r * fraction * Math.cos(angle), cy + r * fraction * Math.sin(angle)] as [number, number];
    });

  const toPath = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + " Z";

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const dataPoints = points(1).map(([x, y], i) => {
    const frac = dimensions[i].value / 100;
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * frac * Math.cos(angle), cy + r * frac * Math.sin(angle)] as [number, number];
  });

  const labelPoints = points(1.28);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      {/* Grid rings */}
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={points(lvl).map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={0.8}
        />
      ))}
      {/* Axis lines */}
      {points(1).map(([x, y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={0.8} />
      ))}
      {/* Data polygon */}
      <path d={toPath(dataPoints)} fill="rgba(79,70,229,0.15)" stroke="#4f46e5" strokeWidth={1.5} />
      {/* Data dots */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={dimensions[i].color} />
      ))}
      {/* Labels */}
      {labelPoints.map(([x, y], i) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fontWeight={600}
          fill="#6b7280"
        >
          {dimensions[i].label}
        </text>
      ))}
    </svg>
  );
}

// ── Application History panel (Story 03.4) ────────────────────────────────────

const JOB_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: "#ecfdf5", color: "#059669" },
  closed: { bg: "#fef2f2", color: "#dc2626" },
  paused: { bg: "#fffbeb", color: "#d97706" },
  draft:  { bg: "#f3f4f6", color: "#6b7280" },
};

const UPLOAD_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: "#f0fdf4", color: "#16a34a", label: "Parsed" },
  failed:    { bg: "#fef2f2", color: "#dc2626", label: "Failed" },
  parsing:   { bg: "#fdf4ff", color: "#9333ea", label: "Parsing" },
  queued:    { bg: "#f3f4f6", color: "#6b7280", label: "Queued" },
};

function ApplicationHistoryPanel({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [overrideJob, setOverrideJob] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideJustification, setOverrideJustification] = useState("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["candidate-applications", candidateId],
    queryFn: () => candidatesApi.getApplications(candidateId),
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["candidate-scores", candidateId],
    queryFn: () => fitScoreApi.getCandidateScores(candidateId),
    staleTime: 30_000,
  });

  const scoreMap: Record<string, typeof scores[0]> = {};
  scores.forEach((s) => { scoreMap[s.job_id] = s; });

  const overrideMutation = useMutation({
    mutationFn: ({ jobId, score, just }: { jobId: string; score: number; just: string }) =>
      fitScoreApi.override(candidateId, jobId, score, just),
    onSuccess: () => {
      toast.success("Score overridden");
      setOverrideJob(null);
      setOverrideScore("");
      setOverrideJustification("");
      queryClient.invalidateQueries({ queryKey: ["candidate-scores", candidateId] });
    },
    onError: () => toast.error("Failed to save override"),
  });

  const resetMutation = useMutation({
    mutationFn: (jobId: string) => fitScoreApi.resetOverride(candidateId, jobId),
    onSuccess: () => {
      toast.success("Score reset to AI value");
      queryClient.invalidateQueries({ queryKey: ["candidate-scores", candidateId] });
    },
    onError: () => toast.error("Failed to reset override"),
  });

  if (isLoading) return <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</p>;

  if (!applications.length) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <Clock size={22} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
        <p style={{ fontSize: 13, color: "#9ca3af" }}>No application history</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {applications.map((app) => {
        const js = JOB_STATUS_STYLE[app.job_status] ?? JOB_STATUS_STYLE.draft;
        const us = UPLOAD_STATUS_STYLE[app.status] ?? UPLOAD_STATUS_STYLE.queued;
        const scoreRec = scoreMap[app.job_id];
        const fitScore = scoreRec?.fit_score;
        const isOverridden = scoreRec?.is_overridden ?? false;
        const isExpanded = expandedJob === app.job_id;
        const isOverriding = overrideJob === app.job_id;

        return (
          <div key={app.upload_id} style={{ borderRadius: 10, background: "#fff", border: "1px solid #f3f4f6", overflow: "hidden" }}>
            {/* Row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/jobs/${app.job_id}`} style={{ fontSize: 13, fontWeight: 600, color: "#111827", textDecoration: "none" }}>
                  {app.job_title}
                </Link>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                  Applied {timeAgo(app.uploaded_at)}
                </p>
              </div>

              {/* Fit score badge */}
              {fitScore !== undefined && (
                <div style={{
                  background: fitScore >= 70 ? "#ecfdf5" : fitScore >= 40 ? "#fffbeb" : "#fef2f2",
                  borderRadius: 8, padding: "4px 10px", minWidth: 44, textAlign: "center", flexShrink: 0,
                  outline: isOverridden ? "2px solid #d97706" : "none",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: fitScore >= 70 ? "#059669" : fitScore >= 40 ? "#d97706" : "#dc2626", lineHeight: 1, display: "block" }}>
                    {fitScore.toFixed(0)}
                  </span>
                  <span style={{ fontSize: 9, color: fitScore >= 70 ? "#059669" : fitScore >= 40 ? "#d97706" : "#dc2626", fontWeight: 600, textTransform: "uppercase" as const }}>
                    {isOverridden ? "adj" : "fit"}
                  </span>
                </div>
              )}

              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: us.bg, color: us.color, flexShrink: 0 }}>
                {us.label}
              </span>

              {/* Action buttons — compact */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {fitScore !== undefined && (
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : app.job_id)}
                    style={{ background: isExpanded ? "#eef2ff" : "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
                    title="Score breakdown"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                )}
                {fitScore !== undefined && !isOverridden && (
                  <button
                    onClick={() => { setOverrideJob(app.job_id); setOverrideScore(fitScore.toFixed(0)); }}
                    style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}
                    title="Override score"
                  >
                    ✎
                  </button>
                )}
                {fitScore !== undefined && isOverridden && (
                  <button
                    onClick={() => resetMutation.mutate(app.job_id)}
                    disabled={resetMutation.isPending}
                    title={`Reset — Justification: ${scoreRec.override_justification}`}
                    style={{ background: "none", border: "1px solid #fed7aa", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#d97706", cursor: "pointer" }}
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>

            {/* Override input */}
            {isOverriding && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #f3f4f6", background: "#fffbeb" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#92400e", margin: "0 0 8px" }}>Override fit score</p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <input
                    type="number"
                    min={0} max={100}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    placeholder="0–100"
                    style={{ width: 72, padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 7, outline: "none" }}
                  />
                  <input
                    type="text"
                    value={overrideJustification}
                    onChange={(e) => setOverrideJustification(e.target.value)}
                    placeholder="Justification (required, min 10 chars)"
                    style={{ flex: 1, minWidth: 200, padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 7, outline: "none" }}
                  />
                  <button
                    onClick={() => overrideMutation.mutate({ jobId: app.job_id, score: parseFloat(overrideScore), just: overrideJustification })}
                    disabled={!overrideScore || overrideJustification.length < 10 || overrideMutation.isPending}
                    style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#d97706", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", opacity: overrideJustification.length < 10 ? 0.5 : 1 }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setOverrideJob(null)}
                    style={{ padding: "6px 12px", fontSize: 12, background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Expandable breakdown */}
            {isExpanded && (
              <>
                {/* Multi-dim radar chart */}
                {scoreRec && (scoreRec.technical_score !== null || scoreRec.culture_score !== null || scoreRec.growth_score !== null) && (
                  <div style={{ padding: "12px 14px", borderTop: "1px solid #f3f4f6", background: "#fafafa", display: "flex", alignItems: "center", gap: 20 }}>
                    <RadarChart
                      size={120}
                      dimensions={[
                        { label: "Technical", value: scoreRec.technical_score ?? 0, color: "#4f46e5" },
                        { label: "Culture",   value: scoreRec.culture_score   ?? 0, color: "#059669" },
                        { label: "Growth",    value: scoreRec.growth_score    ?? 0, color: "#d97706" },
                      ]}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        { label: "Technical", val: scoreRec.technical_score, color: "#4f46e5", bg: "#eef2ff" },
                        { label: "Culture",   val: scoreRec.culture_score,   color: "#059669", bg: "#f0fdf4" },
                        { label: "Growth",    val: scoreRec.growth_score,    color: "#d97706", bg: "#fffbeb" },
                      ].map(({ label, val, color, bg }) => val !== null ? (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#6b7280", width: 60 }}>{label}</span>
                          <div style={{ width: 80, height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden" }}>
                            <div style={{ width: `${val}%`, height: "100%", background: color, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: "1px 6px", borderRadius: 4 }}>{val.toFixed(0)}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
                <FitBreakdownPanel candidateId={candidateId} jobId={app.job_id} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fit breakdown panel ───────────────────────────────────────────────────────

const WEIGHT_COLOR: Record<string, string> = { high: "#dc2626", medium: "#d97706", low: "#6b7280" };
const TYPE_LABEL: Record<string, string> = { skill: "Skill", experience: "Experience", education: "Education", certification: "Cert" };

function FitBreakdownPanel({ candidateId, jobId }: { candidateId: string; jobId: string }) {
  const { data: explanation, isLoading, error } = useQuery({
    queryKey: ["fit-explain", candidateId, jobId],
    queryFn: () => fitScoreApi.explain(candidateId, jobId),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", background: "#fafafa" }}>
      <p style={{ fontSize: 12, color: "#9ca3af" }}>Loading breakdown…</p>
    </div>
  );

  if (error || !explanation) return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", background: "#fafafa" }}>
      <p style={{ fontSize: 12, color: "#dc2626" }}>Could not load breakdown</p>
    </div>
  );

  const { summary, matched_criteria, partial_criteria, missing_criteria, required_skills_missing, candidate_profile } = explanation;

  return (
    <div style={{ padding: "14px 16px", borderTop: "1px solid #f0f0f0", background: "#fafafa" }}>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Matched", value: summary.matched, bg: "#f0fdf4", color: "#16a34a" },
          { label: "Partial",  value: summary.partial,  bg: "#fffbeb", color: "#d97706" },
          { label: "Missing",  value: summary.missing,  bg: "#fef2f2", color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: s.bg, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ color: s.color }}>{s.label}</span>
          </div>
        ))}
        {summary.match_rate !== null && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center" }}>
            {summary.match_rate}% criteria met
          </div>
        )}
      </div>

      {/* Progress bar */}
      {summary.total_criteria > 0 && (
        <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", marginBottom: 14, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${(summary.matched / summary.total_criteria) * 100}%`, background: "#16a34a", transition: "width 0.3s" }} />
          <div style={{ width: `${(summary.partial / summary.total_criteria) * 100}%`, background: "#f59e0b" }} />
        </div>
      )}

      {/* Required skills missing — most actionable */}
      {required_skills_missing.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Required skills missing
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {required_skills_missing.map((s) => (
              <span key={s} style={{ fontSize: 11, background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 4, border: "1px solid #fecaca" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Matched */}
      {matched_criteria.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Matched ({matched_criteria.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {matched_criteria.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12 }}>
                <span style={{ color: "#16a34a", fontSize: 14, lineHeight: "18px" }}>✓</span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#374151" }}>{c.criterion}</span>
                  {c.match === "semantic" && (
                    <span style={{ display: "block", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>via related skill in ontology</span>
                  )}
                  {c.candidate_years !== undefined && c.required_years !== undefined && (
                    <span style={{ display: "block", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{c.candidate_years}y / {c.required_years}y req</span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: WEIGHT_COLOR[c.weight] ?? "#6b7280", flexShrink: 0 }}>{c.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partial */}
      {partial_criteria.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#d97706", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Partial match ({partial_criteria.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {partial_criteria.map((c, i) => {
              const whyPartial = c.type === "experience" && c.candidate_years !== undefined && c.required_years !== undefined
                ? `${c.candidate_years}y of ${c.required_years}y required`
                : c.type === "skill" && c.match === "partial"
                ? "substring overlap — not an exact skill match"
                : c.match === "partial" ? "partially met" : undefined;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12 }}>
                  <span style={{ color: "#d97706", fontSize: 14, lineHeight: "18px" }}>~</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: "#374151" }}>{c.criterion}</span>
                    {whyPartial && (
                      <span style={{ display: "block", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>why: {whyPartial}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: WEIGHT_COLOR[c.weight] ?? "#6b7280", flexShrink: 0 }}>{c.weight}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing — required */}
      {missing_criteria.filter(c => c.required).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Missing — required ({missing_criteria.filter(c => c.required).length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {missing_criteria.filter(c => c.required).map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "#dc2626", fontSize: 14 }}>✕</span>
                <span style={{ color: "#374151", flex: 1 }}>{c.criterion}</span>
                <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: WEIGHT_COLOR[c.weight] ?? "#6b7280" }}>{c.weight}</span>
                {c.candidate_years !== undefined && c.required_years !== undefined && (
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{c.candidate_years}y / {c.required_years}y req</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing — optional */}
      {missing_criteria.filter(c => !c.required).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Missing — optional ({missing_criteria.filter(c => !c.required).length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {missing_criteria.filter(c => !c.required).map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "#9ca3af", fontSize: 14 }}>–</span>
                <span style={{ color: "#6b7280", flex: 1 }}>{c.criterion}</span>
                <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: WEIGHT_COLOR[c.weight] ?? "#6b7280" }}>{c.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Candidate profile summary */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#6b7280" }}>
        {candidate_profile.total_years_experience != null && (
          <span>{candidate_profile.total_years_experience} yrs experience</span>
        )}
        {candidate_profile.highest_degree && (
          <span>{candidate_profile.highest_degree}</span>
        )}
        <span>{candidate_profile.skill_count} skills on profile</span>
      </div>
    </div>
  );
}

// ── Interview Kit section ─────────────────────────────────────────────────────

function InterviewKitSection({ candidateId }: { candidateId: string }) {
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["candidate-applications", candidateId],
    queryFn: () => candidatesApi.getApplications(candidateId),
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobId = selectedJobId ?? applications[0]?.job_id ?? null;

  if (isLoading) return <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</p>;

  if (!applications.length) return (
    <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>
      No applications found — interview kit unavailable
    </p>
  );

  return (
    <div style={{ background: "#0f172a", borderRadius: 12, padding: "16px 14px" }}>
      {applications.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <select
            value={jobId ?? ""}
            onChange={(e) => setSelectedJobId(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 12, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, outline: "none", background: "#1e293b", color: "#fff", width: "100%" }}
          >
            {applications.map((a: any) => (
              <option key={a.job_id} value={a.job_id}>{a.job_title}</option>
            ))}
          </select>
        </div>
      )}
      {jobId && <InterviewKitPanel candidateId={candidateId} jobId={jobId} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [resumeLoading, setResumeLoading] = useState(false);
  const [showKit, setShowKit] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => candidatesApi.delete(id),
    onSuccess: () => {
      toast.success("Candidate deleted");
      router.back();
    },
    onError: () => toast.error("Failed to delete candidate"),
  });

  const { data: candidate, isLoading, error } = useQuery({
    queryKey: ["candidate-profile", id],
    queryFn: () => candidatesApi.get(id),
    enabled: !!id,
  });

  const handleViewResume = async () => {
    setResumeLoading(true);
    try {
      const { url } = await candidatesApi.getResumeUrl(id);
      window.open(url, "_blank");
    } catch {
      alert("Resume file not available");
    } finally {
      setResumeLoading(false);
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  if (error || !candidate) {
    return (
      <div style={{ padding: "48px 40px", maxWidth: 860 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px" }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: 14 }}>Candidate not found or failed to load.</span>
        </div>
        <button onClick={() => router.back()} style={{ marginTop: 16, fontSize: 13, color: "#4f46e5", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={13} /> Go back
        </button>
      </div>
    );
  }

  const pd = candidate.parsed_data as any ?? {};
  const skills: string[] = pd.normalized_skills ?? pd.skills ?? [];
  const inferred: string[] = pd.normalized_inferred ?? pd.inferred_skills ?? [];
  const skillDetails: any[] = pd.skill_details ?? [];
  const experience: any[] = pd.experience ?? [];
  const education: any[] = pd.education ?? [];
  const certifications: string[] = pd.certifications ?? [];
  const projects: any[] = pd.projects ?? [];
  const totalYears: number | null = pd.total_years_experience ?? null;
  const highestDegree: string | null = pd.highest_degree ?? null;
  const methodMap: Record<string, string> = {};
  skillDetails.forEach((d: any) => { methodMap[d.canonical] = d.method; });
  const scoreInfo = scoreColor(candidate.parsing_confidence);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 920 }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "#6b7280" }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ color: "#374151", fontWeight: 500 }}>{candidate.full_name ?? "Candidate Profile"}</span>
      </div>

      {/* Profile header card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22, fontWeight: 700, color: "#4f46e5" }}>
              {candidate.full_name ? candidate.full_name.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>
                {candidate.full_name ?? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Name not extracted</span>}
              </h1>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
                {candidate.email && (
                  <a href={`mailto:${candidate.email}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", textDecoration: "none" }}>
                    <Mail size={13} color="#9ca3af" /> {candidate.email}
                  </a>
                )}
                {candidate.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} color="#9ca3af" /> {candidate.phone}</span>}
                {candidate.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} color="#9ca3af" /> {candidate.location}</span>}
                {candidate.linkedin_url && (
                  <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: "#4f46e5", textDecoration: "none" }}>
                    <Linkedin size={13} /> LinkedIn
                  </a>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {totalYears != null && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#374151", padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>{totalYears} yrs experience</span>}
                {highestDegree && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#374151", padding: "2px 10px", borderRadius: 20 }}>{highestDegree}</span>}
                {pd.is_scanned && <span style={{ fontSize: 11, background: "#fef9f0", color: "#d97706", padding: "2px 10px", borderRadius: 20 }}>Scanned PDF</span>}
                {pd.page_count > 0 && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 10px", borderRadius: 20 }}>{pd.page_count} page{pd.page_count !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <div style={{ textAlign: "center", background: scoreInfo.bg, borderRadius: 12, padding: "10px 18px", minWidth: 80 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: scoreInfo.color, lineHeight: 1 }}>
                {candidate.parsing_confidence != null ? Math.round(candidate.parsing_confidence * 100) : "—"}
              </div>
              <div style={{ fontSize: 10, color: scoreInfo.color, fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {candidate.parsing_confidence != null ? "Confidence" : "Not scored"}
              </div>
            </div>
            <button
              onClick={handleViewResume}
              disabled={resumeLoading || !candidate.parsed_data}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: !candidate.parsed_data ? 0.5 : 1 }}
            >
              <FileText size={13} /> {resumeLoading ? "Loading…" : "View Resume"}
            </button>
            <button
              onClick={() => setShowKit(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, background: showKit ? "#eef2ff" : "#fff", color: "#4f46e5", border: "1px solid #e0e7ff", borderRadius: 8, cursor: "pointer" }}
            >
              <ClipboardList size={13} /> Interview Kit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete ${candidate.full_name ?? "this candidate"}? This cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer" }}
            >
              <Trash2 size={13} /> {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
        {candidate.parsing_errors && candidate.parsing_errors.length > 0 && (
          <div style={{ marginTop: 14, background: "#fef9f0", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{candidate.parsing_errors.join(" · ")}</span>
          </div>
        )}
      </div>

      {/* Interview Kit panel — toggled from header */}
      {showKit && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e0e7ff", padding: 20, marginBottom: 16 }}>
          <SectionHeader icon={ClipboardList} title="Interview Kit" />
          <InterviewKitSection candidateId={id} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Skills */}
          {(skills.length > 0 || inferred.length > 0) && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <SectionHeader icon={Award} title="Skills" count={skills.length + inferred.length} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {skills.map((s) => (
                  <span key={s} title={methodMap[s] && methodMap[s] !== "exact" ? `normalized via ${methodMap[s]}` : s}
                    style={{ fontSize: 12, background: "#eef2ff", color: "#4f46e5", padding: "4px 10px", borderRadius: 6, fontWeight: 500, borderBottom: methodMap[s] === "alias" || methodMap[s] === "partial" ? "2px dashed #a5b4fc" : "none" }}>
                    {s}
                  </span>
                ))}
                {inferred.map((s) => (
                  <span key={s} title="inferred from experience" style={{ fontSize: 12, background: "#f0fdf4", color: "#16a34a", padding: "4px 10px", borderRadius: 6, fontWeight: 500 }}>
                    {s} <span style={{ fontSize: 10 }}>✦</span>
                  </span>
                ))}
              </div>
              {inferred.length > 0 && <p style={{ fontSize: 10, color: "#9ca3af", margin: "8px 0 0" }}>✦ inferred from experience · dashed = normalized alias</p>}
            </div>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <SectionHeader icon={Briefcase} title="Experience" count={experience.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {experience.map((e: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 14, paddingBottom: i < experience.length - 1 ? 20 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4f46e5", border: "2px solid #eef2ff", marginTop: 4 }} />
                      {i < experience.length - 1 && <div style={{ width: 2, flex: 1, background: "#e5e7eb", marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 2px" }}>{e.title}</p>
                      <p style={{ fontSize: 13, color: "#4f46e5", fontWeight: 500, margin: "0 0 2px" }}>{e.company}</p>
                      {(e.start_date || e.end_date) && <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 8px" }}>{e.start_date ?? "?"} – {e.end_date ?? "present"}</p>}
                      {e.responsibilities?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {e.responsibilities.map((r: string, j: number) => (
                            <li key={j} style={{ fontSize: 12, color: "#6b7280", marginBottom: 3, lineHeight: 1.5 }}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <SectionHeader icon={FolderOpen} title="Projects" count={projects.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {projects.map((p: any, i: number) => (
                  <div key={i} style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 14px" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{p.name}</p>
                    {p.description && <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.6 }}>{p.description}</p>}
                    {p.technologies?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.technologies.map((t: string, j: number) => (
                          <span key={j} style={{ fontSize: 11, background: "#e0e7ff", color: "#4338ca", padding: "2px 7px", borderRadius: 4 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
            <SectionHeader icon={Paperclip} title="Documents" />
            <DocumentsPanel candidateId={id} />
          </div>

          {/* Notes */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
            <SectionHeader icon={StickyNote} title="Notes" />
            <NotesPanel candidateId={id} />
          </div>

          {/* Application History */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
            <SectionHeader icon={Clock} title="Application History" />
            <ApplicationHistoryPanel candidateId={id} />
          </div>

        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Tags */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
            <SectionHeader icon={Tag} title="Tags" />
            <TagsPanel candidateId={id} />
          </div>

          {/* Education */}
          {(education.length > 0 || highestDegree) && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <SectionHeader icon={GraduationCap} title="Education" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {education.map((e: any, i: number) => (
                  <div key={i} style={{ borderLeft: "3px solid #e0e7ff", paddingLeft: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>{e.degree}{e.field ? ` in ${e.field}` : ""}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{e.institution}</p>
                    {e.end_date && <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{e.end_date}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <SectionHeader icon={Award} title="Certifications" count={certifications.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {certifications.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: "7px 10px" }}>
                    <span style={{ fontSize: 14 }}>🏅</span> {c}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div style={{ padding: "32px 40px", maxWidth: 920 }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <Skeleton w={56} h={56} radius={16} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton w="60%" h={22} />
            <Skeleton w="40%" h={14} />
            <Skeleton w="30%" h={14} />
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[120, 200, 160, 80, 100].map((h, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <Skeleton w="30%" h={14} />
              <div style={{ marginTop: 12 }}><Skeleton w="100%" h={h} /></div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[60, 100, 80].map((h, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20 }}>
              <Skeleton w="40%" h={14} />
              <div style={{ marginTop: 12 }}><Skeleton w="100%" h={h} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
