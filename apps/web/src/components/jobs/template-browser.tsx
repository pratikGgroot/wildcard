"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, BookTemplate, Globe, Building2, Trash2, Zap, LayoutTemplate } from "lucide-react";
import { templatesApi, type JobTemplate, type TemplateData } from "@/lib/api";

interface Props {
  onApply: (data: TemplateData, templateId: string) => void;
  onClose: () => void;
}

export function TemplateBrowser({ onApply, onClose }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates", search],
    queryFn: () => templatesApi.list(search ? { search } : undefined),
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => templatesApi.apply(id).then((data) => ({ data, id })),
    onSuccess: ({ data, id }) => {
      onApply(data, id);
      onClose();
    },
    onError: () => toast.error("Failed to apply template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<JobTemplate[]>(["templates", search], (old = []) =>
        old.filter((t) => t.id !== id)
      );
      toast.success("Template deleted");
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const filtered = templates.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.4)", padding: 16,
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        width: "100%", maxWidth: 600, maxHeight: "80vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LayoutTemplate size={16} color="#4f46e5" />
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Job Templates</h2>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Select a template to pre-fill the form</p>
            </div>
            <button type="button" onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={13} color="#9ca3af" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              style={{
                width: "100%", padding: "8px 12px 8px 30px", fontSize: 13,
                border: "1px solid #e5e7eb", borderRadius: 8, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 20px" }}>
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 72, borderRadius: 10, background: "#f3f4f6", animation: "pulse 1.5s ease infinite" }} />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <LayoutTemplate size={32} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>
                {search ? "No templates match your search" : "No templates yet"}
              </p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                Save a job as a template to reuse it here
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  border: "1px solid #e5e7eb", background: "#fff",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c7d2fe")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <LayoutTemplate size={16} color="#4f46e5" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.name}</span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 20,
                      background: t.scope === "organization" ? "#eff6ff" : "#f3f4f6",
                      color: t.scope === "organization" ? "#2563eb" : "#6b7280",
                      border: `1px solid ${t.scope === "organization" ? "#bfdbfe" : "#e5e7eb"}`,
                    }}>
                      {t.scope === "organization" ? <Globe size={8} /> : <Building2 size={8} />}
                      {t.scope === "organization" ? "Org" : "Personal"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 11, color: "#9ca3af" }}>
                    {t.department && <span>{t.department}</span>}
                    {t.role_type && <span>· {t.role_type}</span>}
                    <span>· {t.template_data.criteria.length} criteria</span>
                    {t.usage_count > 0 && <span>· Used {t.usage_count}×</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => applyMutation.mutate(t.id)}
                    disabled={applyMutation.isPending}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 14px", fontSize: 12, fontWeight: 600,
                      background: "#4f46e5", color: "#fff",
                      border: "none", borderRadius: 7, cursor: "pointer",
                    }}
                  >
                    <Zap size={11} /> Use
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                    title="Delete template"
                    style={{
                      display: "flex", alignItems: "center", padding: 6,
                      background: "transparent", color: "#9ca3af",
                      border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
