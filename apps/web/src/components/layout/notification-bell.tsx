"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { notificationsApi, type AppNotification } from "@/lib/api";

const TYPE_ICON: Record<string, string> = {
  pipeline_move: "🔄",
  shortlist_action: "⭐",
  parse_complete: "📄",
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface BellProps {
  dark?: boolean;
}

export default function NotificationBell({ dark = false }: BellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: count = 0 } = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    enabled: open,
    staleTime: 0,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notif-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notif-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "relative", border: "none", cursor: "pointer",
          padding: 6, borderRadius: 8,
          background: open
            ? (dark ? "rgba(255,255,255,0.1)" : "#f3f4f6")
            : "transparent",
          color: dark ? "rgba(255,255,255,0.6)" : "#6b7280",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            width: 16, height: 16, borderRadius: "50%",
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid #fff",
          }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "fixed",
          bottom: 60,
          left: 220,
          zIndex: 99999,
          width: 340, background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              Notifications {count > 0 && <span style={{ color: "#ef4444" }}>({count})</span>}
            </span>
            {count > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                style={{ fontSize: 11, color: "#4f46e5", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <Bell size={24} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={() => { if (!n.is_read) markReadMutation.mutate(n.id); }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({ notif, onRead }: { notif: AppNotification; onRead: () => void }) {
  const icon = TYPE_ICON[notif.type] ?? "🔔";
  const href = notif.entity_type === "job" && notif.entity_id ? `/jobs/${notif.entity_id}` : null;

  const content = (
    <div
      onClick={onRead}
      style={{
        display: "flex", gap: 10, padding: "12px 16px", cursor: "pointer",
        background: notif.is_read ? "#fff" : "#fafaf9",
        borderBottom: "1px solid #f9fafb",
        transition: "background 0.1s",
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: notif.is_read ? 400 : 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {notif.title}
        </p>
        {notif.body && (
          <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {notif.body}
          </p>
        )}
        <p style={{ fontSize: 10, color: "#9ca3af", margin: "3px 0 0" }}>{timeAgo(notif.created_at)}</p>
      </div>
      {!notif.is_read && (
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4f46e5", flexShrink: 0, marginTop: 4 }} />
      )}
    </div>
  );

  return href ? <Link href={href} style={{ textDecoration: "none" }}>{content}</Link> : content;
}
