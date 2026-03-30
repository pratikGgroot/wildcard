"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Clock, MapPin, Building2, Briefcase, Calendar, Users, ChevronRight, Sparkles, Pencil, BookmarkPlus, UserCheck, ExternalLink, AlertTriangle, Copy } from "lucide-react";
import Link from "next/link";

import { jobsApi, criteriaApi, resumesApi, duplicatesApi, fitScoreApi, candidatesApi, type JobStatus } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { AssignmentManager } from "@/components/jobs/assignment-manager";
import { ActivateJobModal } from "@/components/jobs/activate-job-modal";
import { CriteriaPanel } from "@/components/jobs/criteria-panel";
import { EditJobModal } from "@/components/jobs/edit-job-modal";
import { SaveTemplateModal } from "@/components/jobs/save-template-modal";
import { ParsingErrorsPanel } from "@/components/jobs/parsing-errors-panel";
import { DuplicatesPanel } from "@/components/jobs/duplicates-panel";
import ShortlistPanel from "@/components/jobs/shortlist-panel";
import PipelinePanel from "@/components/jobs/pipeline-panel";
import { ResumeUploadPanel } from "@/components/jobs/resume-upload-panel";

const STATUS: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft:  { label: "Draft",  bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af" },
  active: { label: "Active", bg: "#ecfdf5", color: "#059669", dot: "#10b981" },
  paused: { label: "Paused", bg: "#fffbeb", color: "#d97706", dot: "#f59e0b" },
  closed: { label: "Closed", bg: "#fef2f2", color: "#dc2626", dot: "#ef4444" },
};

const ACTIONS: Record<string, { label: string; next: JobStatus; bg: string; color: string }[]> = {
  draft:  [{ label: "Activate Job", next: "active", bg: "#4f46e5", color: "#fff" }],
  active: [
    { label: "Pause",     next: "paused", bg: "#fff",    color: "#374151" },
    { label: "Close Job", next: "closed", bg: "#dc2626", color: "#fff" },
  ],
  paused: [
    { label: "Re-activate", next: "active", bg: "#4f46e5", color: "#fff" },
    { label: "Close Job",   next: "closed", bg: "#dc2626", color: "#fff" },
  ],
  closed: [],
};

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const tabStyle = (active: boolean) => ({
  display: "flex", alignItems: "center", gap: 6,
  padding: "7px 16px", fontSize: 13, fontWeight: active ? 600 : 400,
  borderRadius: 8, border: "none", cursor: "pointer",
  background: active ? "#4f46e5" : "transparent",
  color: active ? "#fff" : "#6b7280",
  transition: "all 0.15s",
} as React.CSSProperties);

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [tab, setTab] = useState<"description" | "criteria" | "candidates" | "shortlist" | "pipeline" | "team" | "history" | "errors" | "duplicates" | "interview-kits" | "resumes">("description");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => jobsApi.get(id),
  });

  const { data: bulkStatus } = useQuery({
    queryKey: ["resume-bulk-status", id],
    queryFn: () => resumesApi.getBulkStatus(id),
    enabled: !!id,
    staleTime: 10_000,
  });

  const { data: duplicateFlags = [] } = useQuery({
    queryKey: ["duplicates", id],
    queryFn: () => duplicatesApi.listForJob(id),
    enabled: !!id,
    staleTime: 30_000,
  });

  // Hoist rankings here so both Candidates and Pipeline share the same data
  const { data: rankings = [] } = useQuery({
    queryKey: ["fit-rankings", id, "fit"],
    queryFn: () => fitScoreApi.getRankings(id, "fit"),
    enabled: !!id,
    staleTime: 0,
  });

  const statusMutation = useMutation({
    mutationFn: ({ next, reason }: { next: JobStatus; reason?: string }) =>
      jobsApi.changeStatus(id, next, reason),
    onSuccess: (updated) => {
      toast.success(`Job is now ${updated.status}`);
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setCloseModalOpen(false);
      setCloseReason("");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Status change failed"),
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e0e7ff", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!job) return null;

  const s = STATUS[job.status] ?? STATUS.draft;
  const actions = ACTIONS[job.status] ?? [];
  const candidateCount = bulkStatus?.completed ?? 0;
  const duplicateCount = duplicateFlags.length;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "#6b7280" }}>
        <Link href="/jobs" style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", textDecoration: "none" }}>
          <ArrowLeft size={13} /> Job Postings
        </Link>
        <ChevronRight size={12} color="#d1d5db" />
        <span style={{ color: "#374151", fontWeight: 500 }}>{job.title}</span>
      </div>

      {/* Header card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Briefcase size={22} color="#4f46e5" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>{job.title}</h1>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
                  {s.label}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: "#6b7280", flexWrap: "wrap" }}>
                {job.department && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={13} color="#9ca3af" /> {job.department}</span>}
                {job.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} color="#9ca3af" /> {job.location}</span>}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} color="#9ca3af" /> Posted {timeAgo(job.created_at)}</span>
                <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const }}>{job.type}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            {job.status === "active" && (
              <Link
                href={`/careers/${job.id}`}
                target="_blank"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, textDecoration: "none" }}
              >
                <ExternalLink size={12} /> Public Page
              </Link>
            )}
            {job.status !== "closed" && (
              <button onClick={() => setEditModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>
                <Pencil size={12} /> Edit
              </button>
            )}
            <button onClick={() => setSaveTemplateOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>
              <BookmarkPlus size={12} /> Template
            </button>
            {actions.map((a) => (
              <button
                key={a.next}
                onClick={() => {
                  if (a.next === "active") { setActivateModalOpen(true); return; }
                  if (a.next === "closed") { setCloseModalOpen(true); return; }
                  statusMutation.mutate({ next: a.next });
                }}
                disabled={statusMutation.isPending}
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: a.bg, color: a.color, border: a.bg === "#fff" ? "1px solid #d1d5db" : "none", borderRadius: 8, cursor: "pointer", boxShadow: a.bg !== "#fff" ? "0 1px 3px rgba(0,0,0,0.15)" : "none" }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {job.status === "closed" && job.close_reason && (
          <div style={{ marginTop: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
            <strong>Close reason:</strong> {job.close_reason}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 4, marginBottom: 16, width: "fit-content", alignItems: "center" }}>
        {([
          { key: "description", label: "Description",                                                    icon: Briefcase, dot: false },
          { key: "criteria",    label: "AI Criteria",                                                    icon: Sparkles,  dot: false },
          { key: "candidates",  label: `Candidates${candidateCount > 0 ? ` (${candidateCount})` : ""}`, icon: UserCheck, dot: false },
          { key: "resumes",     label: "Resumes",                                                          icon: Briefcase, dot: false },
          { key: "shortlist",   label: "AI Shortlist",                                                     icon: Sparkles,  dot: false },
          { key: "pipeline",    label: "Pipeline",                                                       icon: Users,     dot: false },
          { key: "team",        label: `Team (${job.assignments.length})`,                               icon: Users,     dot: false },
        ] as const).map(({ key, label, icon: Icon, dot }) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...tabStyle(tab === key), position: "relative" }}>
            <Icon size={13} />
            {label}
            {dot && <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", border: "1px solid #fff" }} />}
          </button>
        ))}

        {/* ── More dropdown ── */}
        <div ref={moreRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMoreOpen(o => !o)}
            style={{
              ...tabStyle(["history", "errors", "duplicates"].includes(tab)),
              position: "relative",
              gap: 4,
            }}
          >
            ···
            {/* dot if duplicates has items or a utility tab is active */}
            {(duplicateCount > 0 || ["history", "errors", "duplicates"].includes(tab)) && (
              <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: duplicateCount > 0 ? "#f59e0b" : "#4f46e5", border: "1px solid #fff" }} />
            )}
          </button>
          {moreOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)", padding: 4, minWidth: 160,
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              {([
                { key: "history",    label: "History",     icon: Clock,         dot: false },
                { key: "errors",     label: "Parse Errors", icon: AlertTriangle, dot: false },
                { key: "duplicates", label: `Duplicates${duplicateCount > 0 ? ` (${duplicateCount})` : ""}`, icon: Copy, dot: duplicateCount > 0 },
              ] as const).map(({ key, label, icon: Icon, dot }) => (
                <button
                  key={key}
                  onClick={() => { setTab(key); setMoreOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                    fontSize: 13, fontWeight: tab === key ? 600 : 400,
                    background: tab === key ? "#eef2ff" : "transparent",
                    color: tab === key ? "#4f46e5" : "#374151",
                    border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left",
                    position: "relative",
                  }}
                >
                  <Icon size={13} />
                  {label}
                  {dot && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: 24 }}>
        {tab === "description" && (
          <div>
            {job.status !== "closed" && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button onClick={() => setEditModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#4f46e5", background: "#eef2ff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>
                  <Pencil size={11} /> Edit description
                </button>
              </div>
            )}
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#374151" }} dangerouslySetInnerHTML={{ __html: job.description }} />
          </div>
        )}
        {tab === "criteria"   && <CriteriaPanel jobId={job.id} />}
        {tab === "candidates" && <CandidatesPanel jobId={job.id} rankings={rankings} />}
        {tab === "resumes"    && <ResumeUploadPanel jobId={job.id} />}
        {tab === "shortlist"  && <ShortlistPanel jobId={job.id} />}
        {tab === "pipeline"   && <PipelinePanel jobId={job.id} rankings={rankings} />}
        {tab === "team"       && <AssignmentManager jobId={job.id} assignments={job.assignments} readonly={job.status === "closed"} />}
        {tab === "history"    && <StatusHistory jobId={id} />}
        {tab === "errors"     && <ParsingErrorsPanel jobId={job.id} />}
        {tab === "duplicates" && <DuplicatesPanel jobId={job.id} />}
      </div>

      {activateModalOpen && job && <ActivateJobModal jobId={job.id} jobTitle={job.title} assignments={job.assignments} onClose={() => setActivateModalOpen(false)} onActivated={() => setActivateModalOpen(false)} />}
      {editModalOpen     && job && <EditJobModal job={job} onClose={() => setEditModalOpen(false)} />}
      {saveTemplateOpen  && job && <SaveTemplateModal jobId={job.id} jobTitle={job.title} onClose={() => setSaveTemplateOpen(false)} />}

      <Modal open={closeModalOpen} title="Close Job Posting" onClose={() => setCloseModalOpen(false)}>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Please provide a reason for closing this job posting.</p>
        <textarea
          rows={3}
          placeholder="e.g. Position filled, budget freeze..."
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none", resize: "none", boxSizing: "border-box" as const }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => setCloseModalOpen(false)} style={{ padding: "7px 14px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => { if (!closeReason.trim()) { toast.error("Please provide a close reason"); return; } statusMutation.mutate({ next: "closed", reason: closeReason.trim() }); }}
            disabled={!closeReason.trim() || statusMutation.isPending}
            style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: !closeReason.trim() ? 0.5 : 1 }}
          >
            Close Job
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Candidates panel ──────────────────────────────────────────────────────────
function CandidatesPanel({ jobId, rankings }: { jobId: string; rankings: import("@/lib/api").CandidateRanking[] }) {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"fit" | "technical" | "culture" | "growth">("fit");

  const { data: bulkStatus, isLoading } = useQuery({
    queryKey: ["resume-bulk-status", jobId],
    queryFn: () => resumesApi.getBulkStatus(jobId),
    staleTime: 5000,
  });

  // Use sortBy-specific rankings only when non-fit sort is selected
  const { data: sortedRankings = rankings } = useQuery({
    queryKey: ["fit-rankings", jobId, sortBy],
    queryFn: () => fitScoreApi.getRankings(jobId, sortBy),
    staleTime: 0,
    enabled: sortBy !== "fit", // "fit" is already provided by parent
  });

  const activeRankings = sortBy === "fit" ? rankings : sortedRankings;

  // Poll recalculation status every 4s when running/pending
  const { data: recalcStatus } = useQuery({
    queryKey: ["recalc-status", jobId],
    queryFn: () => fitScoreApi.getRecalculationStatus(jobId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "running" || s === "pending" ? 4000 : false;
    },
    staleTime: 0,
  });

  const recalcMutation = useMutation({
    mutationFn: () => fitScoreApi.triggerRecalculation(jobId),
    onSuccess: () => {
      toast.success("Score recalculation queued");
      queryClient.invalidateQueries({ queryKey: ["recalc-status", jobId] });
    },
    onError: () => toast.error("Failed to trigger recalculation"),
  });

  const reparseMutation = useMutation({
    mutationFn: (uploadId: string) => resumesApi.reParse(jobId, uploadId),
    onSuccess: () => {
      toast.success("Re-parse queued");
      queryClient.invalidateQueries({ queryKey: ["resume-bulk-status", jobId] });
    },
    onError: () => toast.error("Failed to queue re-parse"),
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: (uploadId: string) => resumesApi.deleteUpload(jobId, uploadId),
    onSuccess: () => {
      toast.success("Candidate deleted");
      queryClient.invalidateQueries({ queryKey: ["resume-bulk-status", jobId] });
      queryClient.invalidateQueries({ queryKey: ["fit-rankings", jobId] });
    },
    onError: () => toast.error("Failed to delete candidate"),
  });

  const scoreAllMutation = useMutation({
    mutationFn: () => fitScoreApi.scoreAll(jobId),
    onSuccess: (res) => {
      toast.success(`Scored ${res.scored} candidate${res.scored !== 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["fit-rankings", jobId, "fit"] });
    },
    onError: () => toast.error("Scoring failed"),
  });

  if (isLoading) return <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading...</p>;

  if (!bulkStatus || bulkStatus.total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <UserCheck size={22} color="#9ca3af" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>No candidates yet</p>
        <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px" }}>
          Candidates apply via the public job page and their resumes are parsed automatically.
        </p>
        <Link
          href={`/careers/${jobId}`}
          target="_blank"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#4f46e5", background: "#eef2ff", border: "none", borderRadius: 8, padding: "8px 16px", textDecoration: "none" }}
        >
          <ExternalLink size={13} /> View public job page
        </Link>
      </div>
    );
  }

  // Build a map from candidate_id → full ranking object for quick lookup
  const rankingMap: Record<string, typeof activeRankings[0]> = {};
  activeRankings.forEach((r) => { rankingMap[r.candidate_id] = r; });

  const completedCount = bulkStatus.uploads.filter((u) => u.status === "completed").length;
  const isRecalculating = recalcStatus?.status === "running" || recalcStatus?.status === "pending";

  // Check if any ranking has multi-dim scores
  const hasMultiDim = activeRankings.some((r) => r.technical_score !== null);

  return (
    <div>
      {/* Recalculation banner */}
      {isRecalculating && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #d97706", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <span style={{ color: "#92400e", flex: 1 }}>
            Scores are being recalculated
            {recalcStatus.total > 0 && ` — ${recalcStatus.scored} / ${recalcStatus.total} done`}
          </span>
          {recalcStatus.progress_pct > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>{recalcStatus.progress_pct}%</span>
          )}
        </div>
      )}
      {recalcStatus?.status === "completed" && recalcStatus.completed_at && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "#166534" }}>
          <span>✓</span>
          <span>Scores recalculated — {recalcStatus.scored} candidate{recalcStatus.scored !== 1 ? "s" : ""} updated</span>
        </div>
      )}
      {/* Stats + Score All button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Total",   value: bulkStatus.total,     bg: "#f9fafb", color: "#374151" },
            { label: "Parsed",  value: bulkStatus.completed, bg: "#f0fdf4", color: "#16a34a" },
            { label: "Parsing", value: bulkStatus.parsing,   bg: "#fdf4ff", color: "#9333ea" },
            { label: "Failed",  value: bulkStatus.failed,    bg: "#fef2f2", color: "#dc2626" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "8px 16px", borderRadius: 10, background: s.bg, border: "1px solid #e5e7eb", minWidth: 72, textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>
        {completedCount > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Dimension sort — only shown when multi-dim scores exist */}
            {hasMultiDim && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 7, outline: "none", background: "#fff", color: "#374151" }}
              >
                <option value="fit">Sort: Overall Fit</option>
                <option value="technical">Sort: Technical</option>
                <option value="culture">Sort: Culture</option>
                <option value="growth">Sort: Growth</option>
              </select>
            )}
            <button
              onClick={() => scoreAllMutation.mutate()}
              disabled={scoreAllMutation.isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: scoreAllMutation.isPending ? 0.7 : 1 }}
            >
              <Sparkles size={13} /> {scoreAllMutation.isPending ? "Scoring…" : "Score All"}
            </button>
            <button
              onClick={() => recalcMutation.mutate()}
              disabled={recalcMutation.isPending || isRecalculating}
              title="Re-embed job and recompute all fit scores"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", opacity: (recalcMutation.isPending || isRecalculating) ? 0.6 : 1 }}
            >
              ↻ Recalculate
            </button>
          </div>
        )}
      </div>

      {/* Candidate rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bulkStatus.uploads.map((u) => {
          const ranking = u.candidate_id ? rankingMap[u.candidate_id] : undefined;
          const fitScore = ranking?.fit_score;
          const isOverridden = ranking?.is_overridden ?? false;
          return (
            <div
              key={u.id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3f4f6" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserCheck size={15} color="#4f46e5" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.applicant_name ?? u.file_name ?? "Applicant"}
                </p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                  {u.applicant_email ? `${u.applicant_email} · ` : ""}
                  {new Date(u.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {u.file_size_bytes ? ` · ${(u.file_size_bytes / 1024).toFixed(0)} KB` : ""}
                </p>
              </div>

              {/* Fit score badge with override indicator */}
              {fitScore !== undefined ? (
                <div
                  title={isOverridden ? `AI score: ${ranking?.original_ai_score?.toFixed(0)} · Manually adjusted` : undefined}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    background: fitScore >= 70 ? "#ecfdf5" : fitScore >= 40 ? "#fffbeb" : "#fef2f2",
                    borderRadius: 8, padding: "4px 10px", minWidth: 52, flexShrink: 0,
                    outline: isOverridden ? "2px solid #d97706" : "none",
                  }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: fitScore >= 70 ? "#059669" : fitScore >= 40 ? "#d97706" : "#dc2626", lineHeight: 1 }}>
                    {fitScore.toFixed(0)}
                  </span>
                  <span style={{ fontSize: 9, color: fitScore >= 70 ? "#059669" : fitScore >= 40 ? "#d97706" : "#dc2626", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {isOverridden ? "adj" : "fit"}
                  </span>
                </div>
              ) : (
                <div style={{ width: 52, flexShrink: 0 }} />
              )}

              {/* Multi-dim mini badges */}
              {ranking && hasMultiDim && (ranking.technical_score !== null || ranking.culture_score !== null || ranking.growth_score !== null) && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {[
                    { key: "T", val: ranking.technical_score, color: "#4f46e5" },
                    { key: "C", val: ranking.culture_score,   color: "#059669" },
                    { key: "G", val: ranking.growth_score,    color: "#d97706" },
                  ].map(({ key, val, color }) => val !== null ? (
                    <div key={key} title={`${key === "T" ? "Technical" : key === "C" ? "Culture" : "Growth"}: ${val}`}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 6px", minWidth: 30 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1 }}>{val.toFixed(0)}</span>
                      <span style={{ fontSize: 8, color: "#9ca3af", fontWeight: 600 }}>{key}</span>
                    </div>
                  ) : null)}
                </div>
              )}

              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                background: u.status === "completed" ? "#f0fdf4" : u.status === "failed" ? "#fef2f2" : "#fdf4ff",
                color: u.status === "completed" ? "#16a34a" : u.status === "failed" ? "#dc2626" : "#9333ea",
              }}>
                {u.status === "completed" ? "Parsed" : u.status === "failed" ? "Failed" : "Processing"}
              </span>
              {u.status === "completed" && u.candidate_id && (
                <Link
                  href={`/candidates/${u.candidate_id}`}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#4f46e5", background: "#eef2ff", padding: "4px 10px", borderRadius: 6, textDecoration: "none", flexShrink: 0 }}
                >
                  <ExternalLink size={11} /> Profile
                </Link>
              )}
              <button
                  onClick={() => {
                    if (confirm(`Delete ${u.applicant_name ?? "this candidate"}? This cannot be undone.`)) {
                      deleteCandidateMutation.mutate(u.id);
                    }
                  }}
                  disabled={deleteCandidateMutation.isPending}
                  title="Delete candidate"
                  style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#dc2626", cursor: "pointer", flexShrink: 0 }}
                >
                  ✕
                </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Status history ────────────────────────────────────────────────────────────
function StatusHistory({ jobId }: { jobId: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["job-history", jobId],
    queryFn: () =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/jobs/${jobId}/status-history`)
        .then((r) => r.json()),
  });

  if (isLoading) return <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading...</p>;

  if (!history.length) {
    return (
      <div style={{ textAlign: "center", padding: 32 }}>
        <Clock size={24} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
        <p style={{ fontSize: 13, color: "#9ca3af" }}>No history yet</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 20 }}>
      <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "#e5e7eb" }} />
      {history.map((h: any) => (
        <div key={h.id} style={{ position: "relative", marginBottom: 20 }}>
          <div style={{ position: "absolute", left: -20, top: 4, width: 14, height: 14, borderRadius: "50%", background: "#eef2ff", border: "2px solid #a5b4fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4f46e5" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
            {h.from_status && <span style={{ color: "#6b7280", fontWeight: 400 }}>{h.from_status} → </span>}
            <span style={{ textTransform: "capitalize" as const }}>{h.to_status}</span>
          </div>
          {h.reason && <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{h.reason}</p>}
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{new Date(h.changed_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
