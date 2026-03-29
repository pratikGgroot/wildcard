"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { interviewKitApi, type InterviewQuestion, type ScoringRubric } from "@/lib/api";

function RubricPrint({ rubric }: { rubric: ScoringRubric }) {
  const scoreLabels = ["Poor", "Below Expectations", "Meets Expectations", "Exceeds Expectations"];
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>Scoring Rubric</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={{ padding: "4px 8px", border: "1px solid #e5e7eb", textAlign: "left", width: 30 }}>Score</th>
            <th style={{ padding: "4px 8px", border: "1px solid #e5e7eb", textAlign: "left", width: 120 }}>Level</th>
            <th style={{ padding: "4px 8px", border: "1px solid #e5e7eb", textAlign: "left" }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {rubric.scale.map((level) => (
            <tr key={level.score}>
              <td style={{ padding: "4px 8px", border: "1px solid #e5e7eb", textAlign: "center", fontWeight: 700 }}>{level.score}</td>
              <td style={{ padding: "4px 8px", border: "1px solid #e5e7eb", fontWeight: 600 }}>{level.label}</td>
              <td style={{ padding: "4px 8px", border: "1px solid #e5e7eb", color: "#374151" }}>{level.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rubric.green_flags?.length > 0 && (
        <p style={{ fontSize: 11, margin: "6px 0 2px", color: "#059669" }}>✓ {rubric.green_flags.join(" · ")}</p>
      )}
      {rubric.red_flags?.length > 0 && (
        <p style={{ fontSize: 11, margin: "2px 0 0", color: "#dc2626" }}>✗ {rubric.red_flags.join(" · ")}</p>
      )}
    </div>
  );
}

function QuestionPrint({ q, index }: { q: InterviewQuestion; index: number }) {
  const typeLabel: Record<string, string> = { technical: "Technical", behavioral: "Behavioral", gap_probe: "Gap Probe" };
  return (
    <div style={{ marginBottom: 20, pageBreakInside: "avoid", padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Q{index + 1}.</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 4, background: "#eef2ff", color: "#4f46e5" }}>{typeLabel[q.question_type] ?? q.question_type}</span>
        {q.difficulty && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: "#f3f4f6", color: "#6b7280" }}>{q.difficulty}</span>}
        {q.competency_area && <span style={{ fontSize: 10, color: "#9ca3af" }}>{q.competency_area}</span>}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "0 0 8px", lineHeight: 1.6 }}>{q.question_text}</p>
      {q.suggested_answer && (
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px", lineHeight: 1.5 }}><strong>Suggested answer:</strong> {q.suggested_answer}</p>
      )}
      {q.rubric && <RubricPrint rubric={q.rubric} />}
      {/* Scoring sheet */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>Score:</span>
        {[1, 2, 3, 4].map((s) => (
          <span key={s} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #d1d5db", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9ca3af" }}>{s}</span>
        ))}
        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>Notes: ___________________________</span>
      </div>
    </div>
  );
}

export default function PrintKitPage() {
  const { kitId } = useParams<{ kitId: string }>();

  // We need candidate+job to fetch the kit — use a direct fetch by kit_id via a workaround
  // Since we only have kit_id here, we'll use the share approach or add a direct endpoint
  // For now, fetch via the kit_id using a dedicated print endpoint
  const { data: kit, isLoading } = useQuery({
    queryKey: ["kit-print", kitId],
    queryFn: () => interviewKitApi.getKitById(kitId),
    retry: false,
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>;
  if (!kit) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>Kit not found</div>;

  const techQs = kit.questions.filter((q: InterviewQuestion) => q.question_type === "technical");
  const behavQs = kit.questions.filter((q: InterviewQuestion) => q.question_type === "behavioral");
  const gapQs = kit.questions.filter((q: InterviewQuestion) => q.question_type === "gap_probe");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>
      <style>{`@media print { .no-print { display: none !important; } body { margin: 0; } }`}</style>

      {/* Print button */}
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
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Interview Kit</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Status: <strong>{kit.status}</strong>
          {kit.approved_at && ` · Approved ${new Date(kit.approved_at).toLocaleDateString()}`}
        </p>
      </div>

      {/* Gap summary */}
      {kit.gap_analysis && (
        <div style={{ marginBottom: 24, padding: "12px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 6px" }}>Skill Gap Summary</p>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            ✓ {kit.gap_analysis.matched_skills.length} matched · ~ {kit.gap_analysis.partial_skills.length} partial · ✗ {kit.gap_analysis.gap_count} gaps
            {kit.gap_analysis.has_critical_gaps && " (critical gaps present)"}
          </p>
        </div>
      )}

      {/* Technical */}
      {techQs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#4f46e5", margin: "0 0 14px", paddingBottom: 6, borderBottom: "1px solid #e0e7ff" }}>Technical Questions ({techQs.length})</h2>
          {techQs.map((q: InterviewQuestion, i: number) => <QuestionPrint key={q.id} q={q} index={i} />)}
        </section>
      )}

      {/* Behavioral */}
      {behavQs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#059669", margin: "0 0 14px", paddingBottom: 6, borderBottom: "1px solid #d1fae5" }}>Behavioral Questions ({behavQs.length})</h2>
          {behavQs.map((q: InterviewQuestion, i: number) => <QuestionPrint key={q.id} q={q} index={i} />)}
        </section>
      )}

      {/* Gap probe */}
      {gapQs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#d97706", margin: "0 0 14px", paddingBottom: 6, borderBottom: "1px solid #fef3c7" }}>Gap Probe Questions ({gapQs.length})</h2>
          {gapQs.map((q: InterviewQuestion, i: number) => <QuestionPrint key={q.id} q={q} index={i} />)}
        </section>
      )}

      {/* Overall scoring sheet */}
      <section style={{ pageBreakBefore: "always" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>Overall Scoring Sheet</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "left" }}>#</th>
              <th style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "left" }}>Question (summary)</th>
              <th style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "center", width: 60 }}>Score (1–4)</th>
              <th style={{ padding: "8px 10px", border: "1px solid #e5e7eb", textAlign: "left" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {kit.questions.map((q: InterviewQuestion, i: number) => (
              <tr key={q.id}>
                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}>{i + 1}</td>
                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb", color: "#374151" }}>{q.question_text.slice(0, 80)}{q.question_text.length > 80 ? "…" : ""}</td>
                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}></td>
                <td style={{ padding: "8px 10px", border: "1px solid #e5e7eb" }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
