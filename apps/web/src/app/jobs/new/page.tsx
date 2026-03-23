import { CreateJobForm } from "@/components/jobs/create-job-form";
import { ArrowLeft, Lightbulb } from "lucide-react";
import Link from "next/link";

export default function NewJobPage() {
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000 }}>
      <Link href="/jobs" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 13, color: "#6b7280", textDecoration: "none", marginBottom: 24,
      }}>
        <ArrowLeft size={14} />
        Back to Jobs
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Create Job Posting</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Fill in the details below. Your draft is auto-saved every 30 seconds.
        </p>
      </div>

      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        {/* Form */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: 28,
          }}>
            <CreateJobForm />
          </div>
        </div>

        {/* Tips */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{
            background: "#eef2ff", borderRadius: 16, border: "1px solid #c7d2fe", padding: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Lightbulb size={14} color="#4f46e5" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#3730a3" }}>Writing Tips</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Use a clear, specific job title candidates search for",
                "Include salary range to get 30% more applicants",
                "List must-have vs nice-to-have skills separately",
                "Describe team culture and growth opportunities",
                "Keep descriptions between 300–700 words",
              ].map((tip, i) => (
                <li key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#4338ca" }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#c7d2fe",
                    color: "#4338ca", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
