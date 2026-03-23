"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkPlus, Building2, Globe } from "lucide-react";
import { templatesApi, type TemplateScope } from "@/lib/api";
import { Modal } from "@/components/ui/modal";

interface Props {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}

export function SaveTemplateModal({ jobId, jobTitle, onClose }: Props) {
  const [name, setName] = useState(jobTitle);
  const [scope, setScope] = useState<TemplateScope>("personal");
  const [roleType, setRoleType] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => templatesApi.saveFromJob(jobId, name.trim(), scope, roleType.trim() || undefined),
    onSuccess: () => {
      toast.success("Template saved");
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Failed to save template"),
  });

  const valid = name.trim().length >= 2;

  const scopeOption = (value: TemplateScope, icon: React.ReactNode, label: string, desc: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      style={{
        flex: 1, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
        border: `2px solid ${scope === value ? "#4f46e5" : "#e5e7eb"}`,
        background: scope === value ? "#eef2ff" : "#fff",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ color: scope === value ? "#4f46e5" : "#6b7280" }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: scope === value ? "#4f46e5" : "#374151" }}>{label}</span>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{desc}</p>
    </button>
  );

  return (
    <Modal open title="Save as Template" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Name */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Template name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", fontSize: 13,
              border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
              boxSizing: "border-box",
            }}
            autoFocus
          />
        </div>

        {/* Role type */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Role type <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            value={roleType}
            onChange={(e) => setRoleType(e.target.value)}
            placeholder="e.g. Backend Engineer, Product Manager"
            style={{
              width: "100%", padding: "9px 12px", fontSize: 13,
              border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Scope */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Visibility
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {scopeOption("personal", <Building2 size={14} />, "Personal", "Only visible to you")}
            {scopeOption("organization", <Globe size={14} />, "Organization", "Visible to all recruiters")}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!valid || saveMutation.isPending}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 18px", fontSize: 13, fontWeight: 600,
              background: valid ? "#4f46e5" : "#e5e7eb",
              color: valid ? "#fff" : "#9ca3af",
              border: "none", borderRadius: 8,
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            {saveMutation.isPending ? "Saving..." : <><BookmarkPlus size={13} /> Save Template</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
