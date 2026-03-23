"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, AlertCircle, UserPlus, X, Search,
  Briefcase, ArrowRight, ArrowLeft, Rocket, Users, ClipboardList,
} from "lucide-react";
import { jobsApi, usersApi, type Assignment, type AssignmentRole, type User } from "@/lib/api";

interface Props {
  jobId: string;
  jobTitle: string;
  assignments: Assignment[];
  onClose: () => void;
  onActivated: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  recruiter:      "Recruiter",
  hiring_manager: "Hiring Manager",
};

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  recruiter:      { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  hiring_manager: { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
};

const STEPS = [
  { id: 1, label: "Review",  icon: ClipboardList },
  { id: 2, label: "Team",    icon: Users },
  { id: 3, label: "Confirm", icon: Rocket },
];

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const palette = ["#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626"];
  const bg = palette[name.charCodeAt(0) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.34, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

export function ActivateJobModal({ jobId, jobTitle, assignments: initialAssignments, onClose, onActivated }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<AssignmentRole>("recruiter");
  const [showPicker, setShowPicker] = useState(false);

  // Always use fresh assignments from the job query
  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
  });
  const assignments = job?.assignments ?? initialAssignments;
  const hasRecruiter = assignments.some((a) => a.role === "recruiter");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const assignedIds = new Set(assignments.map((a) => a.user_id));
  const filteredUsers = allUsers.filter((u: User) => {
    const matchSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchSearch && !assignedIds.has(u.id) && (u.role === selectedRole || u.role === "admin");
  });

  const addMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignmentRole }) =>
      jobsApi.addAssignment(jobId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      setSearch("");
      setShowPicker(false);
      toast.success("Team member added");
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Failed to assign"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => jobsApi.removeAssignment(jobId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast.success("Removed");
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => jobsApi.changeStatus(jobId, "active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job is now live 🚀");
      onActivated();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Activation failed"),
  });

  const checklist = [
    { label: "Job title set",            done: !!job?.title },
    { label: "Description written",      done: !!job?.description && job.description.length > 20 },
    { label: "Recruiter assigned",       done: hasRecruiter },
  ];
  const allChecked = checklist.every((c) => c.done);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 24, width: "100%", maxWidth: 560,
        boxShadow: "0 32px 80px rgba(0,0,0,0.2)", overflow: "hidden",
        margin: "0 16px", display: "flex", flexDirection: "column",
        maxHeight: "90vh",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #4f46e5 60%, #7c3aed 100%)",
          padding: "22px 28px 20px",
          position: "relative",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 14, right: 14,
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
              width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <X size={14} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Briefcase size={20} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0, fontWeight: 500, letterSpacing: "0.04em" }}>
                ACTIVATE JOB POSTING
              </p>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                {jobTitle}
              </h2>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: done ? "#22c55e" : active ? "#fff" : "rgba(255,255,255,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                      boxShadow: active ? "0 0 0 3px rgba(255,255,255,0.25)" : "none",
                    }}>
                      {done
                        ? <CheckCircle2 size={14} color="#fff" />
                        : <Icon size={13} color={active ? "#4f46e5" : "rgba(255,255,255,0.5)"} />
                      }
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      color: active ? "#fff" : done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: 1, margin: "0 10px",
                      background: done ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.15)",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {/* ── STEP 1: Review ── */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, marginTop: 0 }}>
                Before going live, make sure everything is in order.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {checklist.map((item) => (
                  <div key={item.label} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 12,
                    background: item.done ? "#f0fdf4" : "#fef9f0",
                    border: `1px solid ${item.done ? "#bbf7d0" : "#fed7aa"}`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: item.done ? "#dcfce7" : "#ffedd5",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {item.done
                        ? <CheckCircle2 size={16} color="#16a34a" />
                        : <AlertCircle size={16} color="#d97706" />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: item.done ? "#15803d" : "#92400e", margin: 0 }}>
                        {item.label}
                      </p>
                      {!item.done && (
                        <p style={{ fontSize: 11, color: "#b45309", margin: "2px 0 0" }}>
                          {item.label === "Recruiter assigned"
                            ? "Add a recruiter in the next step"
                            : "Please complete this before activating"}
                        </p>
                      )}
                    </div>
                    {item.done && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>✓ Done</span>
                    )}
                  </div>
                ))}
              </div>

              {!allChecked && (
                <div style={{
                  marginTop: 16, padding: "10px 14px", borderRadius: 10,
                  background: "#fefce8", border: "1px solid #fde68a",
                  fontSize: 12, color: "#92400e",
                }}>
                  Complete all checklist items to activate. You can add team members in the next step.
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Team ── */}
          {step === 2 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                    Hiring Team
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                    At least one recruiter is required to activate
                  </p>
                </div>
                <button
                  onClick={() => { setShowPicker(!showPicker); setSearch(""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 12, fontWeight: 600, color: "#4f46e5",
                    background: "#eef2ff", border: "1px solid #c7d2fe",
                    borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                  }}
                >
                  <UserPlus size={13} />
                  Add member
                </button>
              </div>

              {/* User picker */}
              {showPicker && (
                <div style={{
                  marginBottom: 16, border: "1px solid #e5e7eb", borderRadius: 14,
                  overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
                }}>
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {(["recruiter", "hiring_manager"] as AssignmentRole[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setSelectedRole(r)}
                          style={{
                            padding: "5px 14px", fontSize: 12, fontWeight: 600,
                            borderRadius: 7, border: "none", cursor: "pointer",
                            background: selectedRole === r ? "#4f46e5" : "#e5e7eb",
                            color: selectedRole === r ? "#fff" : "#6b7280",
                            transition: "all 0.15s",
                          }}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                    <div style={{ position: "relative" }}>
                      <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                      <input
                        autoFocus
                        type="text"
                        placeholder={`Search ${ROLE_LABELS[selectedRole].toLowerCase()}s...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                          width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
                          fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 8,
                          background: "#fff", outline: "none", boxSizing: "border-box" as const,
                          color: "#111827",
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {filteredUsers.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px 16px" }}>
                        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                          {search ? "No users match your search" : `No available ${ROLE_LABELS[selectedRole].toLowerCase()}s`}
                        </p>
                      </div>
                    ) : filteredUsers.map((user: User) => (
                      <button
                        key={user.id}
                        onClick={() => addMutation.mutate({ userId: user.id, role: selectedRole })}
                        disabled={addMutation.isPending}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", border: "none", background: "transparent",
                          cursor: "pointer", textAlign: "left",
                          borderBottom: "1px solid #f9fafb", transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Avatar name={user.full_name} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{user.full_name}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{user.email}</p>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                          background: ROLE_COLORS[selectedRole].bg,
                          color: ROLE_COLORS[selectedRole].color,
                          border: `1px solid ${ROLE_COLORS[selectedRole].border}`,
                        }}>
                          {ROLE_LABELS[selectedRole]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Current team */}
              {assignments.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "32px 20px",
                  background: "#f9fafb", borderRadius: 14, border: "2px dashed #e5e7eb",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, background: "#eef2ff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 12px",
                  }}>
                    <Users size={22} color="#818cf8" />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>No team members yet</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                    Add a recruiter to enable activation
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {assignments.map((a) => {
                    const user = allUsers.find((u: User) => u.id === a.user_id);
                    const rc = ROLE_COLORS[a.role];
                    return (
                      <div key={a.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px", borderRadius: 12,
                        background: "#f9fafb", border: "1px solid #f3f4f6",
                        transition: "border-color 0.15s",
                      }}>
                        <Avatar name={user?.full_name ?? "?"} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>
                            {user?.full_name ?? "Unknown User"}
                          </p>
                          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{user?.email}</p>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                          background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                        }}>
                          {ROLE_LABELS[a.role]}
                        </span>
                        <button
                          onClick={() => removeMutation.mutate(a.user_id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "#d1d5db", padding: 4, borderRadius: 6,
                            display: "flex", alignItems: "center",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === 3 && (
            <div>
              <div style={{
                textAlign: "center", padding: "8px 0 20px",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                  boxShadow: "0 4px 16px rgba(79,70,229,0.15)",
                }}>
                  <Rocket size={28} color="#4f46e5" />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                  Ready to go live?
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  This will publish the job and notify your team.
                </p>
              </div>

              {/* Summary */}
              <div style={{
                background: "#f8fafc", borderRadius: 14, border: "1px solid #e5e7eb",
                padding: "16px 18px", marginBottom: 8,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", margin: "0 0 12px" }}>
                  Summary
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Job title</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{jobTitle}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Team size</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{assignments.length} member{assignments.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Recruiter</span>
                    <span style={{ fontWeight: 600, color: "#16a34a" }}>
                      {allUsers.find((u: User) => u.id === assignments.find((a) => a.role === "recruiter")?.user_id)?.full_name ?? "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Checklist</span>
                    <span style={{ fontWeight: 600, color: allChecked ? "#16a34a" : "#d97706" }}>
                      {checklist.filter((c) => c.done).length}/{checklist.length} complete
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 28px", borderTop: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, background: "#fff",
        }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 500, color: "#6b7280",
                background: "none", border: "1px solid #e5e7eb",
                borderRadius: 9, padding: "8px 16px", cursor: "pointer",
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                fontSize: 13, fontWeight: 500, color: "#6b7280",
                background: "none", border: "1px solid #e5e7eb",
                borderRadius: 9, padding: "8px 16px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !hasRecruiter}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: 13, fontWeight: 600,
                background: (step === 2 && !hasRecruiter) ? "#e5e7eb" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                color: (step === 2 && !hasRecruiter) ? "#9ca3af" : "#fff",
                border: "none", borderRadius: 9, padding: "8px 20px",
                cursor: (step === 2 && !hasRecruiter) ? "not-allowed" : "pointer",
                boxShadow: (step === 2 && !hasRecruiter) ? "none" : "0 2px 8px rgba(79,70,229,0.3)",
                transition: "all 0.15s",
              }}
            >
              Continue
              {!(step === 2 && !hasRecruiter) && <ArrowRight size={14} />}
            </button>
          ) : (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={!hasRecruiter || activateMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, fontWeight: 700,
                background: hasRecruiter ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "#e5e7eb",
                color: hasRecruiter ? "#fff" : "#9ca3af",
                border: "none", borderRadius: 9, padding: "10px 24px",
                cursor: hasRecruiter ? "pointer" : "not-allowed",
                boxShadow: hasRecruiter ? "0 4px 14px rgba(79,70,229,0.35)" : "none",
                transition: "all 0.2s",
              }}
            >
              {activateMutation.isPending ? (
                <>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Activating...
                </>
              ) : (
                <>
                  <Rocket size={15} />
                  Activate Job
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
