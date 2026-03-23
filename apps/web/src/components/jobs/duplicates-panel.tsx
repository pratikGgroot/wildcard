"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { duplicatesApi, type DuplicateFlag } from "@/lib/api";

export function DuplicatesPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["duplicates", jobId],
    queryFn: () => duplicatesApi.listForJob(jobId),
    staleTime: 15_000,
  });

  const confirmMutation = useMutation({
    mutationFn: (flagId: string) => duplicatesApi.confirm(flagId),
    onSuccess: () => {
      toast.success("Profiles merged");
      queryClient.invalidateQueries({ queryKey: ["duplicates", jobId] });
      queryClient.invalidateQueries({ queryKey: ["resume-bulk-status", jobId] });
    },
    onError: () => toast.error("Failed to merge profiles"),
  });

  const dismissMutation = useMutation({
    mutationFn: (flagId: string) => duplicatesApi.dismiss(flagId),
    onSuccess: () => {
      toast.success("Flag dismissed — both profiles retained");
      queryClient.invalidateQueries({ queryKey: ["duplicates", jobId] });
    },
    onError: () => toast.error("Failed to dismiss flag"),
  });

  if (isLoading) return <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading...</p>;

  if (flags.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <CheckCircle size={22} color="#16a34a" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>No duplicate flags</p>
        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>All candidates appear to be unique for this job.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <AlertTriangle size={15} color="#d97706" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {flags.length} potential duplicate{flags.length !== 1 ? "s" : ""} flagged for review
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {flags.map((flag) => (
          <FlagCard
            key={flag.id}
            flag={flag}
            onConfirm={() => confirmMutation.mutate(flag.id)}
            onDismiss={() => dismissMutation.mutate(flag.id)}
            isPending={confirmMutation.isPending || dismissMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function FlagCard({
  flag,
  onConfirm,
  onDismiss,
  isPending,
}: {
  flag: DuplicateFlag;
  onConfirm: () => void;
  onDismiss: () => void;
  isPending: boolean;
}) {
  const isEmbedding = flag.detection_method === "embedding";

  return (
    <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 12, padding: 16 }}>
      {/* Method badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Copy size={13} color="#d97706" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d97706" }}>
          {isEmbedding ? "Similar profile" : "Same email"}
        </span>
        {isEmbedding && flag.similarity_score != null && (
          <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "1px 8px", borderRadius: 4 }}>
            {(flag.similarity_score * 100).toFixed(0)}% match
          </span>
        )}
      </div>

      {/* Candidate pair */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <CandidateCard
          name={flag.candidate_a?.full_name}
          email={flag.candidate_a?.email}
          location={flag.candidate_a?.location}
          label="Profile A"
        />
        <div style={{ fontSize: 18, color: "#d1d5db", textAlign: "center" }}>↔</div>
        <CandidateCard
          name={flag.candidate_b?.full_name}
          email={flag.candidate_b?.email}
          location={flag.candidate_b?.location}
          label="Profile B"
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onDismiss}
          disabled={isPending}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 14px", fontSize: 12, fontWeight: 600,
            background: "#fff", color: "#6b7280",
            border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer",
          }}
        >
          <XCircle size={12} /> Not a duplicate
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 14px", fontSize: 12, fontWeight: 600,
            background: "#4f46e5", color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer",
          }}
        >
          <CheckCircle size={12} /> Merge profiles
        </button>
      </div>
    </div>
  );
}

function CandidateCard({
  name,
  email,
  location,
  label,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  location: string | null | undefined;
  label: string;
}) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", padding: "10px 12px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "0 0 2px" }}>
        {name ?? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Unknown</span>}
      </p>
      {email && <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 1px" }}>✉ {email}</p>}
      {location && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>📍 {location}</p>}
    </div>
  );
}
