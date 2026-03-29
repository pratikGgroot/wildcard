"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { interviewKitApi, type InterviewQuestion, type ScoringRubric } from "@/lib/api";
import { Check, X } from "lucide-react";

function RubricView({ rubric }: { rubric: ScoringRubric }) {
  const scoreColors = ["#dc2626", "#d97706", "#2563eb", "#059669"];
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Scoring Rubric</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rubric.scale.map((level) => (
          <div key={level.score} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: `${scoreColors[level.score - 1]}15`, border: `1px solid ${scoreColors[level.score - 1]}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: scoreColors[level.score - 1] }}>
              {level.score}
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: scoreColors[level.score - 1] }}>{level.label}</span>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{level.description}</p>
            </div>
          </div>
        ))}
      </div>
      {rubric.green_flags?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {rubric.green_flags.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
              <Check size={11} color="#059669" style={{ flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: 12, color: "#374151" }}>{f}</span>
            </div>
          ))}
        </div>
      )}
      {rubric.red_flags?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {rubric.red_flags.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
              <X size={11} color="#dc2626" style={{ flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: 12, color: "#374151" }}>{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionView({ q, index }: { q: InterviewQuestion; index: number }) {
  const typeColors: Record<string, { bg: string; color: string }> = {
    technical: { bg: "#eef2ff", color: "#4f46e5" },
    behavioral: { bg: "#f0fdf4", color: "#059669" },
    gap_probe: { bg: "#fff7ed", color: "#d97706" },
  };
  const tc = typeColors[q.question_type] ?? { bg: "#f3f4f6", color: "#6b7280" };
  const typeLabel: Record<string, string> = { technical: "Technical", behavioral: "Behavioral", gap_probe: "Gap Probe" };

  return (
    <div style={{ marginBottom: 16, padding: "16px 18px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Q{index + 1}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: tc.bg, color: tc.color }}>{typeLabel[q.question_type]}</span>
        {q.difficulty && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#f3f4f6", color: "#6b7280" }}>{q.difficulty}</span>}
        {q.competency_area && <span style={{ fontSize: 11, color: "#9ca3af" }}>{q.competency_area}</span>}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 8px", lineHeight: 1.6 }}>{q.question_text}</p>
      {q.suggested_answer && (
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px", lineHeight: 1.5, background: "#f9fafb", padding: "8px 10px", borderRadius: 6 }}>
          <strong>Suggested answer:</strong> {q.suggested_answer}
        </p>
      )}
      {q.rubric && <RubricView rubric={q.rubric} />}
    </div>
  );
}

export default function SharedKitPage() {
  const { token } = useParams<{ token: string }>();

  const { data: kit, isLoading, error } = useQuery({
    queryKey: ["shared-kit", token],
    queryFn: () => interviewKitApi.getSharedKit(token),
    retry: false,
  });

  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading interview kit…</p>
    </div>
  );

  if (error || !kit) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🔒</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Link not found or expired</p>
        <p style={{ fontSize: 13, color: "#9ca3af" }}>This interview kit link may have expired or been revoked.</p>
      </div>
    </div>
  );

  const techQs = kit.questions.filter((q) => q.question_type === "technical");
  const behavQs = kit.questions.filter((q) => q.question_type === "behavioral");
  const gapQs = kit.questions.filter((q) => q.question_type === "gap_probe");

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Interview Kit</h1>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#ecfdf5", color: "#059669" }}>Read-only</span>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0 0" }}>
            {kit.question_counts.technical} technical · {kit.question_counts.behavioral} behavioral · {kit.question_counts.gap_probe} gap probe
          </p>
          {kit.gap_analysis && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#f0fdf4", color: "#059669" }}>✓ {kit.gap_analysis.matched_skills.length} matched</span>
              {kit.gap_analysis.partial_skills.length > 0 && <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#fffbeb", color: "#d97706" }}>~ {kit.gap_analysis.partial_skills.length} partial</span>}
              {kit.gap_analysis.gap_count > 0 && <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#fef2f2", color: "#dc2626" }}>✗ {kit.gap_analysis.gap_count} gaps</span>}
            </div>
          )}
        </div>

        {/* Technical */}
        {techQs.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#4f46e5", margin: "0 0 12px" }}>Technical Questions</h2>
            {techQs.map((q, i) => <QuestionView key={q.id} q={q} index={i} />)}
          </section>
        )}

        {/* Behavioral */}
        {behavQs.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#059669", margin: "0 0 12px" }}>Behavioral Questions</h2>
            {behavQs.map((q, i) => <QuestionView key={q.id} q={q} index={i} />)}
          </section>
        )}

        {/* Gap probe */}
        {gapQs.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#d97706", margin: "0 0 12px" }}>Gap Probe Questions</h2>
            {gapQs.map((q, i) => <QuestionView key={q.id} q={q} index={i} />)}
          </section>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#d1d5db", marginTop: 32 }}>This is a read-only shared interview kit. Link expires 30 days from creation.</p>
      </div>
    </div>
  );
}
