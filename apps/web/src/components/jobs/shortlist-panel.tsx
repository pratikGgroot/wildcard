"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shortlistApi, type Shortlist, type ShortlistCandidate, type NearMissCandidate, type FeedbackStats } from "@/lib/api";
import Link from "next/link";

interface Props {
  jobId: string;
}

const CONFIDENCE_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  High:   { bg: "#f0fdf4", color: "#16a34a", dot: "#22c55e" },
  Medium: { bg: "#fffbeb", color: "#d97706", dot: "#f59e0b" },
  Low:    { bg: "#fef2f2", color: "#dc2626", dot: "#ef4444" },
};

const ACTION_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  accepted: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Accepted" },
  rejected: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "Rejected" },
  deferred: { bg: "#fafafa", color: "#6b7280", border: "#e5e7eb", label: "On Hold" },
};

export default function ShortlistPanel({ jobId }: Props) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customN, setCustomN] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const { data: shortlist, isLoading } = useQuery<Shortlist>({
    queryKey: ["shortlist", jobId],
    queryFn: () => shortlistApi.get(jobId),
    refetchInterval: 30000,
  });

  const generateMutation = useMutation({
    mutationFn: (n?: number) => shortlistApi.generate(jobId, n),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shortlist", jobId] }),
  });

  const configMutation = useMutation({
    mutationFn: (n: number) => shortlistApi.updateConfig(jobId, n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shortlist", jobId] }); setCustomN(""); },
  });

  const reasoningMutation = useMutation({
    mutationFn: () => shortlistApi.generateAllReasoning(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shortlist", jobId] }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ scId, action, reason }: { scId: string; action: "accepted" | "rejected" | "deferred"; reason?: string }) =>
      shortlistApi.takeAction(jobId, scId, action, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shortlist", jobId] }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: string; reason?: string }) =>
      shortlistApi.bulkAction(jobId, Array.from(selectedIds), action, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shortlist", jobId] }); setSelectedIds(new Set()); },
  });

  const { data: nearMisses } = useQuery({
    queryKey: ["near-misses", jobId],
    queryFn: () => shortlistApi.getNearMisses(jobId),
    enabled: !!shortlist && shortlist.status !== "not_generated",
  });

  const { data: feedbackStats } = useQuery<FeedbackStats>({
    queryKey: ["feedback-stats", jobId],
    queryFn: () => shortlistApi.getFeedbackStats(jobId),
    enabled: !!shortlist && shortlist.status !== "not_generated",
  });

  const promoteMutation = useMutation({
    mutationFn: (candidateId: string) => shortlistApi.promoteNearMiss(jobId, candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shortlist", jobId] });
      qc.invalidateQueries({ queryKey: ["near-misses", jobId] });
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: () => shortlistApi.optimizeWeights(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-stats", jobId] }),
  });

  const resetWeightsMutation = useMutation({
    mutationFn: () => shortlistApi.resetWeights(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-stats", jobId] }),
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIds.size !== 1) return;
    const scId = Array.from(selectedIds)[0];
    if (e.key === "a" || e.key === "A") actionMutation.mutate({ scId, action: "accepted" });
    if (e.key === "d" || e.key === "D") actionMutation.mutate({ scId, action: "deferred" });
    if (e.key === "r" || e.key === "R") setShowRejectModal(scId);
  }, [selectedIds, actionMutation]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const pendingCandidates = shortlist?.candidates.filter(c => !c.action || c.action === "deferred") ?? [];
  const actionedCandidates = shortlist?.candidates.filter(c => c.action && c.action !== "deferred") ?? [];

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #e0e7ff", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#9ca3af" }}>Loading shortlist…</span>
      </div>
    );
  }

  if (!shortlist || shortlist.status === "not_generated") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
          🎯
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>No shortlist yet</p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, maxWidth: 320 }}>
            Score all candidates first, then generate the AI shortlist to see top-ranked applicants.
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate(undefined)}
          disabled={generateMutation.isPending}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", opacity: generateMutation.isPending ? 0.7 : 1 }}
        >
          {generateMutation.isPending ? (
            <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} /> Generating…</>
          ) : "✨ Generate Shortlist"}
        </button>
      </div>
    );
  }

  const statusInfo = {
    active:   { label: "Active",   bg: "#f0fdf4", color: "#16a34a" },
    outdated: { label: "Outdated", bg: "#fffbeb", color: "#d97706" },
    complete: { label: "Complete", bg: "#eff6ff", color: "#2563eb" },
  }[shortlist.status] ?? { label: shortlist.status, bg: "#f3f4f6", color: "#6b7280" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>AI Shortlist</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: statusInfo.bg, color: statusInfo.color }}>
            {statusInfo.label}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {shortlist.shortlisted_count} of {shortlist.total_candidates_scored} scored
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Top N config */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="number" min={1} max={200} placeholder="Top N"
              value={customN} onChange={e => setCustomN(e.target.value)}
              style={{ width: 72, padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 7, outline: "none" }}
            />
            <button
              onClick={() => customN && configMutation.mutate(parseInt(customN))}
              disabled={!customN || configMutation.isPending}
              style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 7, cursor: "pointer", opacity: !customN ? 0.5 : 1 }}
            >
              Apply
            </button>
          </div>

          {shortlist.status === "outdated" && (
            <button
              onClick={() => generateMutation.mutate(shortlist.threshold_n ?? undefined)}
              disabled={generateMutation.isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 8, cursor: "pointer" }}
            >
              ↻ Refresh
            </button>
          )}

          <button
            onClick={() => reasoningMutation.mutate()}
            disabled={reasoningMutation.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe", borderRadius: 8, cursor: "pointer", opacity: reasoningMutation.isPending ? 0.7 : 1 }}
          >
            {reasoningMutation.isPending ? "Generating…" : "✨ Generate Reasoning"}
          </button>
        </div>
      </div>

      {/* ── Notice banner ── */}
      {shortlist.notice && (
        <div style={{ fontSize: 12, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 14px" }}>
          ℹ️ {shortlist.notice}
        </div>
      )}

      {/* ── Outdated warning ── */}
      {shortlist.status === "outdated" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
          ⚠️ New candidates have been scored since this shortlist was generated. Refresh to update.
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "10px 14px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5", marginRight: 4 }}>{selectedIds.size} selected</span>
          {(["accepted", "rejected", "deferred"] as const).map(action => (
            <button
              key={action}
              onClick={() => action === "rejected" ? setShowRejectModal("bulk") : bulkMutation.mutate({ action })}
              style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer",
                background: action === "accepted" ? "#16a34a" : action === "rejected" ? "#dc2626" : "#2563eb",
                color: "#fff" }}
            >
              {action === "accepted" ? "✓ Accept" : action === "rejected" ? "✗ Reject" : "⏸ Hold"} All
            </button>
          ))}
          <button onClick={() => setSelectedIds(new Set())} style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        </div>
      )}

      {selectedIds.size === 1 && (
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "-8px 0 0" }}>
          Keyboard: <kbd style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>A</kbd> Accept ·{" "}
          <kbd style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>R</kbd> Reject ·{" "}
          <kbd style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>D</kbd> Hold
        </p>
      )}

      {/* ── Pending candidates ── */}
      {pendingCandidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={selectedIds.size === pendingCandidates.length}
              onChange={() => {
                if (selectedIds.size === pendingCandidates.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(pendingCandidates.map(c => c.id)));
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pending Review ({pendingCandidates.length})
            </span>
          </div>
          {pendingCandidates.map(c => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selectedIds.has(c.id)}
              onSelect={() => toggleSelect(c.id)}
              onAction={(action, reason) => {
                if (action === "rejected" && !reason) { setShowRejectModal(c.id); return; }
                actionMutation.mutate({ scId: c.id, action, reason });
              }}
              isPending={actionMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Actioned candidates ── */}
      {actionedCandidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Actioned ({actionedCandidates.length})
          </span>
          {actionedCandidates.map(c => (
            <CandidateCard key={c.id} candidate={c} selected={false} onSelect={() => {}} onAction={() => {}} isPending={false} readonly />
          ))}
        </div>
      )}

      {/* ── Complete banner ── */}
      {shortlist.status === "complete" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 18px", fontSize: 13, fontWeight: 500, color: "#166534" }}>
          <span style={{ fontSize: 18 }}>✅</span>
          All candidates have been actioned. Shortlist complete.
        </div>
      )}

      {/* ── Near-miss section (05.5) ── */}
      {nearMisses && nearMisses.near_misses.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Near Misses ({nearMisses.near_misses.length})
            </span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>within {nearMisses.window} pts of cutoff</span>
          </div>
          {nearMisses.near_misses.map(nm => (
            <NearMissCard
              key={nm.candidate_id}
              candidate={nm}
              onPromote={() => promoteMutation.mutate(nm.candidate_id)}
              isPending={promoteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Feedback / learned weights section (05.4) ── */}
      {feedbackStats && feedbackStats.total_signals > 0 && (
        <div style={{ marginTop: 8, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                {feedbackStats.is_personalized ? "✨ Personalized weights active" : "Feedback signals collected"}
              </span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {feedbackStats.accepted_count} accepted · {feedbackStats.rejected_count} rejected
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {feedbackStats.total_signals >= feedbackStats.min_signals_required && (
                <button
                  onClick={() => optimizeMutation.mutate()}
                  disabled={optimizeMutation.isPending}
                  style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe", borderRadius: 7, cursor: "pointer" }}
                >
                  {optimizeMutation.isPending ? "Optimizing…" : "Optimize weights"}
                </button>
              )}
              <button
                onClick={() => resetWeightsMutation.mutate()}
                disabled={resetWeightsMutation.isPending}
                style={{ padding: "5px 12px", fontSize: 11, color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}
              >
                Reset
              </button>
            </div>
          </div>
          {feedbackStats.total_signals < feedbackStats.min_signals_required && (
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
              {feedbackStats.min_signals_required - feedbackStats.total_signals} more decisions needed to enable weight optimization
            </p>
          )}
          {feedbackStats.learned_weights && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(feedbackStats.learned_weights).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                  {k.replace("_score", "")}: {(v * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Reject modal ── */}
      {showRejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 24, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Rejection Reason</h4>
            <textarea
              rows={3}
              placeholder="Optional — e.g. insufficient experience, skills mismatch…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ padding: "10px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none", resize: "none", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowRejectModal(null); setRejectReason(""); }}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showRejectModal === "bulk") {
                    bulkMutation.mutate({ action: "rejected", reason: rejectReason });
                  } else {
                    actionMutation.mutate({ scId: showRejectModal, action: "rejected", reason: rejectReason });
                  }
                  setShowRejectModal(null);
                  setRejectReason("");
                }}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Candidate Card ─────────────────────────────────────────────────────────────

function CandidateCard({
  candidate: c,
  selected,
  onSelect,
  onAction,
  isPending,
  readonly = false,
}: {
  candidate: ShortlistCandidate;
  selected: boolean;
  onSelect: () => void;
  onAction: (action: "accepted" | "rejected" | "deferred", reason?: string) => void;
  isPending: boolean;
  readonly?: boolean;
}) {
  const conf = CONFIDENCE_STYLE[c.confidence_level] ?? CONFIDENCE_STYLE.Low;
  const act = c.action ? ACTION_STYLE[c.action] : null;

  return (
    <div style={{
      display: "flex", gap: 12, padding: "16px", borderRadius: 12,
      border: `1px solid ${selected ? "#a5b4fc" : "#e5e7eb"}`,
      background: selected ? "#f5f3ff" : "#fff",
      opacity: c.action ? 0.8 : 1,
      transition: "border-color 0.15s, background 0.15s",
    }}>
      {/* Checkbox */}
      {!readonly && (
        <div style={{ paddingTop: 2 }}>
          <input type="checkbox" checked={selected} onChange={onSelect} style={{ cursor: "pointer" }} />
        </div>
      )}

      {/* Rank badge */}
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
        #{c.rank}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Row 1: name + badges + score */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{c.full_name || "Unknown Candidate"}</span>

            {/* Confidence badge */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: conf.bg, color: conf.color }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: conf.dot }} />
              {c.confidence_level}
            </span>

            {/* Action badge */}
            {act && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: act.bg, color: act.color, border: `1px solid ${act.border}` }}>
                {act.label}
              </span>
            )}
          </div>

          {/* Fit score */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            background: c.fit_score >= 70 ? "#f0fdf4" : c.fit_score >= 50 ? "#fffbeb" : "#fef2f2",
            borderRadius: 10, padding: "6px 12px", minWidth: 56, flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: c.fit_score >= 70 ? "#16a34a" : c.fit_score >= 50 ? "#d97706" : "#dc2626" }}>
              {c.fit_score.toFixed(1)}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>fit</span>
          </div>
        </div>

        {/* Row 2: email */}
        {c.email && (
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{c.email}</p>
        )}

        {/* Row 3: dimension scores */}
        {(c.technical_score != null || c.culture_score != null || c.growth_score != null) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { label: "Technical", val: c.technical_score, color: "#4f46e5", bg: "#eef2ff" },
              { label: "Culture",   val: c.culture_score,   color: "#7c3aed", bg: "#f5f3ff" },
              { label: "Growth",    val: c.growth_score,    color: "#059669", bg: "#f0fdf4" },
            ].filter(d => d.val != null).map(d => (
              <span key={d.label} style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: d.bg, color: d.color }}>
                {d.label}: {d.val!.toFixed(0)}
              </span>
            ))}
            {c.total_years_experience != null && (
              <span style={{ fontSize: 11, color: "#6b7280", padding: "3px 8px", borderRadius: 6, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                {c.total_years_experience}y exp
              </span>
            )}
          </div>
        )}

        {/* Row 4: skills */}
        {c.top_skills.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {c.top_skills.map(s => (
              <span key={s} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Row 5: reasoning */}
        {c.reasoning ? (
          <p style={{ fontSize: 12, color: "#4b5563", margin: 0, lineHeight: 1.6, background: "#f9fafb", borderRadius: 8, padding: "8px 12px", borderLeft: "3px solid #c7d2fe" }}>
            {c.reasoning}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: "#d1d5db", margin: 0, fontStyle: "italic" }}>
            Reasoning not generated yet
          </p>
        )}

        {/* Row 6: reject info */}
        {c.rejection_reason && (
          <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>
            Reason: {c.rejection_reason}
          </p>
        )}

        {/* Row 7: view profile link */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link
            href={`/candidates/${c.candidate_id}`}
            style={{ fontSize: 11, fontWeight: 600, color: "#4f46e5", textDecoration: "none" }}
          >
            View Profile →
          </Link>
        </div>
      </div>

      {/* Action buttons — show for pending and on-hold candidates */}
      {!readonly && c.action !== "accepted" && c.action !== "rejected" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <ActionBtn label="✓" title="Accept (A)" bg="#16a34a" onClick={() => onAction("accepted")} disabled={isPending} />
          <ActionBtn label="✗" title="Reject (R)" bg="#dc2626" onClick={() => onAction("rejected")} disabled={isPending} />
          <ActionBtn label="⏸" title="Hold (D)"  bg="#6b7280" onClick={() => onAction("deferred")} disabled={isPending} />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, title, bg, onClick, disabled }: { label: string; title: string; bg: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: bg, color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1, flexShrink: 0 }}
    >
      {label}
    </button>
  );
}

// ── Near Miss Card ─────────────────────────────────────────────────────────────

function NearMissCard({
  candidate: c,
  onPromote,
  isPending,
}: {
  candidate: NearMissCandidate;
  onPromote: () => void;
  isPending: boolean;
}) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "14px 16px", borderRadius: 12,
      border: "1px dashed #d1d5db", background: "#fafafa",
    }}>
      {/* Gap badge */}
      <div style={{
        width: 48, height: 48, borderRadius: 10, background: "#fff7ed",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        flexShrink: 0, border: "1px solid #fed7aa",
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#ea580c", lineHeight: 1 }}>
          -{c.gap_to_threshold.toFixed(1)}
        </span>
        <span style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase" }}>pts</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{c.full_name || "Unknown"}</span>
          <div style={{
            background: c.fit_score >= 50 ? "#fffbeb" : "#fef2f2",
            borderRadius: 8, padding: "4px 10px", flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: c.fit_score >= 50 ? "#d97706" : "#dc2626" }}>
              {c.fit_score.toFixed(1)}
            </span>
            <span style={{ fontSize: 9, color: "#9ca3af", marginLeft: 2 }}>fit</span>
          </div>
        </div>

        {c.email && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{c.email}</p>}

        {c.top_skills.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {c.top_skills.map(s => (
              <span key={s} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, color: "#6b7280", margin: 0, fontStyle: "italic" }}>{c.explanation}</p>
      </div>

      {/* Promote button */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        <button
          onClick={onPromote}
          disabled={isPending}
          title="Add to shortlist"
          style={{
            padding: "6px 12px", fontSize: 11, fontWeight: 600,
            background: "#fff", color: "#4f46e5", border: "1px solid #c7d2fe",
            borderRadius: 8, cursor: "pointer", opacity: isPending ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
