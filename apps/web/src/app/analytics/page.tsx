"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Briefcase, Users, Star, MessageSquare, Gift, CheckCircle2,
  Download, Printer, AlertTriangle, TrendingUp, BarChart2, Table2, Sparkles, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { analyticsApi, jobsApi, type AnalyticsOverview, type JobBreakdown, type SourceOfHire, type RecruiterActivity } from "@/lib/api";
import { advancedAnalyticsApi, type AnalyticsInsight, type QualityTrendPoint, type TimeToHire, type ShortlistAccuracy } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number; icon: any; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 16, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)", transition: "box-shadow 0.2s" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${color}20` }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, marginTop: 3, fontWeight: 700 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children, badge }: { icon: any; title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#eef2ff,#e0e7ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color="#4f46e5" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>{title}</span>
        {badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#eef2ff", color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Skeleton({ w, h }: { w: string | number; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 8, background: "linear-gradient(90deg,#f8fafc 25%,#f1f5f9 50%,#f8fafc 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

const SCORE_COLORS = ["#ef4444","#f97316","#eab308","#84cc16","#22c55e","#10b981","#06b6d4","#3b82f6","#8b5cf6","#a855f7"];
const FUNNEL_COLORS = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#e0e7ff"];

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active: { bg: "#f0fdf4", color: "#16a34a" },
  draft:  { bg: "#f8fafc", color: "#64748b" },
  closed: { bg: "#fff1f2", color: "#e11d48" },
  paused: { bg: "#fffbeb", color: "#d97706" },
};

const INSIGHT_STYLES: Record<string, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", icon: "✓", color: "#059669" },
  warning: { bg: "#fef2f2", border: "#fecaca", icon: "⚠", color: "#dc2626" },
  info:    { bg: "#eff6ff", border: "#bfdbfe", icon: "ℹ", color: "#2563eb" },
  action:  { bg: "#fefce8", border: "#fde68a", icon: "→", color: "#d97706" },
};

const TTH_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  green: { bg: "#f0fdf4", color: "#059669", label: "Fast (≤30d)" },
  yellow: { bg: "#fffbeb", color: "#d97706", label: "Moderate (31–60d)" },
  red:   { bg: "#fef2f2", color: "#dc2626", label: "Slow (>60d)" },
  grey:  { bg: "#f8fafc", color: "#64748b", label: "In progress" },
};

const customTooltipStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  color: "#0f172a",
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [jobId, setJobId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const qc = useQueryClient();

  const refreshAll = () => qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("analytics") });

  const filters = {
    ...(jobId ? { job_id: jobId } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-list-all"],
    queryFn: () => jobsApi.list({ page: 1 }).then((r) => r.items),
  });

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["analytics-overview", filters],
    queryFn: () => analyticsApi.getOverview(filters),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: timeInStage = [], isLoading: loadingTime } = useQuery({
    queryKey: ["analytics-time-in-stage", filters],
    queryFn: () => analyticsApi.getTimeInStage(filters),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: scoreDist, isLoading: loadingScore } = useQuery({
    queryKey: ["analytics-score-dist", filters],
    queryFn: () => analyticsApi.getScoreDistribution(filters),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: bias, isLoading: loadingBias } = useQuery({
    queryKey: ["analytics-bias", { job_id: jobId }],
    queryFn: () => analyticsApi.getBias(jobId ? { job_id: jobId } : {}),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: jobsBreakdown = [], isLoading: loadingBreakdown } = useQuery({
    queryKey: ["analytics-jobs-breakdown"],
    queryFn: () => analyticsApi.getJobsBreakdown(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: sourceOfHire = [], isLoading: loadingSource } = useQuery({
    queryKey: ["analytics-source", filters],
    queryFn: () => analyticsApi.getSourceOfHire(filters),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: recruiterActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["analytics-activity", { date_from: dateFrom, date_to: dateTo }],
    queryFn: () => analyticsApi.getRecruiterActivity(dateFrom || dateTo ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : {}),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Advanced analytics
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["analytics-insights", { job_id: jobId }],
    queryFn: () => advancedAnalyticsApi.getInsights(jobId ? { job_id: jobId } : {}),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: qualityTrend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["analytics-trend", { job_id: jobId }],
    queryFn: () => advancedAnalyticsApi.getQualityTrend(jobId ? { job_id: jobId } : {}),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: timeToHire = [], isLoading: loadingTTH } = useQuery({
    queryKey: ["analytics-tth"],
    queryFn: () => advancedAnalyticsApi.getTimeToHire(),
  });

  const { data: shortlistAccuracy, isLoading: loadingAccuracy } = useQuery({
    queryKey: ["analytics-accuracy", { job_id: jobId }],
    queryFn: () => advancedAnalyticsApi.getShortlistAccuracy(jobId ? { job_id: jobId } : {}),
  });

  const csvUrl = analyticsApi.getExportCsvUrl(filters);

  const STAT_CARDS: { label: string; key: keyof AnalyticsOverview; icon: any; color: string }[] = [
    { label: "Open Roles",       key: "open_roles",       icon: Briefcase,    color: "#4f46e5" },
    { label: "Total Applicants", key: "total_applicants", icon: Users,        color: "#0891b2" },
    { label: "In Screening",     key: "shortlisted",      icon: Star,         color: "#d97706" },
    { label: "In Interview",     key: "in_interview",     icon: MessageSquare,color: "#7c3aed" },
    { label: "Offers Made",      key: "offers_made",      icon: Gift,         color: "#db2777" },
    { label: "Hired",            key: "hired",            icon: CheckCircle2, color: "#059669" },
  ];

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1280, margin: "0 auto", background: "#f8fafc", minHeight: "100vh" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .stat-hover:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important; transform: translateY(-1px); transition: all 0.2s ease; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
              <BarChart2 size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Analytics</h1>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 0 48px" }}>Pipeline health, AI scoring, and fairness metrics</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={refreshAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <a href={csvUrl} download style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600, textDecoration: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <Download size={13} /> Export CSV
          </a>
          <a href={`/analytics/print?${new URLSearchParams(filters).toString()}`} target="_blank" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
            <Printer size={13} /> Export PDF
          </a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center", background: "#fff", padding: "14px 18px", borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#374151", minWidth: 200, outline: "none" }}>
          <option value="">All Jobs</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#374151", outline: "none" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#374151", outline: "none" }} />
        </div>
        {(jobId || dateFrom || dateTo) && (
          <button onClick={() => { setJobId(""); setDateFrom(""); setDateTo(""); }} style={{ padding: "7px 14px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#64748b", cursor: "pointer", fontWeight: 500 }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* 11.1 KPI cards — 3 col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {STAT_CARDS.map(({ label, key, icon, color }) => (
          loadingOverview
            ? <div key={key} className="stat-hover" style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}><Skeleton w="100%" h={60} /></div>
            : <div key={key} className="stat-hover">
                <StatCard
                  label={label}
                  value={typeof overview?.[key] === "number" ? overview[key] as number : 0}
                  icon={icon}
                  color={color}
                  sub={
                    key !== "open_roles" && key !== "total_applicants" && overview?.total_applicants
                      ? `${Math.round(((overview[key] as number) / overview.total_applicants) * 100)}% of applicants`
                      : undefined
                  }
                />
              </div>
        ))}
      </div>

      {/* Funnel + Time-in-stage row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Conversion funnel */}
        <SectionCard icon={TrendingUp} title="Hiring Funnel">
          {loadingOverview || !overview?.funnel ? <Skeleton w="100%" h={200} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {overview.funnel.map((f, i) => (
                <div key={f.stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{f.stage}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{f.count} <span style={{ color: FUNNEL_COLORS[i], fontWeight: 700 }}>({f.pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${f.pct}%`, background: `linear-gradient(90deg, ${FUNNEL_COLORS[i]}, ${FUNNEL_COLORS[Math.min(i+1, FUNNEL_COLORS.length-1)]})`, borderRadius: 4, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Time in stage */}
        <SectionCard icon={BarChart2} title="Time in Stage (avg days)">
          {loadingTime ? <Skeleton w="100%" h={200} /> : timeInStage.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No stage transition data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeInStage} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="d" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [`${v} days`, "Avg time"]} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="avg_days" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Score distribution */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard icon={BarChart2} title={`Score Distribution${scoreDist?.mean_score ? ` · avg ${scoreDist.mean_score}` : ""}${scoreDist?.total ? ` · ${scoreDist.total} candidates` : ""}`}>
          {loadingScore ? <Skeleton w="100%" h={180} /> : !scoreDist || scoreDist.total === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No scores available yet — run scoring on candidates first</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scoreDist.buckets} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [v, "Candidates"]} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {scoreDist.buckets.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} opacity={0.9} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Per-job breakdown table */}
      <div style={{ marginBottom: 20 }}>
        <SectionCard icon={Table2} title="Per-Job Breakdown">
          {loadingBreakdown ? <Skeleton w="100%" h={120} /> : jobsBreakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No jobs yet</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {["Job", "Status", "Applicants", "Screening", "Interview", "Offer", "Hired", "Avg Score"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Job" ? "left" : "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobsBreakdown.map((j: JobBreakdown) => {
                    const badge = STATUS_BADGE[j.status] ?? { bg: "#f3f4f6", color: "#6b7280" };
                    return (
                      <tr key={j.job_id} style={{ borderBottom: "1px solid #f8fafc" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "10px 10px" }}>
                          <Link href={`/jobs/${j.job_id}`} style={{ fontSize: 13, fontWeight: 600, color: "#111827", textDecoration: "none" }}>
                            {j.title}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: badge.bg, color: badge.color }}>
                            {j.status}
                          </span>
                        </td>
                        {[j.applicants, j.screening, j.interview, j.offer, j.hired].map((v, i) => (
                          <td key={i} style={{ padding: "10px 10px", textAlign: "center", color: "#374151", fontWeight: v > 0 ? 600 : 400 }}>{v}</td>
                        ))}
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          {j.avg_score != null ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: j.avg_score >= 70 ? "#059669" : j.avg_score >= 50 ? "#d97706" : "#dc2626" }}>
                              {j.avg_score}
                            </span>
                          ) : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 11.4 Source of hire */}
      <div style={{ marginTop: 20 }}>
        <SectionCard icon={Users} title="Source of Hire">
          {loadingSource ? <Skeleton w="100%" h={80} /> : sourceOfHire.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No data yet</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {sourceOfHire.map((s: SourceOfHire) => (
                <div key={s.source} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{s.source}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Applicants</span>
                      <span style={{ fontWeight: 600, color: "#374151" }}>{s.applicants} <span style={{ color: "#9ca3af" }}>({s.pct_of_total}%)</span></span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Hired</span>
                      <span style={{ fontWeight: 600, color: "#059669" }}>{s.hired}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Conversion</span>
                      <span style={{ fontWeight: 600, color: "#4f46e5" }}>{s.conversion_rate}%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.pct_of_total}%`, background: "#6366f1", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 11.6 Recruiter activity */}
      <div style={{ marginTop: 20, marginBottom: 32 }}>
        <SectionCard icon={Users} title="Recruiter Activity">
          {loadingActivity ? <Skeleton w="100%" h={120} /> : recruiterActivity.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No recruiter activity recorded yet</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {["Recruiter", "Role", "Pipeline Moves", "Shortlist Actions", "Uploads", "Total"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Recruiter" || h === "Role" ? "left" : "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recruiterActivity.map((r: RecruiterActivity) => (
                    <tr key={r.user_id} style={{ borderBottom: "1px solid #f8fafc" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{r.name || "—"}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.email}</div>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#eef2ff", color: "#4f46e5" }}>{r.role}</span>
                      </td>
                      {[r.pipeline_moves, r.shortlist_actions, r.resume_uploads, r.total_actions].map((v, i) => (
                        <td key={i} style={{ padding: "10px 10px", textAlign: "center", fontWeight: i === 3 ? 700 : 400, color: i === 3 ? "#111827" : "#374151" }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── ADVANCED ANALYTICS ── */}
      <div style={{ borderTop: "2px solid #f1f5f9", paddingTop: 32, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(99,102,241,0.25)" }}>
            <Sparkles size={15} color="#fff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>AI-Powered Insights</span>
          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "linear-gradient(135deg,#eef2ff,#e0e7ff)", color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Advanced</span>
        </div>

        {/* 1. AI Hiring Insights */}
        <div style={{ marginBottom: 20 }}>
          <SectionCard icon={Sparkles} title="Hiring Intelligence">
            {loadingInsights ? <Skeleton w="100%" h={80} /> : !insights?.insights.length ? null : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.insights.map((ins: AnalyticsInsight, i: number) => {
                  const s = INSIGHT_STYLES[ins.type] ?? INSIGHT_STYLES.info;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 14, color: s.color, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{ins.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 2. Quality trend + 3. Time-to-hire */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Quality trend */}
          <SectionCard icon={TrendingUp} title="Candidate Quality Trend (12 weeks)">
            {loadingTrend ? <Skeleton w="100%" h={200} /> : qualityTrend.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>Not enough data yet — scores will appear as candidates are processed</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={qualityTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [`${v}/100`, "Avg Score"]} />
                  <Line type="monotone" dataKey="avg_score" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#6366f1" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Time to hire */}
          <SectionCard icon={CheckCircle2} title="Time-to-Hire Benchmark">
            {loadingTTH ? <Skeleton w="100%" h={200} /> : timeToHire.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No jobs with applicants yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {timeToHire.map((t: TimeToHire) => {
                  const c = TTH_COLORS[t.status];
                  return (
                    <div key={t.job_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: c.bg, border: `1px solid ${c.color}20` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{t.applicants} applicants</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{t.label}</div>
                        <div style={{ fontSize: 10, color: c.color }}>{c.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 5. Shortlist accuracy */}
        <div style={{ marginBottom: 32 }}>
          <SectionCard icon={Star} title={`AI Shortlist Accuracy${shortlistAccuracy?.overall_accuracy != null ? ` · ${shortlistAccuracy.overall_accuracy}% overall` : ""}`}>
            {loadingAccuracy ? <Skeleton w="100%" h={100} /> : !shortlistAccuracy || shortlistAccuracy.overall_total === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No shortlist actions taken yet — accept or reject candidates from the AI Shortlist tab</p>
            ) : (
              <>
                {shortlistAccuracy.overall_accuracy != null && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: shortlistAccuracy.overall_accuracy >= 70 ? "#f0fdf4" : shortlistAccuracy.overall_accuracy >= 40 ? "#fffbeb" : "#fef2f2", border: `1px solid ${shortlistAccuracy.overall_accuracy >= 70 ? "#bbf7d0" : shortlistAccuracy.overall_accuracy >= 40 ? "#fde68a" : "#fecaca"}` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: shortlistAccuracy.overall_accuracy >= 70 ? "#059669" : shortlistAccuracy.overall_accuracy >= 40 ? "#d97706" : "#dc2626" }}>
                      {shortlistAccuracy.overall_accuracy >= 70 ? "✓ High accuracy" : shortlistAccuracy.overall_accuracy >= 40 ? "~ Moderate accuracy" : "⚠ Low accuracy"} — recruiters accepted {shortlistAccuracy.overall_accuracy}% of AI recommendations ({shortlistAccuracy.overall_total} total actions)
                    </span>
                  </div>
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                        {["Job", "Accepted", "Rejected", "Deferred", "Accuracy", "Avg Accepted Score", "Avg Rejected Score"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: h === "Job" ? "left" : "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shortlistAccuracy.per_job.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "10px 10px", fontWeight: 600, color: "#111827" }}>{r.job_title}</td>
                          <td style={{ padding: "10px 10px", textAlign: "center", color: "#059669", fontWeight: 600 }}>{r.accepted}</td>
                          <td style={{ padding: "10px 10px", textAlign: "center", color: "#dc2626" }}>{r.rejected}</td>
                          <td style={{ padding: "10px 10px", textAlign: "center", color: "#d97706" }}>{r.deferred}</td>
                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
                            <span style={{ fontWeight: 700, color: r.accuracy_pct >= 70 ? "#059669" : r.accuracy_pct >= 40 ? "#d97706" : "#dc2626" }}>{r.accuracy_pct}%</span>
                          </td>
                          <td style={{ padding: "10px 10px", textAlign: "center", color: "#059669", fontWeight: 600 }}>{r.avg_accepted_score ?? "—"}</td>
                          <td style={{ padding: "10px 10px", textAlign: "center", color: "#dc2626" }}>{r.avg_rejected_score ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
