"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Briefcase, Users, Star, MessageSquare, Gift, CheckCircle2,
  Download, Printer, AlertTriangle, TrendingUp, BarChart2, Table2, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { analyticsApi, jobsApi, type AnalyticsOverview, type JobBreakdown, type SourceOfHire, type RecruiterActivity } from "@/lib/api";
import { advancedAnalyticsApi, type AnalyticsInsight, type QualityTrendPoint, type TimeToHire, type ShortlistAccuracy } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number; icon: any; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, marginTop: 1, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color="#4f46e5" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Skeleton({ w, h }: { w: string | number; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 8, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

const SCORE_COLORS = ["#ef4444","#f97316","#eab308","#84cc16","#22c55e","#10b981","#06b6d4","#3b82f6","#8b5cf6","#a855f7"];
const FUNNEL_COLORS = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];

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
  grey:  { bg: "#f9fafb", color: "#6b7280", label: "In progress" },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [jobId, setJobId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
  });

  const { data: timeInStage = [], isLoading: loadingTime } = useQuery({
    queryKey: ["analytics-time-in-stage", filters],
    queryFn: () => analyticsApi.getTimeInStage(filters),
  });

  const { data: scoreDist, isLoading: loadingScore } = useQuery({
    queryKey: ["analytics-score-dist", filters],
    queryFn: () => analyticsApi.getScoreDistribution(filters),
  });

  const { data: bias, isLoading: loadingBias } = useQuery({
    queryKey: ["analytics-bias", { job_id: jobId }],
    queryFn: () => analyticsApi.getBias(jobId ? { job_id: jobId } : {}),
  });

  const { data: jobsBreakdown = [], isLoading: loadingBreakdown } = useQuery({
    queryKey: ["analytics-jobs-breakdown"],
    queryFn: () => analyticsApi.getJobsBreakdown(),
  });

  const { data: sourceOfHire = [], isLoading: loadingSource } = useQuery({
    queryKey: ["analytics-source", filters],
    queryFn: () => analyticsApi.getSourceOfHire(filters),
  });

  const { data: recruiterActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["analytics-activity", { date_from: dateFrom, date_to: dateTo }],
    queryFn: () => analyticsApi.getRecruiterActivity(dateFrom || dateTo ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : {}),
  });

  // Advanced analytics
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["analytics-insights", { job_id: jobId }],
    queryFn: () => advancedAnalyticsApi.getInsights(jobId ? { job_id: jobId } : {}),
  });

  const { data: qualityTrend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["analytics-trend", { job_id: jobId }],
    queryFn: () => advancedAnalyticsApi.getQualityTrend(jobId ? { job_id: jobId } : {}),
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
    <div style={{ padding: "32px 36px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Pipeline health, AI scoring, and fairness metrics</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={csvUrl} download style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            <Download size={13} /> Export CSV
          </a>
          <a href={`/analytics/print?${new URLSearchParams(filters).toString()}`} target="_blank" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            <Printer size={13} /> Export PDF
          </a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#374151", minWidth: 200 }}>
          <option value="">All Jobs</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#374151" }} />
        <span style={{ fontSize: 12, color: "#9ca3af" }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#374151" }} />
        {(jobId || dateFrom || dateTo) && (
          <button onClick={() => { setJobId(""); setDateFrom(""); setDateTo(""); }} style={{ padding: "8px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#6b7280", cursor: "pointer" }}>
            Clear filters
          </button>
        )}
      </div>

      {/* 11.1 KPI cards — 3 col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {STAT_CARDS.map(({ label, key, icon, color }) => (
          loadingOverview
            ? <div key={key} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px" }}><Skeleton w="100%" h={56} /></div>
            : <StatCard
                key={key}
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
        ))}
      </div>

      {/* Funnel + Time-in-stage row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Conversion funnel */}
        <SectionCard icon={TrendingUp} title="Hiring Funnel">
          {loadingOverview || !overview?.funnel ? <Skeleton w="100%" h={200} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {overview.funnel.map((f, i) => (
                <div key={f.stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{f.stage}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{f.count} <span style={{ color: FUNNEL_COLORS[i], fontWeight: 600 }}>({f.pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "#f3f4f6", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${f.pct}%`, background: FUNNEL_COLORS[i], borderRadius: 4, transition: "width 0.5s ease" }} />
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
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit="d" />
                <Tooltip formatter={(v: any) => [`${v} days`, "Avg time"]} />
                <Bar dataKey="avg_days" radius={[4, 4, 0, 0]} fill="#6366f1" />
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
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [v, "Candidates"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {scoreDist.buckets.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} />)}
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
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    {["Job", "Status", "Applicants", "Screening", "Interview", "Offer", "Hired", "Avg Score"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Job" ? "left" : "center", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobsBreakdown.map((j: JobBreakdown) => {
                    const badge = STATUS_BADGE[j.status] ?? { bg: "#f3f4f6", color: "#6b7280" };
                    return (
                      <tr key={j.job_id} style={{ borderBottom: "1px solid #f3f4f6" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
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

      {/* 11.5 Bias analytics */}
      <SectionCard icon={AlertTriangle} title="Bias Analytics">        {loadingBias ? <Skeleton w="100%" h={100} /> : !bias ? null : (
          <>
            {bias.flagged_count > 0 ? (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
                    {bias.flagged_count} job{bias.flagged_count > 1 ? "s" : ""} flagged for potential score variance
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {bias.flagged_jobs.map((j) => j.job_title).join(", ")}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
                <CheckCircle2 size={16} color="#059669" />
                <span style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>No significant score variance detected across demographic proxy groups</span>
              </div>
            )}

            {bias.location_distribution.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Score by Location (proxy)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {bias.location_distribution.slice(0, 15).map((g, i) => (
                    <div key={i} style={{ padding: "5px 10px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>{g.group}</span>
                      <span style={{ color: "#6b7280", marginLeft: 6 }}>{g.mean_score} avg · {g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, fontStyle: "italic" }}>{bias.disclaimer}</p>
          </>
        )}
      </SectionCard>

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
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    {["Recruiter", "Role", "Pipeline Moves", "Shortlist Actions", "Uploads", "Total"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Recruiter" || h === "Role" ? "left" : "center", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recruiterActivity.map((r: RecruiterActivity) => (
                    <tr key={r.user_id} style={{ borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
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
      <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: 28, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>AI-Powered Insights</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", color: "#6366f1", fontWeight: 600 }}>Advanced</span>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip formatter={(v: any) => [`${v}/100`, "Avg Score"]} />
                  <Line type="monotone" dataKey="avg_score" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
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
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        {["Job", "Accepted", "Rejected", "Deferred", "Accuracy", "Avg Accepted Score", "Avg Rejected Score"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: h === "Job" ? "left" : "center", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shortlistAccuracy.per_job.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
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
