"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutTemplate, Search, Globe, Building2,
  Trash2, Pencil, Copy, Plus, Zap,
} from "lucide-react";
import { templatesApi, type JobTemplate, type TemplateScope } from "@/lib/api";
import { Modal } from "@/components/ui/modal";

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates", search],
    queryFn: () => templatesApi.list(search ? { search } : undefined),
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

  const duplicateMutation = useMutation({
    mutationFn: (t: JobTemplate) =>
      templatesApi.list().then(() =>
        // Create a copy via the create endpoint
        fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${t.name} (copy)`,
            department: t.department,
            role_type: t.role_type,
            scope: "personal",
            template_data: t.template_data,
          }),
        }).then((r) => r.json())
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template duplicated");
    },
    onError: () => toast.error("Failed to duplicate"),
  });

  const orgTemplates = templates.filter((t) => t.scope === "organization");
  const personalTemplates = templates.filter((t) => t.scope === "personal");

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Job Templates</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Reusable job postings with pre-filled criteria
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        <Search size={14} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates by name..."
          style={{
            width: "100%", padding: "10px 12px 10px 36px", fontSize: 13,
            border: "1px solid #e5e7eb", borderRadius: 10, outline: "none",
            background: "#fff", boxSizing: "border-box",
          }}
        />
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 80, borderRadius: 12, background: "#f3f4f6", animation: "pulse 1.5s ease infinite" }} />
          ))}
        </div>
      )}

      {!isLoading && templates.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: 16, border: "2px dashed #e5e7eb" }}>
          <LayoutTemplate size={36} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>No templates yet</p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>
            Open any job posting and click "Template" to save it as a reusable template.
          </p>
        </div>
      )}

      {/* Organization templates */}
      {orgTemplates.length > 0 && (
        <TemplateSection
          title="Organization Templates"
          icon={<Globe size={14} color="#2563eb" />}
          templates={orgTemplates}
          onEdit={setEditingTemplate}
          onDelete={(id) => deleteMutation.mutate(id)}
          onDuplicate={(t) => duplicateMutation.mutate(t)}
        />
      )}

      {/* Personal templates */}
      {personalTemplates.length > 0 && (
        <TemplateSection
          title="My Templates"
          icon={<Building2 size={14} color="#6b7280" />}
          templates={personalTemplates}
          onEdit={setEditingTemplate}
          onDelete={(id) => deleteMutation.mutate(id)}
          onDuplicate={(t) => duplicateMutation.mutate(t)}
        />
      )}

      {/* Edit modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateSection({
  title, icon, templates, onEdit, onDelete, onDuplicate,
}: {
  title: string;
  icon: React.ReactNode;
  templates: JobTemplate[];
  onEdit: (t: JobTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (t: JobTemplate) => void;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{title}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20,
          background: "#f3f4f6", color: "#6b7280",
        }}>{templates.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t.id)}
            onDuplicate={() => onDuplicate(t)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template: t, onEdit, onDelete, onDuplicate,
}: {
  template: JobTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 12,
      background: "#fff", border: "1px solid #e5e7eb",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c7d2fe")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: "#eef2ff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <LayoutTemplate size={18} color="#4f46e5" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{t.name}</span>
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
        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "#9ca3af" }}>
          {t.department && <span>{t.department}</span>}
          {t.role_type && <span>· {t.role_type}</span>}
          <span>· {t.template_data.criteria.length} criteria</span>
          {t.usage_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Zap size={10} /> Used {t.usage_count}×
            </span>
          )}
          <span>· Created {timeAgo(t.created_at)}</span>
          {t.last_used_at && <span>· Last used {timeAgo(t.last_used_at)}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px", fontSize: 12, fontWeight: 500,
            background: "#f9fafb", color: "#374151",
            border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer",
          }}
        >
          <Copy size={11} /> Copy
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px", fontSize: 12, fontWeight: 500,
            background: "#f9fafb", color: "#374151",
            border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer",
          }}
        >
          <Pencil size={11} /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          style={{
            display: "flex", alignItems: "center", padding: "6px 8px",
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
  );
}

function EditTemplateModal({
  template, onClose, onSaved,
}: {
  template: JobTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [roleType, setRoleType] = useState(template.role_type ?? "");
  const [scope, setScope] = useState<TemplateScope>(template.scope);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/templates/${template.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), role_type: roleType.trim() || null, scope }),
        }
      );
      toast.success("Template updated");
      onSaved();
    } catch {
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Edit Template" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Template name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none", boxSizing: "border-box" as const }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Role type <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            value={roleType}
            onChange={(e) => setRoleType(e.target.value)}
            placeholder="e.g. Backend Engineer"
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none", boxSizing: "border-box" as const }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Visibility</label>
          <div style={{ display: "flex", gap: 10 }}>
            {(["personal", "organization"] as TemplateScope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${scope === s ? "#4f46e5" : "#e5e7eb"}`,
                  background: scope === s ? "#eef2ff" : "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {s === "personal" ? <Building2 size={13} color={scope === s ? "#4f46e5" : "#6b7280"} /> : <Globe size={13} color={scope === s ? "#4f46e5" : "#6b7280"} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: scope === s ? "#4f46e5" : "#374151", textTransform: "capitalize" }}>{s}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: name.trim() ? "#4f46e5" : "#e5e7eb", color: name.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, cursor: name.trim() ? "pointer" : "not-allowed" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
