"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, type Job } from "@/lib/api";
import Link from "next/link";
import { Plus, Briefcase, MapPin, Building2, Clock, Search, ChevronRight, TrendingUp, Users, FileText } from "lucide-react";

const STATUS: Record<string, { label: string; bg: string; color: string; dot: string; ring: string }> = {
  draft:  { label: "Draft",  bg: "#f8fafc",  color: "#64748b", dot: "#94a3b8", ring: "#e2e8f0" },
  active: { label: "Active", bg: "#f0fdf4",  color: "#16a34a", dot: "#22c55e", ring: "#bbf7d0" },
  paused: { label: "Paused", bg: "#fffbeb",  color: "#d97706", dot: "#f59e0b", ring: "#fde68a" },
  closed: { label: "Closed", bg: "#fff1f2",  color: "#e11d48", dot: "#f43f5e", ring: "#fecdd3" },
};

const FILTERS = ["All", "Active", "Draft", "Paused", "Closed"];

const TYPE_COLORS: Record<string, string> = {
  "full-time":  "#4f46e5",
  "contract":   "#0891b2",
  "internship": "#7c3aed",
};

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Deterministic color from string
function strColor(s: string) {
  const palette = ["#4f46e5","#0891b2","#7c3aed","#059669","#d97706","#dc2626","#0284c7"];
  return palette[(s.charCodeAt(0) + s.charCodeAt(1)) % palette.length];
}

export default function JobsPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", filter],
    queryFn: () => jobsApi.list({ status: filter === "All" ? undefined : filter.toLowerCase() }),
  });

  const jobs = (data?.items ?? []).filter(
    (j) =>
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const allItems = data?.items ?? [];
  const counts = {
    total:  data?.total ?? 0,
    active: allItems.filter((j) => j.status === "active").length,
    draft:  allItems.filter((j) => j.status === "draft").length,
  };

  const STATS = [
    {
      label: "Total Postings",
      value: counts.total,
      icon: FileText,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      light: "#eef2ff",
      iconColor: "#4f46e5",
    },
    {
      label: "Active Jobs",
      value: counts.active,
      icon: TrendingUp,
      gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      light: "#f0fdf4",
      iconColor: "#16a34a",
    },
    {
      label: "Drafts",
      value: counts.draft,
      icon: Users,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      light: "#fdf2f8",
      iconColor: "#9333ea",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7" }}>
      {/* Top bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 40px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Job Postings
          </h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
            {counts.total} total · {counts.active} active
          </p>
        </div>
        <Link href="/jobs/new" style={{ textDecoration: "none" }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            color: "#fff", border: "none",
            borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(79,70,229,0.35), 0 1px 2px rgba(0,0,0,0.1)",
            letterSpacing: "-0.01em",
          }}>
            <Plus size={15} strokeWidth={2.5} />
            New Job
          </button>
        </Link>
      </div>

      <div style={{ padding: "28px 40px", maxWidth: 1000 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                animation: "fadeIn 0.3s ease",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: s.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}>
                  <Icon size={20} color="#fff" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", marginBottom: 2 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.03em" }}>
                    {s.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search + filters */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
          padding: "10px 14px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search by title, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 8,
                background: "#f8fafc", outline: "none", boxSizing: "border-box" as const,
                color: "#0f172a",
              }}
            />
          </div>
          <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
          <div style={{ display: "flex", gap: 3 }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 13px", fontSize: 12, fontWeight: 500, borderRadius: 7, border: "none",
                  cursor: "pointer", transition: "all 0.15s",
                  background: filter === f ? "#0f172a" : "transparent",
                  color: filter === f ? "#fff" : "#64748b",
                  letterSpacing: filter === f ? "-0.01em" : "0",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                height: 76, background: "#fff", borderRadius: 14,
                border: "1px solid #e5e7eb", animation: "pulse 1.5s ease infinite",
              }} />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "72px 24px",
            background: "#fff", borderRadius: 20, border: "2px dashed #e2e8f0",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <Briefcase size={28} color="#818cf8" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>No jobs found</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, marginBottom: 24 }}>
              {search ? "Try a different search term" : "Create your first job posting to get started"}
            </div>
            {!search && (
              <Link href="/jobs/new" style={{ textDecoration: "none" }}>
                <button style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "#fff", border: "none", borderRadius: 10,
                  padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
                }}>
                  Create Job
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {jobs.map((job: Job, idx: number) => {
              const s = STATUS[job.status] ?? STATUS.draft;
              const typeColor = TYPE_COLORS[job.type] ?? "#4f46e5";
              const initials = job.title.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const avatarBg = strColor(job.title);
              return (
                <Link key={job.id} href={`/jobs/${job.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
                      padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                      cursor: "pointer", transition: "all 0.18s",
                      animation: `fadeIn 0.3s ease ${idx * 0.04}s both`,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "#c7d2fe";
                      el.style.boxShadow = "0 4px 20px rgba(79,70,229,0.1)";
                      el.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "#e5e7eb";
                      el.style.boxShadow = "none";
                      el.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: avatarBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0,
                      boxShadow: `0 2px 8px ${avatarBg}55`,
                    }}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 650, color: "#0f172a", letterSpacing: "-0.01em" }}>
                          {job.title}
                        </span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                          background: s.bg, color: s.color,
                          border: `1px solid ${s.ring}`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
                          {s.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#94a3b8" }}>
                        {job.department && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Building2 size={11} /> {job.department}
                          </span>
                        )}
                        {job.location && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={11} /> {job.location}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={11} /> {timeAgo(job.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Type pill */}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                      background: `${typeColor}15`, color: typeColor,
                      textTransform: "capitalize", letterSpacing: "0.01em", flexShrink: 0,
                    }}>
                      {job.type}
                    </span>

                    <ChevronRight size={15} color="#cbd5e1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
