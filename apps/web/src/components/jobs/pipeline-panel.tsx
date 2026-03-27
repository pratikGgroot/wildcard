"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, ChevronRight, Search, X, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  pipelineApi, resumesApi, fitScoreApi,
  type PipelineColumn, type PipelineCandidate, type CandidateRanking, type ResumeUpload,
} from "@/lib/api";

interface Props {
  jobId: string;
  readonly?: boolean;
  rankings?: CandidateRanking[];
}

// Enriched candidate card data
interface EnrichedCandidate extends PipelineCandidate {
  parseStatus: "completed" | "parsing" | "failed" | "queued" | "uploading" | null;
  fitScore: number | null;
  isOverridden: boolean;
  uploadId: string | null;
}

export default function PipelinePanel({ jobId, readonly = false, rankings: externalRankings }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStageId, setBulkStageId] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: columns = [], isLoading: boardLoading } = useQuery({
    queryKey: ["pipeline", jobId],
    queryFn: () => pipelineApi.getBoard(jobId),
    staleTime: 15_000,
  });

  const { data: bulkStatus } = useQuery({
    queryKey: ["resume-bulk-status", jobId],
    queryFn: () => resumesApi.getBulkStatus(jobId),
    staleTime: 10_000,
  });

  // Use parent-provided rankings if available, otherwise fetch own
  const { data: ownRankings = [] } = useQuery({
    queryKey: ["fit-rankings", jobId, "fit"],
    queryFn: () => fitScoreApi.getRankings(jobId, "fit"),
    staleTime: 0,
    enabled: !externalRankings,
  });

  const rankings = externalRankings ?? ownRankings;

  const moveMutation = useMutation({
    mutationFn: ({ candidateId, stageId }: { candidateId: string; stageId: string }) =>
      pipelineApi.moveCandidate(jobId, candidateId, stageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline", jobId] }),
    onError: () => toast.error("Failed to move candidate"),
  });

  const bulkMoveMutation = useMutation({
    mutationFn: ({ candidateIds, stageId }: { candidateIds: string[]; stageId: string }) =>
      pipelineApi.bulkMove(jobId, candidateIds, stageId),
    onSuccess: (res: any) => {
      toast.success(`Moved ${res.moved} candidate${res.moved !== 1 ? "s" : ""}`);
      setSelected(new Set());
      setBulkStageId("");
      queryClient.invalidateQueries({ queryKey: ["pipeline", jobId] });
    },
    onError: () => toast.error("Bulk move failed"),
  });

  const scoreAllMutation = useMutation({
    mutationFn: () => fitScoreApi.scoreAll(jobId),
    onSuccess: (res) => {
      toast.success(`Scored ${res.scored} candidate${res.scored !== 1 ? "s" : ""}`);
      // Invalidate shared rankings key so both Candidates and Pipeline tabs update
      queryClient.invalidateQueries({ queryKey: ["fit-rankings", jobId, "fit"] });
    },
    onError: () => toast.error("Scoring failed"),
  });

  // Build lookup maps
  const rankingMap = useMemo(() => {
    const m: Record<string, CandidateRanking> = {};
    rankings.forEach((r) => { m[r.candidate_id] = r; });
    return m;
  }, [rankings]);

  const uploadByCandidateId = useMemo(() => {
    const m: Record<string, ResumeUpload> = {};
    bulkStatus?.uploads.forEach((u) => { if (u.candidate_id) m[u.candidate_id] = u; });
    return m;
  }, [bulkStatus]);

  // Enrich pipeline columns with parse status + fit score
  const enrichedColumns = useMemo(() => columns.map((col) => ({
    ...col,
    candidates: col.candidates.map((c): EnrichedCandidate => {
      const upload = uploadByCandidateId[c.candidate_id];
      const ranking = rankingMap[c.candidate_id];
      return {
        ...c,
        parseStatus: (upload?.status ?? null) as EnrichedCandidate["parseStatus"],
        fitScore: ranking?.fit_score ?? null,
        isOverridden: ranking?.is_overridden ?? false,
        uploadId: upload?.id ?? null,
      };
    }),
  })), [columns, rankingMap, uploadByCandidateId]);

  // Search filter
  const filteredColumns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedColumns;
    return enrichedColumns.map((col) => ({
      ...col,
      candidates: col.candidates.filter(
        (c) => c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      ),
    }));
  }, [enrichedColumns, search]);

  const totalCandidates = columns.reduce((sum, col) => sum + col.candidates.length, 0);
  const filteredTotal = filteredColumns.reduce((sum, col) => sum + col.candidates.length, 0);
  const hasScores = rankings.some((r) => r.fit_score !== null);

  if (boardLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #e0e7ff", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (totalCandidates === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Users size={22} color="#9ca3af" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>No candidates yet</p>
        <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px" }}>
          Candidates appear here once they apply and their resumes are parsed.
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

  return (
    <div>
      {/* Top toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Total",   value: bulkStatus?.total ?? totalCandidates, bg: "#f9fafb", color: "#374151" },
            { label: "Parsed",  value: bulkStatus?.completed ?? 0,           bg: "#f0fdf4", color: "#16a34a" },
            { label: "Parsing", value: bulkStatus?.parsing ?? 0,             bg: "#fdf4ff", color: "#9333ea" },
            { label: "Failed",  value: bulkStatus?.failed ?? 0,              bg: "#fef2f2", color: "#dc2626" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "6px 12px", borderRadius: 8, background: s.bg, border: "1px solid #e5e7eb", textAlign: "center", minWidth: 60 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "#6b7280", margin: "1px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>
        {/* Score All */}
        {(bulkStatus?.completed ?? 0) > 0 && (
          <button
            onClick={() => scoreAllMutation.mutate()}
            disabled={scoreAllMutation.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", opacity: scoreAllMutation.isPending ? 0.7 : 1 }}
          >
            <Sparkles size={12} /> {scoreAllMutation.isPending ? "Scoring…" : "Score All"}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {!readonly && selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5" }}>{selected.size} selected</span>
          <select
            value={bulkStageId}
            onChange={(e) => setBulkStageId(e.target.value)}
            style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #c7d2fe", borderRadius: 7, outline: "none", background: "#fff", color: "#374151" }}
          >
            <option value="">Move to stage…</option>
            {columns.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
          </select>
          <button
            onClick={() => { if (!bulkStageId) { toast.error("Select a stage first"); return; } bulkMoveMutation.mutate({ candidateIds: Array.from(selected), stageId: bulkStageId }); }}
            disabled={!bulkStageId || bulkMoveMutation.isPending}
            style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", opacity: !bulkStageId ? 0.5 : 1 }}
          >
            Move
          </button>
          <button onClick={() => setSelected(new Set())} style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={13} color="#9ca3af" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: "8px 32px 8px 30px", fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 8, outline: "none", background: "#f9fafb", color: "#374151", boxSizing: "border-box" }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
            <X size={13} color="#9ca3af" />
          </button>
        )}
      </div>

      {search && filteredTotal === 0 && (
        <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>No candidates match "{search}"</p>
      )}

      {/* Kanban board */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {filteredColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            allColumns={columns}
            selected={selected}
            readonly={readonly}
            onSelect={(id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onMove={(candidateId, stageId) => moveMutation.mutate({ candidateId, stageId })}
          />
        ))}
      </div>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

interface ColProps {
  col: PipelineColumn & { candidates: EnrichedCandidate[] };
  allColumns: PipelineColumn[];
  selected: Set<string>;
  readonly: boolean;
  onSelect: (id: string) => void;
  onMove: (candidateId: string, stageId: string) => void;
}

function KanbanColumn({ col, allColumns, selected, readonly, onSelect, onMove }: ColProps) {
  return (
    <div style={{ minWidth: 230, maxWidth: 250, flexShrink: 0, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: col.color ?? "#9ca3af" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", flex: 1 }}>{col.name}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#e5e7eb", borderRadius: 20, padding: "1px 7px" }}>
          {col.candidates.length}
        </span>
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {col.candidates.length === 0 && (
          <p style={{ fontSize: 11, color: "#d1d5db", textAlign: "center", padding: "12px 0" }}>Empty</p>
        )}
        {col.candidates.map((cand) => (
          <CandidateCard
            key={cand.placement_id}
            cand={cand}
            currentStageId={col.id}
            allColumns={allColumns}
            isSelected={selected.has(cand.candidate_id)}
            readonly={readonly}
            onSelect={() => onSelect(cand.candidate_id)}
            onMove={(stageId) => onMove(cand.candidate_id, stageId)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Candidate card ────────────────────────────────────────────────────────────

interface CardProps {
  cand: EnrichedCandidate;
  currentStageId: string;
  allColumns: PipelineColumn[];
  isSelected: boolean;
  readonly: boolean;
  onSelect: () => void;
  onMove: (stageId: string) => void;
}

function CandidateCard({ cand, currentStageId, allColumns, isSelected, readonly, onSelect, onMove }: CardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (cand.full_name ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const parseBadge = (() => {
    switch (cand.parseStatus) {
      case "completed": return { label: "Parsed",   bg: "#f0fdf4", color: "#16a34a" };
      case "failed":    return { label: "Failed",   bg: "#fef2f2", color: "#dc2626" };
      case "parsing":   return { label: "Parsing",  bg: "#f5f3ff", color: "#7c3aed" };
      default:          return { label: "Pending",  bg: "#f3f4f6", color: "#9ca3af" };
    }
  })();

  const scoreColor = cand.fitScore !== null
    ? cand.fitScore >= 70 ? "#059669" : cand.fitScore >= 40 ? "#d97706" : "#dc2626"
    : null;

  return (
    <div style={{
      background: "#fff", borderRadius: 8,
      border: isSelected ? "1.5px solid #4f46e5" : "1px solid #e5e7eb",
      padding: "10px 10px 8px", position: "relative",
      boxShadow: isSelected ? "0 0 0 2px #c7d2fe" : "none",
    }}>
      {/* Top row: checkbox + avatar + name/email + score */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
        {!readonly && (
          <input type="checkbox" checked={isSelected} onChange={onSelect}
            style={{ marginTop: 3, accentColor: "#4f46e5", flexShrink: 0 }} />
        )}
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#4f46e5", flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cand.full_name ?? "Unknown"}
          </p>
          {cand.email && (
            <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cand.email}
            </p>
          )}
        </div>
        {/* Fit score */}
        {cand.fitScore !== null && scoreColor && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: cand.fitScore >= 70 ? "#ecfdf5" : cand.fitScore >= 40 ? "#fffbeb" : "#fef2f2", borderRadius: 6, padding: "2px 7px", flexShrink: 0, outline: cand.isOverridden ? "2px solid #d97706" : "none" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{cand.fitScore.toFixed(0)}</span>
            <span style={{ fontSize: 8, color: scoreColor, fontWeight: 600, textTransform: "uppercase" }}>{cand.isOverridden ? "adj" : "fit"}</span>
          </div>
        )}
      </div>

      {/* Bottom row: parse badge + profile link + move */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Parse status badge */}
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: parseBadge.bg, color: parseBadge.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {parseBadge.label}
          </span>
          <Link href={`/candidates/${cand.candidate_id}`}
            style={{ fontSize: 10, fontWeight: 600, color: "#4f46e5", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
            Profile <ChevronRight size={9} />
          </Link>
        </div>

        {!readonly && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((o) => !o)}
              style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}>
              Move ▾
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 0, zIndex: 30, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: 4, minWidth: 140 }}>
                {allColumns.filter((c) => c.id !== currentStageId).map((c) => (
                  <button key={c.id} onClick={() => { onMove(c.id); setMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 10px", fontSize: 12, color: "#374151", background: "none", border: "none", borderRadius: 6, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: (c as any).color ?? "#9ca3af", flexShrink: 0 }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
