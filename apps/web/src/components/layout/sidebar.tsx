"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Users, BarChart2, Settings, ChevronDown, LayoutTemplate, ExternalLink, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const NAV = [
  {
    label: "Recruitment",
    items: [
      { href: "/jobs", icon: Briefcase, label: "Job Postings", badge: null },
      { href: "/templates", icon: LayoutTemplate, label: "Templates", badge: null },
      { href: "/candidates", icon: Users, label: "Candidates", soon: true },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/analytics", icon: BarChart2, label: "Analytics", soon: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", icon: Settings, label: "Settings", soon: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside style={{
      width: 248,
      minWidth: 248,
      background: "#0f172a",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 34, height: 34,
          background: "linear-gradient(135deg, #111827, #1f2937)",
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px rgba(234,179,8,0.4), 0 4px 12px rgba(0,0,0,0.4)",
          border: "1px solid rgba(234,179,8,0.25)",
        }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 4 L28 28 H22 L19 21 H13 L10 28 H4 L16 4Z" fill="#eab308" />
            <rect x="11.5" y="18" width="9" height="2.5" rx="1.25" fill="#111827" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            <span style={{ color: "#eab308" }}>Apex</span> Hire
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.3, letterSpacing: "0.02em" }}>Intelligence Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "20px 12px" }}>
        {NAV.map((group) => (
          <div key={group.label} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)",
              padding: "0 10px", marginBottom: 6,
            }}>
              {group.label}
            </div>
            {group.items.map(({ href, icon: Icon, label, soon }: any) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={soon ? "#" : href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 9,
                    marginBottom: 2,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#fff" : "rgba(255,255,255,0.5)",
                    background: active
                      ? "linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.3))"
                      : "transparent",
                    opacity: soon ? 0.45 : 1,
                    cursor: soon ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!active && !soon) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.8)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !soon) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)";
                    }
                  }}
                >
                  {active && (
                    <div style={{
                      position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 18, background: "#818cf8", borderRadius: "0 3px 3px 0",
                    }} />
                  )}
                  <Icon size={15} color={active ? "#a5b4fc" : "rgba(255,255,255,0.35)"} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {soon && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.06em", background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.3)", padding: "2px 6px", borderRadius: 4,
                    }}>
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px" }}>
        {/* Careers portal quick link */}
        <Link
          href="/careers"
          target="_blank"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 8, marginBottom: 8,
            textDecoration: "none", fontSize: 12, fontWeight: 500,
            color: "rgba(255,255,255,0.4)", background: "transparent", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.4)";
          }}
        >
          <ExternalLink size={13} color="rgba(255,255,255,0.3)" />
          <span>Careers Portal</span>
        </Link>

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 10,
              background: "rgba(255,255,255,0.04)", cursor: "pointer",
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.full_name ?? "—"}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.role ?? ""}
              </div>
            </div>
            <ChevronDown
              size={13}
              color="rgba(255,255,255,0.3)"
              style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
            />
          </div>

          {menuOpen && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
              background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, overflow: "hidden", zIndex: 50,
            }}>
              <div style={{ padding: "6px 12px 4px", fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {user?.email}
              </div>
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", background: "transparent", border: "none",
                  color: "#fca5a5", fontSize: 13, cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
