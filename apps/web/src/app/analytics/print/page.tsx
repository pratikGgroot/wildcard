"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";

function PrintContent() {
  const params = useSearchParams();
  const filters = {
    ...(params.get("job_id") ? { job_id: params.get("job_id")! } : {}),
    ...(params.get("date_from") ? { date_from: params.get("date_from")! } : {}),
    ...(params.get("date_to") ? { date_to: params.get("date_to")! } : {}),
  };

  const { data: overview, isLoading: l1 } = useQuery({ queryKey: ["print-overview", filters], queryFn: () => analyticsApi.getOverview(filters) });
  const { data: timeInStage = [], isLoading: l2 } = useQuery({ queryKey: ["print-time", filters], queryFn: () => analyticsApi.getTimeInStage(filters) });
  const { data: scoreDist, isLoading: l3 } = useQuery({ queryKey: ["print-score", filters], queryFn: () => analyticsApi.getScoreDistribution(filters) });
  const { data: bias, isLoading: l4 } = useQuery({ queryKey: ["print-bias", filters], queryFn: () => analyticsApi.getBias(filters.job_id ? { job_id: filters.job_id } : {}) });

  const loading = l1 || l2 || l3 || l4;

  useEffect(() => {
    if (!loading && overview) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, overview]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading analytics…</div>;

  const jobLabel = params.get("job_id") ? `Job ID: ${params.get("job_id")}` : "All Jobs";
  const dateLabel = params.get("date_from") || params.get("date_to")
    ? `${params.get("date_from") || "—"} to ${params.get("date_to") || "—"}`
    : "All time";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="no-print" style={{ marginBottom: 24, display: "flex", gap: 10 }}>
        <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          🖨 Print / Save as PDF
        </button>
        <button onClick={() => window.close()} style={{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
          Close
        </button>
      </div>

      {/* Header */}
      <div style={{ borderBottom: "2px solid #111827", paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Analytics Report</h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
          {jobLabel} · {dateLabel} · Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Overview */}
      {overview && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>Overview</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {[
                ["Open Roles", overview.open_roles],
                ["Total Applicants", overview.total_applicants],
                ["Shortlisted", overview.shortlisted],
                ["In Interview", overview.in_interview],
                ["Offers Made", overview.offers_made],
                ["Hired", overview.hired],
              ].map(([label, value]) => (
                <tr key={label as string}>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", color: "#374151" }}>{label}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", fontWeight: 700, color: "#111827" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Time in stage */}
      {timeInStage.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>Time in Stage</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "left" }}>Stage</th>
                <th style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "right" }}>Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {timeInStage.map((s) => (
                <tr key={s.stage}>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{s.stage}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "right" }}>{s.avg_days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Score distribution */}
      {scoreDist && scoreDist.total > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>
            Score Distribution {scoreDist.mean_score ? `(avg: ${scoreDist.mean_score})` : ""}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "left" }}>Score Range</th>
                <th style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "right" }}>Candidates</th>
              </tr>
            </thead>
            <tbody>
              {scoreDist.buckets.filter((b) => b.count > 0).map((b) => (
                <tr key={b.range}>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{b.range}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb", textAlign: "right" }}>{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Bias summary */}
      {bias && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>Bias Analytics</h2>
          <p style={{ fontSize: 13, color: bias.flagged_count > 0 ? "#dc2626" : "#059669", marginBottom: 8 }}>
            {bias.flagged_count > 0
              ? `⚠ ${bias.flagged_count} job(s) flagged: ${bias.flagged_jobs.map((j) => j.job_title).join(", ")}`
              : "✓ No significant score variance detected"}
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>{bias.disclaimer}</p>
        </section>
      )}
    </div>
  );
}

export default function PrintAnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <PrintContent />
    </Suspense>
  );
}
