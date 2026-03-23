"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lightbulb, Plus, X, Briefcase, TrendingUp } from "lucide-react";
import { criteriaApi, type Criterion, type CriteriaSuggestion } from "@/lib/api";

interface Props {
  jobId: string;
}

const WEIGHT_COLOR: Record<string, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#16a34a",
};

export function SuggestionsPanel({ jobId }: Props) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["criteria-suggestions", jobId],
    queryFn: () => criteriaApi.suggestions(jobId),
    staleTime: 60_000,
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: (s: CriteriaSuggestion) =>
      criteriaApi.add(jobId, {
        criterion_name: s.criterion_name,
        criterion_type: s.criterion_type,
        weight: s.weight,
        required: s.required,
        extra_data: s.extra_data,
      }),
    onSuccess: (created, suggestion) => {
      queryClient.setQueryData<Criterion[]>(["criteria", jobId], (old = []) => [...old, created]);
      setDismissed((prev) => new Set([...prev, suggestion.criterion_name]));
      toast.success(`Added "${suggestion.criterion_name}"`);
    },
    onError: () => toast.error("Failed to add criterion"),
  });

  // Don't render if not enough history or no suggestions
  if (isLoading || !data) return null;
  if (!data.has_enough_history) return null;

  const visible = data.suggestions.filter((s) => !dismissed.has(s.criterion_name));
  if (visible.length === 0) return null;

  return (
    <div style={{
      marginTop: 24,
      padding: "16px 18px",
      borderRadius: 14,
      background: "linear-gradient(135deg, #fefce8, #fffbeb)",
      border: "1px solid #fde68a",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "#fef3c7", border: "1px solid #fde68a",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Lightbulb size={14} color="#d97706" />
        </div>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Suggested Criteria</span>
          <span style={{ fontSize: 11, color: "#b45309", marginLeft: 6 }}>
            from {data.similar_jobs_found} similar role{data.similar_jobs_found !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Suggestions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((s) => (
          <SuggestionCard
            key={s.criterion_name}
            suggestion={s}
            onAdd={() => addMutation.mutate(s)}
            onDismiss={() => setDismissed((prev) => new Set([...prev, s.criterion_name]))}
            adding={addMutation.isPending && addMutation.variables?.criterion_name === s.criterion_name}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion: s, onAdd, onDismiss, adding,
}: {
  suggestion: CriteriaSuggestion;
  onAdd: () => void;
  onDismiss: () => void;
  adding: boolean;
}) {
  const pct = Math.round(s.similarity_score * 100);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 10,
      background: "#fff", border: "1px solid #fde68a",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.criterion_name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
            background: "#fef2f2", color: WEIGHT_COLOR[s.weight] ?? "#374151",
            textTransform: "capitalize",
          }}>{s.weight}</span>
          {s.required && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
            }}>Required</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: "#92400e", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Briefcase size={9} /> {s.source_job_title}
          </span>
          {s.usage_count > 1 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <TrendingUp size={9} /> Used in {s.usage_count} similar roles
            </span>
          )}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "1px 6px", borderRadius: 20,
            background: "#fef3c7", color: "#92400e",
            border: "1px solid #fde68a",
          }}>
            {pct}% match
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 12px", fontSize: 12, fontWeight: 600,
            background: "#d97706", color: "#fff",
            border: "none", borderRadius: 7, cursor: adding ? "not-allowed" : "pointer",
            opacity: adding ? 0.6 : 1,
          }}
        >
          <Plus size={11} /> Add
        </button>
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss"
          style={{
            display: "flex", alignItems: "center", padding: "5px 7px",
            background: "transparent", color: "#b45309",
            border: "1px solid #fde68a", borderRadius: 7, cursor: "pointer",
          }}
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
