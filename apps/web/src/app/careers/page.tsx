"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Building2, Briefcase, ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { jobsApi, type Job } from "@/lib/api";

export default function CareersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: () => jobsApi.list({ status: "active" }),
  });

  const jobs = (data?.items ?? []).filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    (j.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", padding: "64px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>Open Positions</h1>
        <p style={{ fontSize: 16, color: "#c7d2fe", margin: "0 0 32px" }}>Join our team and help build something great</p>
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
          <Search size={16} color="#9ca3af" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles..."
            style={{ width: "100%", padding: "12px 16px 12px 40px", fontSize: 14, borderRadius: 10, border: "none", outline: "none", boxSizing: "border-box" as const }}
          />
        </div>
      </div>

      {/* Job list */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 100, borderRadius: 14, background: "#e5e7eb", animation: "pulse 1.5s ease infinite" }} />)}
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <Briefcase size={32} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No open positions right now</p>
            <p style={{ fontSize: 14, color: "#9ca3af" }}>Check back soon — we're always growing.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/careers/${job.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        padding: "20px 24px", cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#a5b4fc"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(79,70,229,0.1)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>{job.title}</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#6b7280", flexWrap: "wrap" }}>
              {job.department && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={13} /> {job.department}</span>}
              {job.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {job.location}</span>}
              <span style={{ background: "#eef2ff", color: "#4f46e5", padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const }}>{job.type}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4f46e5", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            Apply <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </Link>
  );
}
