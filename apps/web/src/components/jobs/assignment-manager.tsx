"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X, Users, Search } from "lucide-react";
import { jobsApi, usersApi, type Assignment, type AssignmentRole, type User } from "@/lib/api";

const ROLE_OPTIONS: { value: AssignmentRole; label: string }[] = [
  { value: "recruiter",      label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
];

const ROLE_STYLE: Record<AssignmentRole, { bg: string; color: string }> = {
  recruiter:      { bg: "#eff6ff", color: "#2563eb" },
  hiring_manager: { bg: "#f5f3ff", color: "#7c3aed" },
};

interface Props {
  jobId: string;
  assignments: Assignment[];
  readonly?: boolean;
}

export function AssignmentManager({ jobId, assignments, readonly }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<AssignmentRole>("recruiter");
  const [showPicker, setShowPicker] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const assignedIds = new Set(assignments.map((a) => a.user_id));
  const filteredUsers = allUsers.filter((u: User) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && !assignedIds.has(u.id) && (u.role === selectedRole || u.role === "admin");
  });

  const addMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignmentRole }) =>
      jobsApi.addAssignment(jobId, userId, role),
    onSuccess: () => {
      toast.success("User assigned successfully");
      setSearch("");
      setShowPicker(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Failed to assign user"),
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) => jobsApi.removeAssignment(jobId, uid),
    onSuccess: () => {
      toast.success("Assignment removed");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Users size={15} color="#9ca3af" />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Team Assignments</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
          {assignments.length} member{assignments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {assignments.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 16px",
          background: "#f9fafb", borderRadius: 10, border: "2px dashed #e5e7eb",
          marginBottom: 16,
        }}>
          <Users size={20} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No team members assigned yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {assignments.map((a) => {
            const rs = ROLE_STYLE[a.role];
            const user = allUsers.find((u: User) => u.id === a.user_id);
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6",
                padding: "10px 14px",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: `hsl(${(user?.full_name.charCodeAt(0) ?? 65) * 5 % 360}, 60%, 50%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {(user?.full_name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>
                    {user?.full_name ?? "Unknown User"}
                  </p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{user?.email ?? a.user_id}</p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  background: rs.bg, color: rs.color,
                }}>
                  {ROLE_OPTIONS.find((o) => o.value === a.role)?.label}
                </span>
                {!readonly && (
                  <button
                    onClick={() => removeMutation.mutate(a.user_id)}
                    style={{
                      padding: 4, border: "none", background: "transparent",
                      cursor: "pointer", color: "#d1d5db", borderRadius: 4,
                      display: "flex", alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {!readonly && (
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", margin: 0 }}>Add team member</p>
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600, color: "#4f46e5",
                background: "#eef2ff", border: "none", borderRadius: 6,
                padding: "5px 10px", cursor: "pointer",
              }}
            >
              <UserPlus size={13} />
              {showPicker ? "Cancel" : "Add member"}
            </button>
          </div>

          {showPicker && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {(["recruiter", "hiring_manager"] as AssignmentRole[]).map((r) => (
                    <button key={r} onClick={() => setSelectedRole(r)} style={{
                      padding: "3px 10px", fontSize: 11, fontWeight: 600,
                      borderRadius: 6, border: "none", cursor: "pointer",
                      background: selectedRole === r ? "#4f46e5" : "#e5e7eb",
                      color: selectedRole === r ? "#fff" : "#6b7280",
                    }}>
                      {ROLE_OPTIONS.find((o) => o.value === r)?.label}
                    </button>
                  ))}
                </div>
                <div style={{ position: "relative" }}>
                  <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: "100%", paddingLeft: 26, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
                      fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 7,
                      background: "#fff", outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {filteredUsers.length === 0 ? (
                  <p style={{ textAlign: "center", padding: 16, fontSize: 12, color: "#9ca3af" }}>No users found</p>
                ) : filteredUsers.map((user: User) => (
                  <button
                    key={user.id}
                    onClick={() => addMutation.mutate({ userId: user.id, role: selectedRole })}
                    disabled={addMutation.isPending}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", border: "none", background: "transparent",
                      cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f9fafb",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: `hsl(${user.full_name.charCodeAt(0) * 5 % 360}, 60%, 50%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 10, fontWeight: 700,
                    }}>
                      {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", margin: 0 }}>{user.full_name}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
