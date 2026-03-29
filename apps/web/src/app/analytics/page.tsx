"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  Briefcase, Users, Star, MessageSquare, Gift, CheckCircle2,
  Download, Printer, AlertTriangle, TrendingUp, BarChart2, Table2, Sparkles, Clock,
} from "lucide-react";
import Link from "next/link";
import { analyticsApi, jobsApi, advancedAnalyticsApi } from "@/lib/api";
import type { AnalyticsOverview, JobBreakdown, SourceOfHire, RecruiterActivity, AnalyticsInsight, QualityTrendPoint, TimeToHire, ShortlistAccuracy } from "@/lib/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_MUTED = "rgba(255,255,255,0.25)";

const STAT_CONFIG = [
  { key: "open_roles" as keyof AnalyticsOverview,      label: "Open Roles",       icon: Briefcase,     grad: "linear-gradient(135deg,#6366f1,#8b5cf6)", glow: "#6366f1" },
  { key: "total_applicants" as keyof AnalyticsOverview, label: "Total Applicants", icon: Users,         grad: "linear-gradient(135deg,#0ea5e9,#06b6d4)", glow: "#0ea5e9" },
  { key: "shortlisted" as keyof AnalyticsOverview,      label: "In Screening",    icon: Star,          grad: "linear-gradient(135deg,#f59e0b,#f97316)", glow: "#f59e0b" },
  { key: "in_interview" as keyof AnalyticsOverview,     label: "In Interview",    icon: MessageSquare, grad: "linear-gradient(135deg,#8b5cf6,#a855f7)", glow: "#8b5cf6" },
  { key: "offers_made" as keyof AnalyticsOverview,      label: "Offers Made",     icon: Gift,          grad: "linear-gradient(135deg,#ec4899,#f43f5e)", glow: "#ec4899" },
  { key: "hired" as keyof AnalyticsOverview,            label: "Hired",           icon: CheckCircle2,  grad: "linear-gradient(135deg,#10b981,#059669)", glow: "#10b981" },
];

const FUNNEL_COLORS = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];
const SCORE_COLORS  = ["#ef4444","#f97316","#eab308","#84cc16","#22c55e","#10b981","#06b6d4","#3b82f6","#8b5cf6","#a855f7"];

const TTH_COLORS: Record<string, { color: string; bg: string }> = {
  green:  { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  yellow: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  red:    { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  grey:   { color: "#64748b", bg: "rgba(100,116,139,0.1)" },
};

const INSIGHT_STYLES: Record<string, { border: string; icon: string; color: string; bg: string }> = {
  success: { bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)",  icon: "✓", color: "#10b981" },
  warning: { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   icon: "⚠", color: "#ef4444" },
  info:    { bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.25)",  icon: "ℹ", color: "#818cf8" },
  action:  { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  icon: "→", color: "#f59e0b" },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(16,185,129,0.15)", color: "#10b981" },
  draft:  { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
  closed: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  paused: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
};

// ── Reusable components ───────────────────────────────────────────────────────

function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderRadius: 16,
      backdropFilter: "blur(12px)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionCard({ icon: Icon, title, badge, children }: { icon: any; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <GlassCard style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color="#818cf8" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{title}</span>
        {badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontWeight: 600 }}>{badge}</span>}
      </div>
      {children}
    </GlassCard>
  );
}

function Skeleton({ w, h }: { w: string | number; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 8, background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

const customTooltipStyle = {
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: TEXT_PRIMARY,
  fontSize: 12,
  padding: "8px 12px",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [jobId, setJobId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = {
    ...(jobId ? { job_id: jobId } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };

  const { data: jobs = [] } = useQuery({ queryKey: ["jobs-list-all"], queryFn: () => jobsApi.list({ page: 1 }).then(r => r.items) });
  const { data: overview, isLoading: l1 } = useQuery({ queryKey: ["analytics-overview", filters], queryFn: () => analyticsApi.getOverview(filters) });
  const { data: timeInStage = [], isLoading: l2 } = useQuery({ queryKey: ["analytics-time", filters], queryFn: () => analyticsApi.getTimeInStage(filters) });
  const { data: scoreDist, isLoading: l3 } = useQuery({ queryKey: ["analytics-score", filters], queryFn: () => analyticsApi.getScoreDistribution(filters) });
  const { data: bias, isLoading: l4 } = useQuery({ queryKey: ["analytics-bias", { job_id: jobId }], queryFn: () => analyticsApi.getBias(jobId ? { job_id: jobId } : {}) });
  const { data: jobsBreakdown = [], isLoading: l5 } = useQuery({ queryKey: ["analytics-jobs-breakdown"], queryFn: () => analyticsApi.getJobsBreakdown() });
  const { data: sourceOfHire = [], isLoading: l6 } = useQuery({ queryKey: ["analytics-source", filters], queryFn: () => analyticsApi.getSourceOfHire(filters) });
  const { data: recruiterActivity = [], isLoading: l7 } = useQuery({ queryKey: ["analytics-activity"], queryFn: () => analyticsApi.getRecruiterActivity({}) });
  const { data: insights } = useQuery({ queryKey: ["analytics-insights", { job_id: jobId }], queryFn: () => advancedAnalyticsApi.getInsights(jobId ? { job_id: jobId } : {}) });
  const { data: qualityTrend = [], isLoading: l8 } = useQuery({ queryKey: ["analytics-trend", { job_id: jobId }], queryFn: () => advancedAnalyticsApi.getQualityTrend(jobId ? { job_id: jobId } : {}) });
  const { data: timeToHire = [], isLoading: l9 } = useQuery({ queryKey: ["analytics-tth"], queryFn: () => advancedAnalyticsApi.getTimeToHire() });
  const { data: shortlistAccuracy, isLoading: l10 } = useQuery({ queryKey: ["analytics-accuracy", { job_id: jobId }], queryFn: () => advancedAnalyticsApi.getShortlistAccuracy(jobId ? { job_id: jobId } : {}) });

  const csvUrl = analyticsApi.getExportCsvUrl(filters);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", padding: "32px 36px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .analytics-card { animation: fadeIn 0.4s ease forwards; }
        .stat-card:hover { transform: translateY(-2px); transition: transform 0.2s ease; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
              <BarChart2 size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT_PRIMARY, margin: 0, letterSpacing: "-0.02em" }}>Analytics</h1>
          </div>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0 }}>Pipeline health, AI scoring, and fairness metrics</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={csvUrl} download style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT_SECONDARY, fontSize: 12, fontWeight: 600, textDecoration: "none", backdropFilter: "blur(8px)" }}>
            <Download size={13} /> Export CSV
          </a>
          <a href={`/analytics/print?${new URLSearchParams(filters).toString()}`} target="_blank" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 15px rgba(99,102,241,0.35)" }}>
            <Printer size={13} /> Export PDF
          </a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <select value={jobId} onChange={e => setJobId(e.target.value)} style={{ padding: "9px 14px", fontSize: 13, border: `1px solid ${CARD_BORDER}`, borderRadius: 9, background: "rgba(15,23,42,0.8)", color: TEXT_PRIMARY, minWidth: 200, backdropFilter: "blur(8px)" }}>
          <option value="">All Jobs</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "9px 14px", fontSize: 13, border: `1px solid ${CARD_BORDER}`, borderRadius: 9, background: "rgba(15,23,42,0.8)", color: TEXT_PRIMARY, backdropFilter: "blur(8px)" }} />
        <span style={{ fontSize: 12, color: TEXT_MUTED }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "9px 14px", fontSize: 13, border: `1px solid ${CARD_BORDER}`, borderRadius: 9, background: "rgba(15,23,42,0.8)", color: TEXT_PRIMARY, backdropFilter: "blur(8px)" }} />
        {(jobId || dateFrom || dateTo) && (
          <button onClick={() => { setJobId(""); setDateFrom(""); setDateTo(""); }} style={{ padding: "9px 14px", fontSize: 12, border: `1px solid ${CARD_BORDER}`, borderRadius: 9, background: "transparent", color: TEXT_SECONDARY, cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {STAT_CONFIG.map(({ key, label, icon: Icon, grad, glow }) => {
          const val = typeof overview?.[key] === "number" ? overview[key] as number : 0;
          const pct = key !== "open_roles" && key !== "total_applicants" && overview?.total_applicants
            ? Math.round((val / overview.total_applicants) * 100) : null;
          return (
            <div key={key} className="stat-card" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, cursor: "default", transition: "transform 0.2s ease", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: glow, opacity: 0.08, filter: "blur(20px)" }} />
              <div style={{ width: 46, height: 46, borderRadius: 13, background: grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 15px ${glow}40` }}>
                <Icon size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                {l1 ? <Skeleton w={60} h={28} /> : (
                  <div style={{ fontSize: 28, fontWeight: 800, color: TEXT_PRIMARY, lineHeight: 1, letterSpacing: "-0.02em" }}>{val.toLocaleString()}</div>
                )}
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>{label}</div>
                {pct !== null && !l1 && (
                  <div style={{ fontSize: 11, color: glow, marginTop: 2, fontWeight: 600 }}>{pct}% of applicants</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Insights banner */}
      {insights?.insights && insights.insights.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Sparkles size={14} color="#818cf8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Insights</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
            {insights.insights.map((ins: AnalyticsInsight, i: number) => {
              const s = INSIGHT_STYLES[ins.type] ?? INSIGHT_STYLES.info;
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderRadius: 12, background: s.bg, border: `1px solid ${s.border}`, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14, color: s.color, flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>{ins.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Funnel + Time in stage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard icon={TrendingUp} title="Hiring Funnel">
          {l1 || !overview?.funnel ? <Skeleton w="100%" h={180} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {overview.funnel.map((f, i) => (
                <div key={f.stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 500 }}>{f.stage}</span>
                    <span style={{ fontSize: 12, color: TEXT_MUTED }}>{f.count} <span style={{ color: FUNNEL_COLORS[i], fontWeight: 700 }}>({f.pct}%)</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${f.pct}%`, background: `linear-gradient(90deg, ${FUNNEL_COLORS[i]}, ${FUNNEL_COLORS[Math.min(i+1, FUNNEL_COLORS.length-1)]})`, borderRadius: 3, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${FUNNEL_COLORS[i]}60` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Clock} title="Time in Stage (avg days)">
          {l2 ? <Skeleton w="100%" h={180} /> : timeInStage.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "40px 0" }}>No stage transition data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timeInStage} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: TEXT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: TEXT_MUTED }} unit="d" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [`${v} days`, "Avg"]} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="avg_days" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Score distribution */}
      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={BarChart2} title={`Score Distribution${scoreDist?.mean_score ? ` · avg ${scoreDist.mean_score}/100` : ""}${scoreDist?.total ? ` · ${scoreDist.total} scored` : ""}`}>
          {l3 ? <Skeleton w="100%" h={160} /> : !scoreDist || scoreDist.total === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "40px 0" }}>No scores yet — run AI scoring on candidates first</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={scoreDist.buckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: TEXT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: TEXT_MUTED }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [v, "Candidates"]} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {scoreDist.buckets.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} opacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Quality trend + Time to hire */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard icon={TrendingUp} title="Candidate Quality Trend" badge="12 weeks">
          {l8 ? <Skeleton w="100%" h={180} /> : qualityTrend.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "40px 0" }}>Not enough data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={qualityTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: TEXT_MUTED }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: TEXT_MUTED }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: any) => [`${v}/100`, "Avg Score"]} />
                <Area type="monotone" dataKey="avg_score" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: "#6366f1", r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard icon={CheckCircle2} title="Time-to-Hire Benchmark">
          {l9 ? <Skeleton w="100%" h={180} /> : timeToHire.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "40px 0" }}>No jobs with applicants yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {timeToHire.map((t: TimeToHire) => {
                const c = TTH_COLORS[t.status];
                return (
                  <div key={t.job_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: c.bg, border: `1px solid ${c.color}25` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED }}>{t.applicants} applicants</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{t.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Per-job breakdown */}
      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={Table2} title="Per-Job Breakdown">
          {l5 ? <Skeleton w="100%" h={100} /> : jobsBreakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "20px 0" }}>No jobs yet</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                    {["Job", "Status", "Applicants", "Screening", "Interview", "Offer", "Hired", "Avg Score"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Job" ? "left" : "center", fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobsBreakdown.map((j: JobBreakdown) => {
                    const badge = STATUS_BADGE[j.status] ?? { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" };
                    return (
                      <tr key={j.job_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "10px 10px" }}>
                          <Link href={`/jobs/${j.job_id}`} style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, textDecoration: "none" }}>{j.title}</Link>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: badge.bg, color: badge.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{j.status}</span>
                        </td>
                        {[j.applicants, j.screening, j.interview, j.offer, j.hired].map((v, i) => (
                          <td key={i} style={{ padding: "10px 10px", textAlign: "center", color: v > 0 ? TEXT_PRIMARY : TEXT_MUTED, fontWeight: v > 0 ? 600 : 400 }}>{v}</td>
                        ))}
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          {j.avg_score != null ? (
                            <span style={{ fontSize: 13, fontWeight: 800, color: j.avg_score >= 70 ? "#10b981" : j.avg_score >= 50 ? "#f59e0b" : "#ef4444" }}>{j.avg_score}</span>
                          ) : <span style={{ color: TEXT_MUTED }}>—</span>}
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

      {/* Source of hire */}
      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={Users} title="Source of Hire">
          {l6 ? <Skeleton w="100%" h={80} /> : sourceOfHire.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "20px 0" }}>No data yet</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {sourceOfHire.map((s: SourceOfHire) => (
                <div key={s.source} style={{ padding: "16px 18px", borderRadius: 12, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}>{s.source}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {[["Applicants", s.applicants, `${s.pct_of_total}%`, TEXT_SECONDARY], ["Hired", s.hired, "", "#10b981"], ["Conversion", `${s.conversion_rate}%`, "", "#818cf8"]].map(([label, val, sub, color]) => (
                      <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: TEXT_MUTED }}>{label}</span>
                        <span style={{ fontWeight: 700, color: color as string }}>{val} {sub && <span style={{ fontWeight: 400, color: TEXT_MUTED }}>{sub}</span>}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.pct_of_total}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Bias analytics */}
      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={AlertTriangle} title="Bias Analytics">
          {l4 ? <Skeleton w="100%" h={80} /> : !bias ? null : (
            <>
              {bias.flagged_count > 0 ? (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>{bias.flagged_count} job{bias.flagged_count > 1 ? "s" : ""} flagged for potential score variance</div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>{bias.flagged_jobs.map(j => j.job_title).join(", ")}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
                  <CheckCircle2 size={15} color="#10b981" />
                  <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>No significant score variance detected across demographic proxy groups</span>
                </div>
              )}
              {bias.location_distribution.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Score by Location (proxy)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {bias.location_distribution.slice(0, 12).map((g, i) => (
                      <div key={i} style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: TEXT_PRIMARY }}>{g.group}</span>
                        <span style={{ color: TEXT_MUTED, marginLeft: 6 }}>{g.mean_score} avg · {g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: 0, fontStyle: "italic" }}>{bias.disclaimer}</p>
            </>
          )}
        </SectionCard>
      </div>

      {/* Shortlist accuracy */}
      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={Star} title={`AI Shortlist Accuracy${shortlistAccuracy?.overall_accuracy != null ? ` · ${shortlistAccuracy.overall_accuracy}% overall` : ""}`} badge="Advanced">
          {l10 ? <Skeleton w="100%" h={80} /> : !shortlistAccuracy || shortlistAccuracy.overall_total === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "20px 0" }}>No shortlist actions yet — accept or reject candidates from the AI Shortlist tab</p>
          ) : (
            <>
              {shortlistAccuracy.overall_accuracy != null && (
                <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 14, background: shortlistAccuracy.overall_accuracy >= 70 ? "rgba(16,185,129,0.08)" : shortlistAccuracy.overall_accuracy >= 40 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${shortlistAccuracy.overall_accuracy >= 70 ? "rgba(16,185,129,0.25)" : shortlistAccuracy.overall_accuracy >= 40 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: shortlistAccuracy.overall_accuracy >= 70 ? "#10b981" : shortlistAccuracy.overall_accuracy >= 40 ? "#f59e0b" : "#ef4444" }}>
                    {shortlistAccuracy.overall_accuracy >= 70 ? "✓ High accuracy" : shortlistAccuracy.overall_accuracy >= 40 ? "~ Moderate accuracy" : "⚠ Low accuracy"} — {shortlistAccuracy.overall_accuracy}% acceptance rate ({shortlistAccuracy.overall_total} actions)
                  </span>
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {["Job", "Accepted", "Rejected", "Deferred", "Accuracy", "Avg ✓ Score", "Avg ✗ Score"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: h === "Job" ? "left" : "center", fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shortlistAccuracy.per_job.map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding: "10px 10px", fontWeight: 600, color: TEXT_PRIMARY }}>{r.job_title}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: "#10b981", fontWeight: 600 }}>{r.accepted}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: "#ef4444" }}>{r.rejected}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: "#f59e0b" }}>{r.deferred}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <span style={{ fontWeight: 800, color: r.accuracy_pct >= 70 ? "#10b981" : r.accuracy_pct >= 40 ? "#f59e0b" : "#ef4444" }}>{r.accuracy_pct}%</span>
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: "#10b981", fontWeight: 600 }}>{r.avg_accepted_score ?? "—"}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: "#ef4444" }}>{r.avg_rejected_score ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Recruiter activity */}
      <div style={{ marginBottom: 40 }}>
        <SectionCard icon={Users} title="Recruiter Activity">
          {l7 ? <Skeleton w="100%" h={80} /> : recruiterActivity.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, textAlign: "center", padding: "20px 0" }}>No recruiter activity recorded yet</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                    {["Recruiter", "Role", "Pipeline Moves", "Shortlist Actions", "Uploads", "Total"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Recruiter" || h === "Role" ? "left" : "center", fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recruiterActivity.map((r: RecruiterActivity) => (
                    <tr key={r.user_id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{r.name || "—"}</div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED }}>{r.email}</div>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "rgba(99,102,241,0.15)", color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.role}</span>
                      </td>
                      {[r.pipeline_moves, r.shortlist_actions, r.resume_uploads, r.total_actions].map((v, i) => (
                        <td key={i} style={{ padding: "10px 10px", textAlign: "center", fontWeight: i === 3 ? 800 : 400, color: i === 3 ? TEXT_PRIMARY : TEXT_SECONDARY, fontSize: i === 3 ? 14 : 13 }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
