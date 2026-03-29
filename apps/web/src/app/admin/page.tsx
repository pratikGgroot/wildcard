"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Shield, Cpu, Brain, Building2, ScrollText, Plus, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { adminApi, type AdminUser, type AdminAuditEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ── Design tokens (dark theme matching analytics) ─────────────────────────────
const BG = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#f1f5f9";
const MUTED = "rgba(255,255,255,0.45)";
const DIM = "rgba(255,255,255,0.25)";

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:          { bg: "rgba(239,68,68,0.15)",   color: "#ef4444" },
  recruiter:      { bg: "rgba(99,102,241,0.15)",  color: "#818cf8" },
  hiring_manager: { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b" },
  viewer:         { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
};

const TABS = [
  { id: "users",    label: "Users",           icon: Users },
  { id: "ai",       label: "AI Settings",     icon: Cpu },
  { id: "ethics",   label: "AI Governance",   icon: Brain },
  { id: "org",      label: "Organization",    icon: Building2 },
  { id: "audit",    label: "Audit Log",       icon: ScrollText },
];

function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, ...style }}>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#6366f1" : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 8,
  background: "rgba(15,23,42,0.8)", color: TEXT, width: "100%", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle };

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "recruiter", password: "" });
  const [editForm, setEditForm] = useState<{ full_name: string; role: string }>({ full_name: "", role: "" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search, showInactive],
    queryFn: () => adminApi.listUsers({ search: search || undefined, include_inactive: showInactive }),
  });

  const createMut = useMutation({
    mutationFn: () => adminApi.createUser(form),
    onSuccess: () => { toast.success("User created"); setCreating(false); setForm({ email: "", full_name: "", role: "recruiter", password: "" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Failed to create user"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateUser(id, data),
    onSuccess: () => { toast.success("User updated"); setEditingId(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: () => toast.error("Failed to update user"),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => { toast.success("User deactivated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: () => toast.error("Failed to deactivate user"),
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 220 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, cursor: "pointer" }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <button onClick={() => setCreating(true)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={13} /> New User
        </button>
      </div>

      {creating && (
        <GlassCard style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 12 }}>Create New User</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input placeholder="Full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={inputStyle} />
            <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="Password (min 8 chars)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={selectStyle}>
              <option value="viewer">Viewer</option>
              <option value="recruiter">Recruiter</option>
              <option value="hiring_manager">Hiring Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {createMut.isPending ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setCreating(false)} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["User", "Role", "Status", "Last Login", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Actions" ? "right" : "left", fontSize: 10, fontWeight: 700, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: DIM }}>Loading…</td></tr>
            ) : users.map((u: AdminUser) => {
              const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer;
              const isEditing = editingId === u.id;
              return (
                <tr key={u.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, color: TEXT }}>{isEditing ? (
                      <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} style={{ ...inputStyle, width: 160 }} />
                    ) : u.full_name}</div>
                    <div style={{ fontSize: 11, color: DIM }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {isEditing ? (
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={{ ...selectStyle, width: 140 }}>
                        <option value="viewer">Viewer</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="hiring_manager">Hiring Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: rc.bg, color: rc.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{u.role.replace("_", " ")}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: u.is_active ? "#10b981" : "#ef4444" }}>{u.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: DIM, fontSize: 12 }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => updateMut.mutate({ id: u.id, data: editForm })} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 11, cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditingId(u.id); setEditForm({ full_name: u.full_name, role: u.role }); }} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, cursor: "pointer" }} title="Edit">
                          <Pencil size={12} />
                        </button>
                        {u.id !== me?.id && u.is_active && (
                          <button onClick={() => { if (confirm(`Deactivate ${u.full_name}?`)) deactivateMut.mutate(u.id); }} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer" }} title="Deactivate">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}

// ── AI Settings Tab ───────────────────────────────────────────────────────────

function ApiKeyRow({ provider, label }: { provider: string; label: string }) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["api-key-status", provider],
    queryFn: () => adminApi.getApiKeyStatus(provider),
  });

  const saveMut = useMutation({
    mutationFn: () => adminApi.setApiKey(provider, key),
    onSuccess: () => { toast.success(`${label} API key saved`); setKey(""); qc.invalidateQueries({ queryKey: ["api-key-status", provider] }); },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Failed to save key"),
  });

  const deleteMut = useMutation({
    mutationFn: () => adminApi.deleteApiKey(provider),
    onSuccess: () => { toast.success("API key removed"); qc.invalidateQueries({ queryKey: ["api-key-status", provider] }); },
  });

  return (
    <SettingRow label={`${label} API Key`} description={status?.configured ? `Configured (${status.source})` : "Not configured"}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {status?.configured ? (
          <>
            <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ Set</span>
            <button onClick={() => deleteMut.mutate()} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>Remove</button>
          </>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder={`sk-...`}
                style={{ ...inputStyle, width: 200, paddingRight: 32 }}
              />
              <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: DIM, cursor: "pointer", fontSize: 11 }}>
                {show ? "hide" : "show"}
              </button>
            </div>
            <button onClick={() => saveMut.mutate()} disabled={!key || saveMut.isPending} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: key ? "#6366f1" : "rgba(255,255,255,0.08)", color: key ? "#fff" : DIM, fontSize: 12, fontWeight: 600, cursor: key ? "pointer" : "not-allowed" }}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>
    </SettingRow>
  );
}

function AISettingsTab() {
  const qc = useQueryClient();
  const { data: setting, isLoading } = useQuery({
    queryKey: ["admin-setting-ai"],
    queryFn: () => adminApi.getSetting("ai_model"),
  });

  const [form, setForm] = useState<any>(null);
  const val = form ?? setting?.value ?? {};

  const saveMut = useMutation({
    mutationFn: () => adminApi.updateSetting("ai_model", val),
    onSuccess: () => { toast.success("AI settings saved"); qc.invalidateQueries({ queryKey: ["admin-setting-ai"] }); setForm(null); },
    onError: () => toast.error("Failed to save"),
  });

  if (isLoading) return <div style={{ color: DIM, padding: 20 }}>Loading…</div>;

  const update = (key: string, value: any) => setForm((f: any) => ({ ...(f ?? val), [key]: value }));

  return (
    <GlassCard style={{ padding: "0 20px" }}>
      <SettingRow label="LLM Provider" description="Language model provider for text generation">
        <select value={val.llm_provider ?? "ollama"} onChange={e => update("llm_provider", e.target.value)} style={{ ...selectStyle, width: 160 }}>
          <option value="ollama">Ollama (Local)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </SettingRow>
      <SettingRow label="LLM Model" description="Model name for chat, extraction, and generation">
        <input value={val.llm_model ?? ""} onChange={e => update("llm_model", e.target.value)} style={{ ...inputStyle, width: 200 }} placeholder="e.g. llama3.1:8b" />
      </SettingRow>
      <SettingRow label="Embedding Model" description="Model for semantic search and scoring">
        <input value={val.embed_model ?? ""} onChange={e => update("embed_model", e.target.value)} style={{ ...inputStyle, width: 200 }} placeholder="e.g. nomic-embed-text" />
      </SettingRow>
      <SettingRow label="Shortlist Threshold" description="Minimum fit score (0–100) to include in AI shortlist">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="range" min={0} max={100} value={val.shortlist_threshold ?? 60} onChange={e => update("shortlist_threshold", parseInt(e.target.value))} style={{ width: 120 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", minWidth: 30 }}>{val.shortlist_threshold ?? 60}</span>
        </div>
      </SettingRow>
      <SettingRow label="Score Weights" description="How technical, culture, and growth scores are weighted">
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          {["technical", "culture", "growth"].map(k => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ color: DIM, marginBottom: 4, textTransform: "capitalize" }}>{k}</div>
              <input type="number" min={0} max={1} step={0.1} value={val.score_weights?.[k] ?? 0.33} onChange={e => update("score_weights", { ...(val.score_weights ?? {}), [k]: parseFloat(e.target.value) })} style={{ ...inputStyle, width: 60, textAlign: "center" }} />
            </div>
          ))}
        </div>
      </SettingRow>
      <div style={{ padding: "16px 0" }}>
        <button onClick={() => saveMut.mutate()} disabled={!form || saveMut.isPending} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: form ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.08)", color: form ? "#fff" : DIM, fontSize: 13, fontWeight: 600, cursor: form ? "pointer" : "not-allowed" }}>
          {saveMut.isPending ? "Saving…" : "Save AI Settings"}
        </button>
      </div>
    </GlassCard>
  );
}

// ── AI Governance Tab ─────────────────────────────────────────────────────────

function GovernanceTab() {
  const qc = useQueryClient();
  const { data: setting, isLoading } = useQuery({
    queryKey: ["admin-setting-governance"],
    queryFn: () => adminApi.getSetting("ai_governance"),
  });

  const [form, setForm] = useState<any>(null);
  const val = form ?? setting?.value ?? {};

  const saveMut = useMutation({
    mutationFn: () => adminApi.updateSetting("ai_governance", val),
    onSuccess: () => { toast.success("Governance settings saved"); qc.invalidateQueries({ queryKey: ["admin-setting-governance"] }); setForm(null); },
    onError: () => toast.error("Failed to save"),
  });

  if (isLoading) return <div style={{ color: DIM, padding: 20 }}>Loading…</div>;

  const update = (path: string[], value: any) => {
    setForm((f: any) => {
      const base = JSON.parse(JSON.stringify(f ?? val));
      let obj = base;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] ??= {};
      obj[path[path.length - 1]] = value;
      return base;
    });
  };

  return (
    <GlassCard style={{ padding: "0 20px" }}>
      <SettingRow label="Human-in-the-Loop" description="Require human approval before AI-driven actions take effect">
        <Toggle checked={val.humanInTheLoop?.enabled ?? false} onChange={v => update(["humanInTheLoop", "enabled"], v)} />
      </SettingRow>
      <SettingRow label="Require approval for stage transitions" description="Recruiter must confirm before AI moves a candidate">
        <Toggle checked={val.humanInTheLoop?.requireApprovalForStageTransition ?? false} onChange={v => update(["humanInTheLoop", "requireApprovalForStageTransition"], v)} />
      </SettingRow>
      <SettingRow label="Require approval for rejections" description="Recruiter must confirm before AI rejects a candidate">
        <Toggle checked={val.humanInTheLoop?.requireApprovalForRejection ?? false} onChange={v => update(["humanInTheLoop", "requireApprovalForRejection"], v)} />
      </SettingRow>
      <SettingRow label="Blind Review Mode" description="Mask identifying fields during initial screening">
        <Toggle checked={val.blindReview?.defaultEnabled ?? false} onChange={v => update(["blindReview", "defaultEnabled"], v)} />
      </SettingRow>
      <SettingRow label="Allow Automated Rejection" description="Allow AI to reject candidates without human review">
        <Toggle checked={val.automatedRejection?.allowed ?? false} onChange={v => update(["automatedRejection", "allowed"], v)} />
      </SettingRow>
      <SettingRow label="Candidate AI Disclosure" description="Show AI disclosure notice to candidates on the careers page">
        <Toggle checked={val.candidateDisclosure?.disclosureEnabled ?? true} onChange={v => update(["candidateDisclosure", "disclosureEnabled"], v)} />
      </SettingRow>
      <SettingRow label="Disclosure Text" description="Text shown to candidates about AI usage">
        <textarea value={val.candidateDisclosure?.disclosureText ?? ""} onChange={e => update(["candidateDisclosure", "disclosureText"], e.target.value)} rows={2} style={{ ...inputStyle, width: 320, resize: "vertical" }} />
      </SettingRow>
      <SettingRow label="Bias Audit Schedule" description="How often to run automated bias checks">
        <select value={val.biasAudit?.scheduleFrequency ?? "monthly"} onChange={e => update(["biasAudit", "scheduleFrequency"], e.target.value)} style={{ ...selectStyle, width: 140 }}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
      </SettingRow>
      <SettingRow label="Bias Alert Threshold" description="Flag jobs where score variance between groups exceeds this value">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="range" min={5} max={30} value={val.biasAudit?.alertThreshold ?? 15} onChange={e => update(["biasAudit", "alertThreshold"], parseInt(e.target.value))} style={{ width: 120 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", minWidth: 30 }}>{val.biasAudit?.alertThreshold ?? 15}</span>
        </div>
      </SettingRow>
      <div style={{ padding: "16px 0" }}>
        <button onClick={() => saveMut.mutate()} disabled={!form || saveMut.isPending} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: form ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.08)", color: form ? "#fff" : DIM, fontSize: 13, fontWeight: 600, cursor: form ? "pointer" : "not-allowed" }}>
          {saveMut.isPending ? "Saving…" : "Save Governance Settings"}
        </button>
      </div>
    </GlassCard>
  );
}

// ── Organization Tab ──────────────────────────────────────────────────────────

function OrgTab() {
  const qc = useQueryClient();
  const { data: setting, isLoading } = useQuery({
    queryKey: ["admin-setting-org"],
    queryFn: () => adminApi.getSetting("company_profile"),
  });

  const [form, setForm] = useState<any>(null);
  const val = form ?? setting?.value ?? {};

  const saveMut = useMutation({
    mutationFn: () => adminApi.updateSetting("company_profile", val),
    onSuccess: () => { toast.success("Organization settings saved"); qc.invalidateQueries({ queryKey: ["admin-setting-org"] }); setForm(null); },
    onError: () => toast.error("Failed to save"),
  });

  if (isLoading) return <div style={{ color: DIM, padding: 20 }}>Loading…</div>;

  const update = (key: string, value: string) => setForm((f: any) => ({ ...(f ?? val), [key]: value }));

  return (
    <GlassCard style={{ padding: "0 20px" }}>
      <SettingRow label="Company Name" description="Displayed on the careers page and emails">
        <input value={val.name ?? ""} onChange={e => update("name", e.target.value)} style={{ ...inputStyle, width: 240 }} placeholder="Apex Hire" />
      </SettingRow>
      <SettingRow label="Website" description="Company website URL">
        <input value={val.website ?? ""} onChange={e => update("website", e.target.value)} style={{ ...inputStyle, width: 240 }} placeholder="https://example.com" />
      </SettingRow>
      <SettingRow label="Industry" description="Your company's industry">
        <input value={val.industry ?? ""} onChange={e => update("industry", e.target.value)} style={{ ...inputStyle, width: 200 }} placeholder="Technology" />
      </SettingRow>
      <SettingRow label="Company Size" description="Number of employees">
        <select value={val.size ?? ""} onChange={e => update("size", e.target.value)} style={{ ...selectStyle, width: 160 }}>
          <option value="">Select size</option>
          <option value="1-10">1–10</option>
          <option value="11-50">11–50</option>
          <option value="51-200">51–200</option>
          <option value="201-1000">201–1,000</option>
          <option value="1000+">1,000+</option>
        </select>
      </SettingRow>
      <div style={{ padding: "16px 0" }}>
        <button onClick={() => saveMut.mutate()} disabled={!form || saveMut.isPending} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: form ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.08)", color: form ? "#fff" : DIM, fontSize: 13, fontWeight: 600, cursor: form ? "pointer" : "not-allowed" }}>
          {saveMut.isPending ? "Saving…" : "Save Organization Settings"}
        </button>
      </div>
    </GlassCard>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────

function AuditTab() {
  const [filter, setFilter] = useState("");
  const { data: log = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-audit", filter],
    queryFn: () => adminApi.getAuditLog({ resource_type: filter || undefined, limit: 100 }),
  });

  const ACTION_COLORS: Record<string, string> = {
    create_user: "#10b981", update_user: "#f59e0b", deactivate_user: "#ef4444",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...selectStyle, width: 180 }}>
          <option value="">All actions</option>
          <option value="user">User actions</option>
          <option value="setting">Setting changes</option>
        </select>
        <button onClick={() => refetch()} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, cursor: "pointer" }}>
          <RefreshCw size={13} />
        </button>
        <span style={{ fontSize: 12, color: DIM }}>{log.length} entries</span>
      </div>
      <GlassCard>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["Time", "Admin", "Action", "Resource", "IP"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: DIM }}>Loading…</td></tr>
            ) : log.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: DIM }}>No audit entries yet</td></tr>
            ) : log.map((e: AdminAuditEntry) => (
              <tr key={e.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <td style={{ padding: "10px 14px", color: DIM }}>{new Date(e.performed_at).toLocaleString()}</td>
                <td style={{ padding: "10px 14px", color: TEXT, fontWeight: 500 }}>{e.admin_name ?? "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${ACTION_COLORS[e.action] ?? "#6366f1"}20`, color: ACTION_COLORS[e.action] ?? "#818cf8" }}>
                    {e.action.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", color: MUTED }}>{e.resource_type ?? "—"}</td>
                <td style={{ padding: "10px 14px", color: DIM, fontFamily: "monospace" }}>{e.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Shield size={40} color="#ef4444" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>Access Denied</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Admin role required</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)", padding: "32px 36px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(239,68,68,0.3)" }}>
            <Shield size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: "-0.02em" }}>Admin Panel</h1>
        </div>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Platform configuration, user management, and AI governance</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 16px",
            borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: activeTab === id ? "rgba(99,102,241,0.15)" : "transparent",
            color: activeTab === id ? "#818cf8" : MUTED,
            borderBottom: activeTab === id ? "2px solid #6366f1" : "2px solid transparent",
            transition: "all 0.15s",
          }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "users"  && <UsersTab />}
      {activeTab === "ai"     && <AISettingsTab />}
      {activeTab === "ethics" && <GovernanceTab />}
      {activeTab === "org"    && <OrgTab />}
      {activeTab === "audit"  && <AuditTab />}
    </div>
  );
}
